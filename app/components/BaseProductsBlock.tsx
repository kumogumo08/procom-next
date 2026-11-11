'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { buttonPrimary, cardBase, cardTitle, inputBase, textareaBase } from '@/components/ui/cardStyles';
import {
  addBaseProduct,
  BASE_CUSTOM_DOMAIN_ERROR,
  BASE_PRODUCT_URL_ERROR,
  BASE_SHOP_URL_ERROR,
  baseProductIndexAfterAdd,
  baseProductIndexAfterDelete,
  baseProductIndexAfterMove,
  baseShopSectionVisible,
  MAX_BASE_PRODUCTS,
  MAX_SHOP_DESCRIPTION,
  SHOP_DESCRIPTION_HINT,
  moveBaseProduct,
  readBaseProductCandidate,
  readBaseShopCandidate,
  removeBaseProduct,
  replaceBaseProduct,
  shopDescriptionLength,
  trustedBaseShopUrl,
  trustedWidgetUrl,
  type BaseProductsSettings,
  type VerifiedBaseEmbed,
} from '@/lib/baseProducts';
import ShopDescription from '@/components/ShopDescription';
import styles from './BaseProductsBlock.module.css';

type Props = {
  uid: string;
  isEditable: boolean;
  initialUrls?: string[];
  initialSettings?: BaseProductsSettings;
  verifiedEmbeds?: readonly VerifiedBaseEmbed[] | null;
  verifiedShopUrl?: string | null;
  onDraftChange?: (urls: string[]) => void;
  onSettingsChange?: (settings: BaseProductsSettings) => void;
};

type CheckStatus = 'idle' | 'checking' | 'verified' | 'failed';
type BusyTarget = 'add' | number | null;

function sameUrls(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((url, index) => url === b[index]);
}

function moveDrafts(items: readonly string[], index: number, direction: -1 | 1): string[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(index, 1);
  if (item == null) return [...items];
  next.splice(target, 0, item);
  return next;
}

export default function BaseProductsBlock({
  uid,
  isEditable,
  initialUrls,
  initialSettings,
  verifiedEmbeds = null,
  verifiedShopUrl = null,
  onDraftChange,
  onSettingsChange,
}: Props) {
  const [urls, setUrls] = useState<string[]>(initialUrls ?? []);
  const [drafts, setDrafts] = useState<string[]>(initialUrls ?? []);
  const [input, setInput] = useState('');
  const [selected, setSelected] = useState(0);
  const [adding, setAdding] = useState((initialUrls ?? []).length === 0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<CheckStatus>('idle');
  const [draftNotice, setDraftNotice] = useState(false);
  const [busy, setBusy] = useState<BusyTarget>(null);
  const [slide, setSlide] = useState(0);
  const [description, setDescription] = useState(initialSettings?.description ?? '');
  const [shopUrl, setShopUrl] = useState(initialSettings?.shopUrl ?? '');
  const [shopError, setShopError] = useState<string | null>(null);
  const [shopStatus, setShopStatus] = useState<CheckStatus>('idle');
  const [sessionShopUrl, setSessionShopUrl] = useState<string | null>(null);
  const [sessionEmbeds, setSessionEmbeds] = useState<VerifiedBaseEmbed[]>(() =>
    verifiedEmbeds ? [...verifiedEmbeds] : []
  );
  const echoRef = useRef<string[] | null>(null);
  const settingsEchoRef = useRef<BaseProductsSettings | null>(null);
  const shopRequestRef = useRef(0);
  const checkingRef = useRef(false);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const widgets = urls.flatMap((url) => {
    const widgetUrl = trustedWidgetUrl(url, sessionEmbeds);
    if (!widgetUrl) return [];
    return [{ pageUrl: url, widgetUrl }];
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const incoming = initialUrls ?? [];
    if (echoRef.current && sameUrls(echoRef.current, incoming)) {
      echoRef.current = null;
      return;
    }
    setUrls(incoming);
    setDrafts(incoming);
    setError(null);
    setStatus('idle');
    setDraftNotice(false);
    setSlide(0);
    setSelected(0);
    setAdding(incoming.length === 0);
  }, [initialUrls]);

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
    setShopStatus('idle');
  }, [initialSettings]);

  useEffect(() => {
    if (!isEditable) return;
    const candidate = readBaseShopCandidate(shopUrl);
    if (!candidate || candidate.hostKind !== 'custom') return;
    if ((sessionShopUrl ?? verifiedShopUrl) === candidate.shopUrl) return;
    const requestId = shopRequestRef.current + 1;
    shopRequestRef.current = requestId;
    setShopStatus('checking');
    setShopError(null);
    const timer = setTimeout(() => {
      const raw = shopUrl;
      void (async () => {
        try {
          const res = await fetch(`/api/user/${encodeURIComponent(uid)}/base-shop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ url: raw }),
          });
          const data = (await res.json().catch(() => ({}))) as { error?: unknown; shopUrl?: unknown };
          if (!mountedRef.current || requestId !== shopRequestRef.current) return;
          if (!res.ok || data.shopUrl !== candidate.shopUrl) {
            setShopStatus('failed');
            setShopError(typeof data.error === 'string' ? data.error : BASE_CUSTOM_DOMAIN_ERROR);
            return;
          }
          setSessionShopUrl(candidate.shopUrl);
          setShopStatus('verified');
          setShopError(null);
        } catch {
          if (!mountedRef.current || requestId !== shopRequestRef.current) return;
          setShopStatus('failed');
          setShopError('接続先を確認できませんでした。しばらくしてから再度お試しください');
        }
      })();
    }, 400);
    return () => {
      clearTimeout(timer);
      if (shopRequestRef.current === requestId) shopRequestRef.current += 1;
    };
  }, [isEditable, sessionShopUrl, shopUrl, uid, verifiedShopUrl]);

  const commitSettings = (next: BaseProductsSettings) => {
    settingsEchoRef.current = next;
    setDescription(next.description);
    setShopUrl(next.shopUrl);
    onSettingsChange?.(next);
  };

  const commit = (next: string[], nextDrafts = next) => {
    echoRef.current = next;
    setUrls(next);
    setDrafts(nextDrafts);
    setError(null);
    onDraftChange?.(next);
  };

  const rememberEmbed = (embed: VerifiedBaseEmbed) => {
    setSessionEmbeds((current) => [
      ...current.filter((item) => item.productUrl !== embed.productUrl),
      embed,
    ]);
  };

  const verifyCustomUrl = async (raw: string, requestId: number): Promise<VerifiedBaseEmbed | null> => {
    const candidate = readBaseProductCandidate(raw);
    if (!candidate) {
      setStatus('failed');
      setError(BASE_PRODUCT_URL_ERROR);
      return null;
    }
    setStatus('checking');
    setError(null);
    try {
      const res = await fetch(`/api/user/${encodeURIComponent(uid)}/base-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: raw }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: unknown;
        productUrl?: unknown;
        widgetUrl?: unknown;
      };
      if (!mountedRef.current || requestId !== requestRef.current) return null;
      if (!res.ok || data.productUrl !== candidate.productUrl || data.widgetUrl !== candidate.widgetUrl) {
        setStatus('failed');
        setError(typeof data.error === 'string' ? data.error : BASE_CUSTOM_DOMAIN_ERROR);
        return null;
      }
      const embed = { productUrl: candidate.productUrl, widgetUrl: candidate.widgetUrl };
      rememberEmbed(embed);
      setStatus('verified');
      return embed;
    } catch {
      if (!mountedRef.current || requestId !== requestRef.current) return null;
      setStatus('failed');
      setError('接続先を確認できませんでした。しばらくしてから再度お試しください');
      return null;
    }
  };

  const beginCheck = (target: BusyTarget): number | null => {
    if (checkingRef.current) return null;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    checkingRef.current = true;
    setBusy(target);
    setDraftNotice(false);
    return requestId;
  };

  const endCheck = (requestId: number) => {
    if (requestId === requestRef.current) {
      checkingRef.current = false;
      setBusy(null);
    }
  };

  const onAdd = async () => {
    const preview = addBaseProduct(urls, input);
    if (!preview.ok) {
      setStatus('failed');
      setError(preview.error);
      return;
    }
    const candidate = readBaseProductCandidate(preview.urls[preview.urls.length - 1] ?? '');
    if (!candidate) {
      setStatus('failed');
      setError(BASE_PRODUCT_URL_ERROR);
      return;
    }
    if (candidate.hostKind === 'custom') {
      const requestId = beginCheck('add');
      if (requestId == null) return;
      try {
        const embed = await verifyCustomUrl(input, requestId);
        if (!embed || !mountedRef.current || requestId !== requestRef.current) return;
        setDraftNotice(true);
        setInput('');
        setAdding(false);
        setSelected(baseProductIndexAfterAdd(urls.length));
        commit(preview.urls);
      } finally {
        endCheck(requestId);
      }
      return;
    }
    setStatus('idle');
    setDraftNotice(true);
    setInput('');
    setAdding(false);
    setSelected(baseProductIndexAfterAdd(urls.length));
    commit(preview.urls);
  };

  const onReplace = async (index: number) => {
    const raw = drafts[index] ?? '';
    const preview = replaceBaseProduct(urls, index, raw);
    if (!preview.ok) {
      setStatus('failed');
      setError(preview.error);
      return;
    }
    if (sameUrls(urls, preview.urls)) {
      setError(null);
      setStatus('idle');
      return;
    }
    const candidate = readBaseProductCandidate(preview.urls[index] ?? '');
    if (!candidate) {
      setStatus('failed');
      setError(BASE_PRODUCT_URL_ERROR);
      return;
    }
    if (candidate.hostKind === 'custom') {
      const requestId = beginCheck(index);
      if (requestId == null) return;
      try {
        const embed = await verifyCustomUrl(raw, requestId);
        if (!embed || !mountedRef.current || requestId !== requestRef.current) return;
        setDraftNotice(true);
        commit(preview.urls);
      } finally {
        endCheck(requestId);
      }
      return;
    }
    setStatus('idle');
    setDraftNotice(true);
    commit(preview.urls);
  };

  const onRemove = (index: number) => {
    if (checkingRef.current) return;
    requestRef.current += 1;
    checkingRef.current = false;
    setBusy(null);
    const preview = removeBaseProduct(urls, index);
    if (!preview.ok) {
      setError(preview.error);
      return;
    }
    setStatus('idle');
    setDraftNotice(true);
    const nextSelected = baseProductIndexAfterDelete(index, urls.length);
    setAdding(nextSelected == null);
    setSelected(nextSelected ?? 0);
    commit(preview.urls, drafts.filter((_, itemIndex) => itemIndex !== index));
  };

  const onMove = (index: number, direction: -1 | 1) => {
    if (checkingRef.current) return;
    const preview = moveBaseProduct(urls, index, direction);
    if (!preview.ok || sameUrls(urls, preview.urls)) return;
    setDraftNotice(true);
    setAdding(false);
    setSelected(baseProductIndexAfterMove(index, direction, urls.length));
    commit(preview.urls, moveDrafts(drafts, index, direction));
  };

  const onCancelAdd = () => {
    requestRef.current += 1;
    checkingRef.current = false;
    setBusy(null);
    setStatus('idle');
    setError(null);
    setAdding(false);
  };

  const selectTab = (index: number) => {
    if (checkingRef.current) return;
    setAdding(false);
    setSelected(index);
    setError(null);
    setStatus('idle');
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (urls.length === 0 || checkingRef.current) return;
    let next = index;
    if (event.key === 'ArrowRight') next = Math.min(urls.length - 1, index + 1);
    else if (event.key === 'ArrowLeft') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = urls.length - 1;
    else return;
    event.preventDefault();
    selectTab(next);
    const tabUrl = urls[next];
    requestAnimationFrame(() => {
      if (!tabUrl) return;
      tabsRef.current?.querySelector<HTMLButtonElement>(`[data-tab-url="${CSS.escape(tabUrl)}"]`)?.focus();
    });
  };

  const syncScroller = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const cards = [...scroller.querySelectorAll<HTMLElement>('[data-base-card]')];
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
    const card = scroller?.querySelectorAll<HTMLElement>('[data-base-card]')[nextIndex];
    if (!scroller || !card) return;
    const left = card.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft;
    scroller.scrollTo({ left, behavior: 'smooth' });
    setSlide(nextIndex);
  };

  const shopLink = trustedBaseShopUrl(shopUrl, sessionShopUrl ?? verifiedShopUrl);
  const trimmedDescription = description.trim();
  const baseShopVisible = baseShopSectionVisible({
    productCount: widgets.length,
    description: trimmedDescription,
    shopLink,
  });
  if (!isEditable && !baseShopVisible) return null;

  const atLimit = urls.length >= MAX_BASE_PRODUCTS;
  const checking = busy != null;
  const selectedIndex = urls.length === 0 ? -1 : Math.min(Math.max(selected, 0), urls.length - 1);
  const selectedUrl = selectedIndex >= 0 ? urls[selectedIndex] : undefined;
  const showAddForm = adding;
  const showProductForm = !adding && selectedUrl != null;
  const selectedCandidate = readBaseProductCandidate(selectedUrl);
  const selectedHidden =
    selectedCandidate?.hostKind === 'custom' && trustedWidgetUrl(selectedUrl, sessionEmbeds) == null;

  return (
    <section className={styles.block} style={{ ...cardBase, width: '100%' }} aria-label="BASE SHOP">
      <h2 style={cardTitle}>BASE SHOP</h2>
      <div className={styles.stage} data-many={widgets.length > 1 ? 'true' : undefined}>
      {!isEditable && trimmedDescription ? (
        <div className={styles.lead}>
          <ShopDescription text={trimmedDescription} />
        </div>
      ) : null}
      {widgets.length > 0 ? (
        <div className={styles.slider}>
          {widgets.length > 1 ? (
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
            className={widgets.length === 1 ? styles.scrollerSingle : styles.scroller}
            role="region"
            aria-roledescription="carousel"
            aria-label="BASEの商品"
            onScroll={syncScroller}
          >
            {widgets.map(({ pageUrl, widgetUrl }) => (
              <div key={pageUrl} data-base-card className={styles.card}>
                {/* sandbox は公式ウィジェットの動作が未確認のため付けない */}
                <iframe
                  className={styles.frame}
                  src={widgetUrl}
                  title="BASEの商品"
                  width={220}
                  height={380}
                  loading="lazy"
                />
                <a className={styles.productLink} href={pageUrl} target="_blank" rel="noopener noreferrer">
                  商品ページを見る
                </a>
              </div>
            ))}
          </div>
          {widgets.length > 1 ? (
            <button
              type="button"
              className={styles.arrow}
              aria-label="次の商品"
              onClick={() => scrollTo(Math.min(widgets.length - 1, slide + 1))}
              disabled={slide >= widgets.length - 1}
            >
              ›
            </button>
          ) : null}
        </div>
      ) : null}
      {isEditable ? (
        <div className={styles.editor}>
          <p className={styles.notice}>
            追加、変更、削除、並び替えは下書きです。変更を保存するまでプロフィールには反映されません。
          </p>
          {urls.length > 0 ? (
            <div ref={tabsRef} className={styles.tabs} role="tablist" aria-label="登録したBASE商品">
              {urls.map((url, index) => {
                const active = !adding && index === selectedIndex;
                return (
                  <button
                    key={url}
                    type="button"
                    role="tab"
                    id={`base-product-tab-${index}`}
                    data-tab-url={url}
                    className={active ? styles.tabActive : styles.tab}
                    aria-selected={active}
                    aria-controls="base-product-panel"
                    aria-label={`商品${index + 1}`}
                    tabIndex={active || (adding && index === selectedIndex) ? 0 : -1}
                    disabled={checking}
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
          {showProductForm && selectedUrl ? (
            <div
              role="tabpanel"
              id="base-product-panel"
              aria-labelledby={`base-product-tab-${selectedIndex}`}
              className={styles.panel}
            >
              <p className={styles.order}>
                商品{selectedIndex + 1} / {urls.length}
              </p>
              <p className={styles.registered}>登録済みURL: {selectedUrl}</p>
              {selectedHidden && busy !== selectedIndex ? (
                <p className={styles.registered} role="status">
                  接続先を確認できないため、ウィジェットは表示していません。登録済みのURLは残しています。
                </p>
              ) : null}
              {busy === selectedIndex ? (
                <p className={styles.registered} role="status">
                  接続先を確認しています
                </p>
              ) : null}
              <label className={styles.fieldLabel}>
                商品{selectedIndex + 1}のURL
                <input
                  aria-label={`商品${selectedIndex + 1}のURL`}
                  inputMode="url"
                  value={drafts[selectedIndex] ?? selectedUrl}
                  disabled={checking}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDrafts((current) =>
                      current.map((item, itemIndex) => (itemIndex === selectedIndex ? value : item))
                    );
                    if (error) setError(null);
                  }}
                  style={{ ...inputBase, fontSize: 16 }}
                />
              </label>
              {error ? <p className={styles.error}>{error}</p> : null}
              {status === 'verified' ? (
                <p className={styles.registered} role="status">
                  接続先を確認しました。
                  {draftNotice ? '変更を保存するまでプロフィールには反映されません。' : null}
                </p>
              ) : null}
              <div className={styles.actions}>
                <button type="button" onClick={() => void onReplace(selectedIndex)} disabled={checking}>
                  {busy === selectedIndex ? '確認中' : '変更'}
                </button>
                <button type="button" onClick={() => onRemove(selectedIndex)} disabled={checking}>
                  削除
                </button>
                <button
                  type="button"
                  onClick={() => onMove(selectedIndex, -1)}
                  disabled={checking || selectedIndex === 0}
                >
                  順番を前に
                </button>
                <button
                  type="button"
                  onClick={() => onMove(selectedIndex, 1)}
                  disabled={checking || selectedIndex === urls.length - 1}
                >
                  順番を後ろに
                </button>
              </div>
            </div>
          ) : null}
          {showAddForm ? (
            <div className={styles.panel}>
              {busy === 'add' ? (
                <p className={styles.registered} role="status">
                  接続先を確認しています
                </p>
              ) : null}
              <label className={styles.fieldLabel}>
                追加するBASE商品URL
                <input
                  aria-label="BASE商品URL"
                  placeholder="https://shopname.thebase.in/items/12345678"
                  inputMode="url"
                  value={input}
                  disabled={checking}
                  onChange={(event) => {
                    setInput(event.target.value);
                    if (status === 'verified' || status === 'failed') {
                      setStatus('idle');
                      setDraftNotice(false);
                    }
                    if (error) setError(null);
                  }}
                  style={{ ...inputBase, fontSize: 16 }}
                />
              </label>
              {error ? <p className={styles.error}>{error}</p> : null}
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={() => void onAdd()}
                  disabled={checking}
                  style={{ ...buttonPrimary, minHeight: 44, opacity: checking ? 0.7 : 1 }}
                >
                  {busy === 'add' ? '確認中' : '登録'}
                </button>
                <button type="button" onClick={onCancelAdd} disabled={checking}>
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
                if (checkingRef.current) return;
                setAdding(true);
                setError(null);
                setStatus('idle');
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
              placeholder="https://shopname.thebase.in/"
              inputMode="url"
              value={shopUrl}
              onChange={(event) => {
                const next = event.target.value;
                commitSettings({ description, shopUrl: next });
                const candidate = readBaseShopCandidate(next);
                if (!next.trim() || candidate) setShopError(null);
                else setShopError(BASE_SHOP_URL_ERROR);
                if (!candidate || candidate.hostKind !== 'custom') setShopStatus('idle');
              }}
              style={{ ...inputBase, fontSize: 16 }}
            />
          </label>
          {shopStatus === 'checking' ? (
            <p className={styles.registered} role="status">
              接続先を確認しています
            </p>
          ) : null}
          {shopError ? <p className={styles.error}>{shopError}</p> : null}
          {shopStatus === 'verified' ? (
            <p className={styles.registered} role="status">
              接続先を確認しました。変更を保存するまでプロフィールには反映されません。
            </p>
          ) : null}
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
