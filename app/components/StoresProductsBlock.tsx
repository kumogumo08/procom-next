'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { buttonPrimary, cardBase, cardTitle, textareaBase, inputBase } from '@/components/ui/cardStyles';
import ShopDescription from '@/components/ShopDescription';
import { bindStoresButton, subscribeStoresButtonStatus } from '@/lib/storesButtonRuntime';
import {
  addStoresProduct,
  isStoresButtonMobileViewport,
  MAX_SHOP_DESCRIPTION,
  MAX_STORES_PRODUCTS,
  moveStoresProduct,
  readStoresShopCandidate,
  removeStoresProduct,
  replaceStoresProduct,
  SHOP_DESCRIPTION_HINT,
  shopDescriptionLength,
  sameStoresProducts,
  STORES_SHOP_URL_ERROR,
  storesButtonSize,
  storesProductIndexAfterAdd,
  storesProductIndexAfterDelete,
  storesProductIndexAfterMove,
  storesProductKey,
  storesProductPageUrl,
  storesShopSectionVisible,
  type StoresProduct,
  type StoresProductsSettings,
} from '@/lib/storesProducts';
import styles from './StoresProductsBlock.module.css';

type Props = {
  isEditable: boolean;
  initialProducts?: StoresProduct[];
  initialSettings?: StoresProductsSettings;
  onDraftChange?: (products: StoresProduct[]) => void;
  onSettingsChange?: (settings: StoresProductsSettings) => void;
};

function moveDrafts(items: readonly string[], index: number, direction: -1 | 1): string[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(index, 1);
  if (item == null) return [...items];
  next.splice(target, 0, item);
  return next;
}

function StoresButtonFrame({ product, width, height }: { product: StoresProduct; width: number; height: number }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);
  const productKey = `${storesProductKey(product)}:${product.layout}:${product.lang}:${product.image ?? ''}`;

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    if (!slotRef.current) slotRef.current = document.createElement('div');
    const slot = slotRef.current;
    slot.style.width = `${width}px`;
    slot.style.height = `${height}px`;
    if (slot.parentNode !== anchor) anchor.appendChild(slot);
  });

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    return bindStoresButton(slot, product);
  }, [product, productKey]);

  return <div ref={anchorRef} className={styles.frameSlot} style={{ width, height }} />;
}

export default function StoresProductsBlock({
  isEditable,
  initialProducts,
  initialSettings,
  onDraftChange,
  onSettingsChange,
}: Props) {
  const [products, setProducts] = useState<StoresProduct[]>(initialProducts ?? []);
  const [drafts, setDrafts] = useState<string[]>(() => (initialProducts ?? []).map(() => ''));
  const [input, setInput] = useState('');
  const [selected, setSelected] = useState(0);
  const [adding, setAdding] = useState((initialProducts ?? []).length === 0);
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [description, setDescription] = useState(initialSettings?.description ?? '');
  const [shopUrl, setShopUrl] = useState(initialSettings?.shopUrl ?? '');
  const [shopError, setShopError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [mobileReady, setMobileReady] = useState(false);
  const echoRef = useRef<StoresProduct[] | null>(null);
  const settingsEchoRef = useRef<StoresProductsSettings | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const incoming = initialProducts ?? [];
    if (echoRef.current && sameStoresProducts(echoRef.current, incoming)) {
      echoRef.current = null;
      return;
    }
    setProducts(incoming);
    setDrafts(incoming.map(() => ''));
    setError(null);
    setSlide(0);
    setSelected(0);
    setAdding(incoming.length === 0);
  }, [initialProducts]);

  useEffect(() => {
    const incoming = {
      description: initialSettings?.description ?? '',
      shopUrl: initialSettings?.shopUrl ?? '',
    };
    const echoed = settingsEchoRef.current;
    if (echoed && echoed.description === incoming.description && echoed.shopUrl === incoming.shopUrl) {
      settingsEchoRef.current = null;
      return;
    }
    setDescription(incoming.description);
    setShopUrl(incoming.shopUrl);
    setShopError(null);
  }, [initialSettings]);

  useEffect(() => {
    const update = () => setMobile(isStoresButtonMobileViewport(navigator.userAgent, window.innerWidth));
    update();
    setMobileReady(true);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => subscribeStoresButtonStatus((status) => {
    setLoadError(status === 'error' ? '購入ボタンを表示できませんでした' : null);
  }), []);

  const commitSettings = (next: StoresProductsSettings) => {
    settingsEchoRef.current = next;
    setDescription(next.description);
    setShopUrl(next.shopUrl);
    onSettingsChange?.(next);
  };

  const commit = (next: StoresProduct[], nextDrafts = drafts) => {
    echoRef.current = next;
    setProducts(next);
    setDrafts(nextDrafts);
    setError(null);
    onDraftChange?.(next);
  };

  const onAdd = () => {
    const preview = addStoresProduct(products, input);
    if (!preview.ok) {
      setError(preview.error);
      return;
    }
    setInput('');
    setAdding(false);
    setSelected(storesProductIndexAfterAdd(products.length));
    commit(preview.products, [...drafts, '']);
  };

  const onReplace = (index: number) => {
    const preview = replaceStoresProduct(products, index, drafts[index] ?? '');
    if (!preview.ok) {
      setError(preview.error);
      return;
    }
    if (sameStoresProducts(products, preview.products)) {
      setError(null);
      return;
    }
    const nextDrafts = drafts.map((item, itemIndex) => (itemIndex === index ? '' : item));
    commit(preview.products, nextDrafts);
  };

  const onRemove = (index: number) => {
    const preview = removeStoresProduct(products, index);
    if (!preview.ok) {
      setError(preview.error);
      return;
    }
    const nextSelected = storesProductIndexAfterDelete(index, products.length);
    setAdding(nextSelected == null);
    setSelected(nextSelected ?? 0);
    commit(preview.products, drafts.filter((_, itemIndex) => itemIndex !== index));
  };

  const onMove = (index: number, direction: -1 | 1) => {
    const preview = moveStoresProduct(products, index, direction);
    if (!preview.ok || sameStoresProducts(products, preview.products)) return;
    setAdding(false);
    setSelected(storesProductIndexAfterMove(index, direction, products.length));
    commit(preview.products, moveDrafts(drafts, index, direction));
  };

  const onCancelAdd = () => {
    setError(null);
    setAdding(false);
  };

  const selectTab = (index: number) => {
    setAdding(false);
    setSelected(index);
    setError(null);
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (products.length === 0) return;
    let next = index;
    if (event.key === 'ArrowRight') next = Math.min(products.length - 1, index + 1);
    else if (event.key === 'ArrowLeft') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = products.length - 1;
    else return;
    event.preventDefault();
    selectTab(next);
    const tabKey = storesProductKey(products[next]!);
    requestAnimationFrame(() => {
      tabsRef.current?.querySelector<HTMLButtonElement>(`[data-tab-key="${CSS.escape(tabKey)}"]`)?.focus();
    });
  };

  const syncScroller = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const cards = [...scroller.querySelectorAll<HTMLElement>('[data-stores-card]')];
    if (cards.length === 0) return;
    let nearest = 0;
    let best = Number.POSITIVE_INFINITY;
    cards.forEach((card, index) => {
      const distance = Math.abs(card.offsetLeft - scroller.offsetLeft - scroller.scrollLeft);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    setSlide((current) => (current === nearest ? current : nearest));
  };

  const scrollTo = (nextIndex: number) => {
    const scroller = scrollerRef.current;
    const card = scroller?.querySelectorAll<HTMLElement>('[data-stores-card]')[nextIndex];
    if (!scroller || !card) return;
    const left = card.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft;
    scroller.scrollTo({ left, behavior: 'smooth' });
    setSlide(nextIndex);
  };

  const shopLink = readStoresShopCandidate(shopUrl);
  const trimmedDescription = description.trim();
  const visible = storesShopSectionVisible({
    productCount: products.length,
    description: trimmedDescription,
    shopLink,
  });
  if (!isEditable && !visible) return null;

  const atLimit = products.length >= MAX_STORES_PRODUCTS;
  const selectedIndex = products.length === 0 ? -1 : Math.min(Math.max(selected, 0), products.length - 1);
  const selectedProduct = selectedIndex >= 0 ? products[selectedIndex] : undefined;
  const showAddForm = adding;
  const showProductForm = !adding && selectedProduct != null;

  return (
    <section className={styles.block} style={{ ...cardBase, width: '100%' }} aria-label="STORES SHOP">
      <h2 style={cardTitle} data-block-title=""><span>STORES SHOP</span></h2>
      <div className={styles.stage} data-many={products.length > 1 ? 'true' : undefined}>
        {!isEditable && trimmedDescription ? (
          <div className={styles.lead}>
            <ShopDescription text={trimmedDescription} />
          </div>
        ) : null}
        {products.length > 0 ? (
          <div className={styles.slider}>
            {products.length > 1 ? (
              <button
                type="button"
                className={styles.arrow}
                aria-label="前の商品"
                onClick={() => scrollTo(Math.max(0, slide - 1))}
                disabled={slide <= 0}
              >
                ‹
              </button>
            ) : null}
            <div
              ref={scrollerRef}
              className={products.length === 1 ? styles.scrollerSingle : styles.scroller}
              role="region"
              aria-roledescription="carousel"
              aria-label="STORESの商品"
              onScroll={syncScroller}
            >
              {products.map((product) => {
                const size = storesButtonSize(product, mobileReady && mobile);
                return (
                  <div
                    key={storesProductKey(product)}
                    data-stores-card
                    className={styles.card}
                    style={{ width: size.width, flexBasis: size.width }}
                  >
                    {mobileReady ? (
                      <StoresButtonFrame product={product} width={size.width} height={size.height} />
                    ) : (
                      <div className={styles.frameSlot} style={{ width: size.width, height: size.height }} />
                    )}
                    <a
                      className={styles.productLink}
                      href={storesProductPageUrl(product)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      商品ページを見る
                    </a>
                  </div>
                );
              })}
            </div>
            {products.length > 1 ? (
              <button
                type="button"
                className={styles.arrow}
                aria-label="次の商品"
                onClick={() => scrollTo(Math.min(products.length - 1, slide + 1))}
                disabled={slide >= products.length - 1}
              >
                ›
              </button>
            ) : null}
          </div>
        ) : null}
        {loadError ? (
          <p className={styles.error} role="alert">
            {loadError}
          </p>
        ) : null}
        {isEditable ? (
          <div className={styles.editor}>
            <p className={styles.notice}>
              追加、変更、削除、並び替えは下書きです。変更を保存するまでプロフィールには反映されません。
            </p>
            {products.length > 0 ? (
              <div ref={tabsRef} className={styles.tabs} role="tablist" aria-label="登録したSTORES商品">
                {products.map((product, index) => {
                  const active = !adding && index === selectedIndex;
                  return (
                    <button
                      key={storesProductKey(product)}
                      type="button"
                      role="tab"
                      id={`stores-product-tab-${index}`}
                      data-tab-key={storesProductKey(product)}
                      className={active ? styles.tabActive : styles.tab}
                      aria-selected={active}
                      aria-controls="stores-product-panel"
                      aria-label={`商品${index + 1}`}
                      tabIndex={active || (adding && index === selectedIndex) ? 0 : -1}
                      onClick={() => selectTab(index)}
                      onKeyDown={(event) => onTabKeyDown(event, index)}
                    >
                      <span className={styles.tabMark} aria-hidden>
                        {index + 1}
                      </span>
                      <span className={styles.tabName} aria-hidden>
                        商品{index + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {showProductForm && selectedProduct ? (
              <div
                role="tabpanel"
                id="stores-product-panel"
                aria-labelledby={`stores-product-tab-${selectedIndex}`}
                className={styles.panel}
              >
                <p className={styles.order}>
                  商品{selectedIndex + 1} / {products.length}
                </p>
                <p className={styles.registered}>登録済み: {storesProductPageUrl(selectedProduct)}</p>
                <p className={styles.registered}>バリエーション: {selectedProduct.variation}</p>
                <label className={styles.fieldLabel}>
                  商品{selectedIndex + 1}の貼り付けコード
                  <textarea
                    aria-label={`商品${selectedIndex + 1}の貼り付けコード`}
                    placeholder="新しいSTORES BUTTONの貼り付けコード"
                    value={drafts[selectedIndex] ?? ''}
                    rows={4}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDrafts((current) => current.map((item, itemIndex) => (itemIndex === selectedIndex ? value : item)));
                      if (error) setError(null);
                    }}
                    style={{ ...textareaBase, fontSize: 16, minHeight: 96 }}
                  />
                </label>
                {error ? <p className={styles.error}>{error}</p> : null}
                <div className={styles.actions}>
                  <button type="button" onClick={() => onReplace(selectedIndex)}>
                    変更
                  </button>
                  <button type="button" onClick={() => onRemove(selectedIndex)}>
                    削除
                  </button>
                  <button type="button" onClick={() => onMove(selectedIndex, -1)} disabled={selectedIndex === 0}>
                    順番を前に
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(selectedIndex, 1)}
                    disabled={selectedIndex === products.length - 1}
                  >
                    順番を後ろに
                  </button>
                </div>
              </div>
            ) : null}
            {showAddForm ? (
              <div className={styles.panel}>
                <label className={styles.fieldLabel}>
                  追加するSTORES購入ボタン
                  <textarea
                    aria-label="STORES購入ボタンの貼り付けコード"
                    placeholder="STORES BUTTONの貼り付けコード"
                    value={input}
                    rows={4}
                    onChange={(event) => {
                      setInput(event.target.value);
                      if (error) setError(null);
                    }}
                    style={{ ...textareaBase, fontSize: 16, minHeight: 96 }}
                  />
                </label>
                {error ? <p className={styles.error}>{error}</p> : null}
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.addBtn}
                    onClick={onAdd}
                    style={{ ...buttonPrimary, minHeight: 44 }}
                  >
                    登録
                  </button>
                  <button type="button" onClick={onCancelAdd}>
                    キャンセル
                  </button>
                </div>
              </div>
            ) : null}
            {!showAddForm && !atLimit ? (
              <button
                type="button"
                className={styles.addBtn}
                onClick={() => {
                  setAdding(true);
                  setError(null);
                }}
                style={{ ...buttonPrimary, width: '100%', minHeight: 44 }}
              >
                ＋ 商品を追加
              </button>
            ) : null}
            {atLimit ? <p className={styles.notice}>商品は最大5件までです。</p> : null}
          </div>
        ) : null}
        {isEditable ? (
          <div className={styles.shopInfo}>
            <p className={styles.order}>ショップ情報</p>
            <label className={styles.fieldLabel}>
              ショップ紹介文（任意）
              <textarea
                aria-label="ショップ紹介文"
                placeholder="ショップの紹介。300文字以内、改行できます"
                value={description}
                maxLength={MAX_SHOP_DESCRIPTION}
                rows={3}
                onChange={(event) => {
                  const next = event.target.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                  if (shopDescriptionLength(next) > MAX_SHOP_DESCRIPTION) return;
                  commitSettings({ description: next, shopUrl });
                }}
                style={{ ...textareaBase, fontSize: 16, minHeight: 88 }}
              />
              <span className={styles.hint}>
                <span>{SHOP_DESCRIPTION_HINT}</span>
                <span>
                  {shopDescriptionLength(description)}/{MAX_SHOP_DESCRIPTION}
                </span>
              </span>
            </label>
            <label className={styles.fieldLabel}>
              ショップURL（任意）
              <input
                aria-label="ショップURL"
                placeholder="https://shopname.stores.jp/"
                inputMode="url"
                value={shopUrl}
                onChange={(event) => {
                  const next = event.target.value;
                  commitSettings({ description, shopUrl: next });
                  if (!next.trim() || readStoresShopCandidate(next)) setShopError(null);
                  else setShopError(STORES_SHOP_URL_ERROR);
                }}
                style={{ ...inputBase, fontSize: 16 }}
              />
            </label>
            {shopError ? <p className={styles.error}>{shopError}</p> : null}
            {description !== (initialSettings?.description ?? '') || shopUrl !== (initialSettings?.shopUrl ?? '') ? (
              <p className={styles.notice}>ショップ情報は下書きです。変更を保存するまでプロフィールには反映されません。</p>
            ) : null}
          </div>
        ) : null}
        {shopLink ? (
          <div className={styles.shopButtonWrap}>
            <a className={styles.shopButton} href={shopLink} target="_blank" rel="noopener noreferrer">
              ショップを見る
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
