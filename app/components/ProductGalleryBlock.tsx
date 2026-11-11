'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { buttonPrimary, cardBase, cardTitle, inputBase, textareaBase } from '@/components/ui/cardStyles';
import {
  isSafeProductUrl,
  isSafeShopUrl,
  MAX_SHOP_DESCRIPTION,
  moveProductGalleryItem,
  PRODUCT_IMAGE_MAX_BYTES,
  productGalleryContentEqual,
  productTabAfterDelete,
  SHOP_DESCRIPTION_HINT,
  shopDescriptionLength,
  shopIntroVisible,
  type ProductGalleryItem,
  type ProductGallerySettings,
} from '@/lib/productGallery';
import ShopDescription from '@/components/ShopDescription';
import styles from './ProductGalleryBlock.module.css';

const MAX_EDGE = 1600;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type Props = {
  isEditable: boolean;
  initialItems?: ProductGalleryItem[];
  initialSettings?: ProductGallerySettings;
  onDraftChange?: (items: ProductGalleryItem[]) => void;
  onSettingsChange?: (settings: ProductGallerySettings) => void;
};

function visibleItems(items: readonly ProductGalleryItem[]): ProductGalleryItem[] {
  return items.filter((item) => item.name.trim() && item.imageUrl.trim() && isSafeProductUrl(item.productUrl));
}

function cardScrollLeft(scroller: HTMLElement, card: HTMLElement) {
  return card.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像を読み込めませんでした'));
    };
    image.src = url;
  });
}

async function renderImage(image: HTMLImageElement, edge: number, type: string, quality: number): Promise<Blob> {
  const scale = Math.min(1, edge / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('画像を処理できませんでした');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error('画像を処理できませんでした');
  return blob;
}

/** 長い辺が1600pxを超える画像、または3MBを超える画像を縮小する。 */
async function prepareProductImage(file: File): Promise<File> {
  if (!IMAGE_TYPES.includes(file.type)) {
    throw new Error('画像はJPEG、PNG、WebPにしてください');
  }
  const image = await loadImage(file);
  const tooWide = Math.max(image.width, image.height) > MAX_EDGE;
  if (!tooWide && file.size <= PRODUCT_IMAGE_MAX_BYTES) return file;

  const outputType = file.type === 'image/png' ? 'image/png' : file.type;
  let edge = MAX_EDGE;
  let quality = 0.85;
  let blob = await renderImage(image, edge, outputType, quality);
  while (blob.size > PRODUCT_IMAGE_MAX_BYTES && edge > 480) {
    if (outputType !== 'image/png' && quality > 0.55) quality -= 0.1;
    else edge = Math.round(edge * 0.8);
    blob = await renderImage(image, edge, outputType, quality);
  }
  if (blob.size > PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error('ファイルサイズが大きすぎます（3MB以下にしてください）');
  }
  const ext = outputType === 'image/png' ? 'png' : outputType === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `product.${ext}`, { type: blob.type || outputType });
}

export default function ProductGalleryBlock({
  isEditable,
  initialItems,
  initialSettings,
  onDraftChange,
  onSettingsChange,
}: Props) {
  const [items, setItems] = useState<ProductGalleryItem[]>(initialItems ?? []);
  const [description, setDescription] = useState(initialSettings?.description ?? '');
  const [shopUrl, setShopUrl] = useState(initialSettings?.shopUrl ?? '');
  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(initialItems?.[0]?.id ?? null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const echoRef = useRef<ProductGalleryItem[] | null>(null);
  const settingsEchoRef = useRef<ProductGallerySettings | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const shown = visibleItems(items);
  const shownKey = shown.map((item) => `${item.id}:${item.imageUrl}`).join('|');
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const selectedIndex = selected ? items.findIndex((item) => item.id === selected.id) : -1;

  useEffect(() => {
    const incoming = initialItems ?? [];
    if (echoRef.current && productGalleryContentEqual(echoRef.current, incoming)) {
      echoRef.current = null;
      return;
    }
    setItems(incoming);
  }, [initialItems]);

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
  }, [initialSettings]);

  const commitSettings = (next: ProductGallerySettings) => {
    settingsEchoRef.current = next;
    setDescription(next.description);
    setShopUrl(next.shopUrl);
    onSettingsChange?.(next);
  };

  useEffect(() => {
    setSelectedId((current) => {
      if (current && items.some((item) => item.id === current)) return current;
      return items[0]?.id ?? null;
    });
  }, [items]);

  useEffect(() => {
    setIndex((current) => (shown.length === 0 ? 0 : Math.min(current, shown.length - 1)));
  }, [shown.length]);

  useEffect(() => {
    const strip = tabsRef.current;
    if (!strip || !selectedId) return;
    const tab = strip.querySelector<HTMLElement>(`[data-tab-id="${selectedId}"]`);
    if (!tab) return;
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    if (left < strip.scrollLeft) strip.scrollTo({ left: Math.max(0, left - 4), behavior: 'smooth' });
    else if (right > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: right - strip.clientWidth + 4, behavior: 'smooth' });
    }
  }, [selectedId, items.length]);

  const syncScroller = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const cards = [...scroller.querySelectorAll<HTMLElement>('[data-product-card]')];
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    cards.forEach((card, cardIndex) => {
      const distance = Math.abs(cardScrollLeft(scroller, card) - scroller.scrollLeft);
      if (distance < bestDistance) {
        best = cardIndex;
        bestDistance = distance;
      }
    });
    setIndex((current) => (current === best ? current : best));
  }, []);

  useEffect(() => {
    syncScroller();
    const scroller = scrollerRef.current;
    if (!scroller || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => syncScroller());
    observer.observe(scroller);
    for (const child of Array.from(scroller.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [shownKey, syncScroller]);

  const commit = (next: ProductGalleryItem[]) => {
    const ordered = next.map((item, order) => ({ ...item, displayOrder: order }));
    echoRef.current = ordered;
    setItems(ordered);
    onDraftChange?.(ordered);
  };

  const releaseIfOrphan = async (url: string | undefined, nextItems: readonly ProductGalleryItem[]) => {
    if (!url || nextItems.some((item) => item.imageUrl === url)) return;
    await fetch('/api/product-gallery/image', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: url }),
    }).catch(() => undefined);
  };

  const updateItem = (id: string, patch: Partial<ProductGalleryItem>) => {
    commit(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    if (items.length >= 5) return;
    const id = crypto.randomUUID();
    setSelectedId(id);
    commit([...items, { id, name: '', productUrl: '', imageUrl: '', displayOrder: items.length }]);
  };

  const removeItem = (id: string) => {
    const current = items.find((item) => item.id === id);
    const next = items.filter((item) => item.id !== id);
    setSelectedId(productTabAfterDelete(items.map((item) => item.id), id, selectedId));
    commit(next);
    void releaseIfOrphan(current?.imageUrl, next);
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (items.length === 0) return;
    const current = Math.max(0, items.findIndex((item) => item.id === selectedId));
    let next = current;
    if (event.key === 'ArrowRight') next = Math.min(items.length - 1, current + 1);
    else if (event.key === 'ArrowLeft') next = Math.max(0, current - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;
    event.preventDefault();
    const id = items[next]?.id;
    if (!id) return;
    setSelectedId(id);
    requestAnimationFrame(() => {
      tabsRef.current?.querySelector<HTMLButtonElement>(`[data-tab-id="${id}"]`)?.focus();
    });
  };

  const onImage = async (id: string, file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploadingId(id);
    const previous = itemsRef.current.find((item) => item.id === id)?.imageUrl;
    try {
      const prepared = await prepareProductImage(file);
      const body = new FormData();
      body.append('file', prepared);
      const res = await fetch('/api/product-gallery/image', {
        method: 'POST',
        credentials: 'include',
        body,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; imageUrl?: string };
      if (!res.ok || typeof data.imageUrl !== 'string') {
        throw new Error(typeof data.error === 'string' ? data.error : '画像のアップロードに失敗しました');
      }
      const next = itemsRef.current.map((item) =>
        item.id === id ? { ...item, imageUrl: data.imageUrl ?? '' } : item
      );
      commit(next);
      if (previous && previous !== data.imageUrl) void releaseIfOrphan(previous, next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '画像のアップロードに失敗しました');
    } finally {
      setUploadingId(null);
    }
  };

  const scrollTo = (nextIndex: number) => {
    const scroller = scrollerRef.current;
    const card = scroller?.querySelectorAll<HTMLElement>('[data-product-card]')[nextIndex];
    if (!scroller || !card) return;
    scroller.scrollTo({ left: cardScrollLeft(scroller, card), behavior: 'smooth' });
    setIndex(nextIndex);
  };

  const trimmedDescription = description.trim();
  if (!isEditable && shown.length === 0 && !shopIntroVisible({ description, shopUrl })) return null;

  return (
    <section style={{ ...cardBase, width: '100%' }} aria-label="SHOP">
      <h2 style={cardTitle}>SHOP</h2>
      <div className={styles.showcase} data-slider={shown.length > 0 ? '' : undefined}>
      {!isEditable && trimmedDescription ? (
        <div className={styles.description}>
          <ShopDescription text={trimmedDescription} />
        </div>
      ) : null}
      {isEditable ? (
        <div className={styles.shopFields}>
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
              placeholder="https://example.com"
              inputMode="url"
              value={shopUrl}
              onChange={(event) => commitSettings({ description, shopUrl: event.target.value })}
              style={{ ...inputBase, fontSize: 16 }}
            />
          </label>
          {shopUrl.trim() && !isSafeShopUrl(shopUrl) ? (
            <p className={styles.error}>ショップURLはhttpsのリンクにしてください</p>
          ) : null}
        </div>
      ) : null}
      {shown.length > 0 ? (
        <div className={styles.preview}>
          {shown.length > 1 ? (
            <button
              type="button"
              className={styles.arrow}
              aria-label="前の商品"
              onClick={() => scrollTo(Math.max(0, index - 1))}
              disabled={index <= 0}
            >
              ‹
            </button>
          ) : (
            <span className={styles.arrowSpacer} aria-hidden />
          )}
          <div
            ref={scrollerRef}
            className={styles.scroller}
            role="region"
            aria-roledescription="carousel"
            aria-label="商品"
            onScroll={syncScroller}
          >
            {shown.map((item) => (
              <a
                key={item.id}
                data-product-card
                className={styles.card}
                href={item.productUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles.imageWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- 本人の商品画像 */}
                  <img className={styles.image} src={item.imageUrl} alt={item.name} onLoad={syncScroller} />
                </span>
                <span className={styles.meta}>
                  <span className={styles.name}>{item.name}</span>
                  {item.price ? <span className={styles.price}>{item.price}</span> : null}
                </span>
              </a>
            ))}
          </div>
          {shown.length > 1 ? (
            <button
              type="button"
              className={styles.arrow}
              aria-label="次の商品"
              onClick={() => scrollTo(Math.min(shown.length - 1, index + 1))}
              disabled={index >= shown.length - 1}
            >
              ›
            </button>
          ) : (
            <span className={styles.arrowSpacer} aria-hidden />
          )}
        </div>
      ) : null}

      {isEditable ? (
        <div className={styles.editor}>
          <p className={styles.notice}>
            商品画像は、ご自身が権利を持つ画像を登録してください。他社の商品画像を無断で登録しないでください。
          </p>
          {items.length > 0 ? (
            <div ref={tabsRef} className={styles.tabs} role="tablist" aria-label="登録した商品">
              {items.map((item, itemIndex) => {
                const active = item.id === selectedId;
                const label = item.name.trim() || `商品${itemIndex + 1}`;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    data-tab-id={item.id}
                    id={`product-tab-${item.id}`}
                    className={active ? styles.tabActive : styles.tab}
                    aria-selected={active}
                    aria-controls={`product-panel-${item.id}`}
                    aria-label={`${label}（${itemIndex + 1}番目）`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => setSelectedId(item.id)}
                    onKeyDown={onTabKeyDown}
                  >
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- 本人の商品画像
                      <img className={styles.tabThumb} src={item.imageUrl} alt="" />
                    ) : (
                      <span className={styles.tabPlaceholder} aria-hidden>
                        {itemIndex + 1}
                      </span>
                    )}
                    <span className={styles.tabName} aria-hidden>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {selected && selectedIndex >= 0 ? (
            <div
              role="tabpanel"
              id={`product-panel-${selected.id}`}
              aria-labelledby={`product-tab-${selected.id}`}
              className={styles.panel}
            >
              <p className={styles.order}>
                {selectedIndex + 1}番目 / {items.length}商品
              </p>
              <div className={styles.actions}>
                <button
                  type="button"
                  onClick={() => commit(moveProductGalleryItem(items, selected.id, -1))}
                  disabled={selectedIndex === 0}
                >
                  順番を前に
                </button>
                <button
                  type="button"
                  onClick={() => commit(moveProductGalleryItem(items, selected.id, 1))}
                  disabled={selectedIndex === items.length - 1}
                >
                  順番を後ろに
                </button>
                <button type="button" onClick={() => removeItem(selected.id)}>
                  削除
                </button>
              </div>
              <label className={`${styles.dropZone} ${uploadingId === selected.id ? styles.dropBusy : ''}`}>
                {selected.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 本人の商品画像
                  <img className={styles.previewImage} src={selected.imageUrl} alt="" />
                ) : null}
                <p className={styles.dropHint}>JPEG / PNG / WebP、3MB以下</p>
                <span className={styles.chooseBtn}>{uploadingId === selected.id ? 'アップロード中' : '画像を選択'}</span>
                <input
                  className={styles.visuallyHidden}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label={`${selected.name.trim() || `商品${selectedIndex + 1}`}の画像を選択。JPEG、PNG、WebP、3MB以下`}
                  disabled={uploadingId === selected.id}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    void onImage(selected.id, file);
                  }}
                />
              </label>
              <input
                aria-label={`商品${selectedIndex + 1}の商品名`}
                placeholder="商品名"
                value={selected.name}
                onChange={(event) => updateItem(selected.id, { name: event.target.value })}
                style={{ ...inputBase, fontSize: 16 }}
              />
              <input
                aria-label={`商品${selectedIndex + 1}の価格`}
                placeholder="価格（任意）"
                value={selected.price ?? ''}
                onChange={(event) => updateItem(selected.id, { price: event.target.value })}
                style={{ ...inputBase, fontSize: 16 }}
              />
              <input
                aria-label={`商品${selectedIndex + 1}のURL`}
                placeholder="https://example.com/item"
                inputMode="url"
                value={selected.productUrl}
                onChange={(event) => updateItem(selected.id, { productUrl: event.target.value })}
                style={{ ...inputBase, fontSize: 16 }}
              />
            </div>
          ) : null}

          {error ? <p className={styles.error}>{error}</p> : null}
          {items.length < 5 ? (
            <button type="button" onClick={addItem} style={{ ...buttonPrimary, width: '100%', minHeight: 44 }}>
              ＋商品を追加
            </button>
          ) : (
            <p className={styles.notice}>商品は最大5件までです。</p>
          )}
        </div>
      ) : null}
      {isSafeShopUrl(shopUrl) ? (
        <div className={styles.shopButtonWrap}>
          <a className={styles.shopButton} href={shopUrl.trim()} target="_blank" rel="noopener noreferrer">
            ショップを見る
          </a>
        </div>
      ) : null}
      </div>
    </section>
  );
}
