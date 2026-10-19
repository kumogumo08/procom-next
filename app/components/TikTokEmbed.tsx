'use client';

import { useEffect, useState } from 'react';
import SnsVisibilityToggle from './SnsVisibilityToggle';
import SnsHelpTooltip from './SnsHelpTooltip';
import { fetchUserApi } from '@/lib/userProfileClient';
import { buttonPrimary, cardActions, cardBody, cardPreviewArea, cardTitle, emptyStateBox, inputBase, snsCardBase } from '@/components/ui/cardStyles';

const TIKTOK_EMBED_SRC = 'https://www.tiktok.com/embed.js';
/** 現行 embed.js が mount 中に sessionStorage へ書くキー */
const TIKTOK_MOUNTING_KEY = '__tt_embed__mounting';
const TIKTOK_SYNC_TIMEOUT_MS = 8000;

type TikTokEmbedLib = {
  render?: (nodes: HTMLElement[]) => Promise<void> | void;
};

type TikTokHostWindow = Window & {
  tiktokEmbed?: { lib?: TikTokEmbedLib };
  tiktokEmbedLoad?: () => void;
};

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sameStringList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function tiktokHostWindow(): TikTokHostWindow {
  return window as TikTokHostWindow;
}

function tiktokEmbedLib(): TikTokEmbedLib | undefined {
  return tiktokHostWindow().tiktokEmbed?.lib;
}

function tiktokMountInProgress(): boolean {
  try {
    return window.sessionStorage.getItem(TIKTOK_MOUNTING_KEY) === 'true';
  } catch {
    return false;
  }
}

function collectUnprocessedTikTokEmbeds(): HTMLElement[] {
  const root = document.getElementById('tiktok-container');
  if (!root) return [];
  return Array.from(root.querySelectorAll('blockquote.tiktok-embed')).filter(
    (node): node is HTMLElement => node instanceof HTMLElement && node.id === ''
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

let tiktokEmbedScriptPromise: Promise<void> | null = null;
let tiktokRenderQueue: Promise<void> = Promise.resolve();

function ensureTikTokEmbedScript(): Promise<void> {
  if (tiktokEmbedScriptPromise) return tiktokEmbedScriptPromise;

  tiktokEmbedScriptPromise = new Promise((resolve, reject) => {
    const fail = () => {
      tiktokEmbedScriptPromise = null;
      reject(new Error('TikTok embed.js load failed'));
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TIKTOK_EMBED_SRC}"]`
    );
    if (existing) {
      if (tiktokEmbedLib() || existing.dataset.ttEmbedLoaded === '1') {
        existing.dataset.ttEmbedLoaded = '1';
        resolve();
        return;
      }

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        existing.dataset.ttEmbedLoaded = '1';
        resolve();
      };
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', () => {
        if (settled) return;
        settled = true;
        existing.remove();
        fail();
      }, { once: true });
      window.setTimeout(() => {
        if (settled) return;
        if (tiktokEmbedLib() || tiktokMountInProgress()) {
          finish();
          return;
        }
        settled = true;
        fail();
      }, TIKTOK_SYNC_TIMEOUT_MS);
      return;
    }

    const script = document.createElement('script');
    script.src = TIKTOK_EMBED_SRC;
    script.async = true;
    script.dataset.ttEmbedLoaded = '0';
    script.addEventListener('load', () => {
      script.dataset.ttEmbedLoaded = '1';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => {
      script.remove();
      fail();
    }, { once: true });
    document.body.appendChild(script);
  });

  return tiktokEmbedScriptPromise;
}

function enqueueUnprocessedTikTokRender(): Promise<void> {
  const run = tiktokRenderQueue.then(async () => {
    const nodes = collectUnprocessedTikTokEmbeds();
    if (nodes.length === 0) return;
    const render = tiktokEmbedLib()?.render;
    if (render) {
      await Promise.resolve(render(nodes));
      return;
    }
    tiktokHostWindow().tiktokEmbedLoad?.();
  });
  tiktokRenderQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/**
 * embed.js は読み込み後に自分で mount する。
 * ここでは script を足し直さず、mount が拾わなかった blockquote だけ公式 lib.render に渡す。
 */
async function syncTikTokEmbeds(isCancelled: () => boolean): Promise<void> {
  await ensureTikTokEmbedScript();
  const started = Date.now();

  while (!isCancelled() && Date.now() - started < TIKTOK_SYNC_TIMEOUT_MS) {
    if (collectUnprocessedTikTokEmbeds().length === 0) return;

    if (typeof tiktokEmbedLib()?.render === 'function') {
      // 公式 mount が同じ turn で id を付けるのを先に終わらせる
      await delay(0);
      if (isCancelled() || collectUnprocessedTikTokEmbeds().length === 0) return;
      await enqueueUnprocessedTikTokRender();
      return;
    }

    await delay(50);
  }

  if (isCancelled() || collectUnprocessedTikTokEmbeds().length === 0) return;
  await enqueueUnprocessedTikTokRender();
}

interface Props {
  uid: string;
  isEditable: boolean;
  hasInitialProfile?: boolean;
  initialUrls?: string[];
  initialShowTikTok?: boolean;
  onDraftChange?: (draft: { tiktokUrls: string[]; showTikTok: boolean }) => void;
}

export default function TikTokEmbed({
  uid,
  isEditable,
  hasInitialProfile,
  initialUrls,
  initialShowTikTok,
  onDraftChange,
}: Props) {
  const [urls, setUrls] = useState<string[]>(initialUrls ?? []);
  const [loadedUrls, setLoadedUrls] = useState<string[]>(initialUrls ?? []);
  const [showTikTok, setShowTikTok] = useState(initialShowTikTok ?? true);

  // 🔽 データ取得 & 短縮URLの展開処理
  useEffect(() => {
    async function fetchData() {
      try {
        const data = await fetchUserApi(uid, { caller: 'TikTokEmbed', reason: 'initial load (tiktok settings)' });
        const profile = data.profile || {};
        const rawUrls = (profile.tiktokUrls || [])
          .map((url: string) => url.trim())
          .filter((url: string) => url !== '')
          .slice(0, 3);

        // ✅ 省略URLをすべて展開
        const resolved = await Promise.all(
          rawUrls.map(async (url: string) => {
            if (/^https:\/\/(vt|vm)\.tiktok\.com\//.test(url)) {
              try {
                const res = await fetch('/api/resolve-tiktok-url', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url }),
                });
                const data = await res.json();
                console.log('▶ TikTok展開後URL:', data.resolvedUrl);
                return data.resolvedUrl || url;
              } catch {
                return url;
              }
            } else {
              return url;
            }
          })
        );

        setUrls(resolved);
        setLoadedUrls(resolved);
        setShowTikTok(profile.settings?.showTikTok !== false);
      } catch (e) {
        console.warn('TikTok情報の取得に失敗しました');
      }
    }
    if (hasInitialProfile) return;
    fetchData();
  }, [uid, hasInitialProfile]);

  useEffect(() => {
    const cleaned = urls
      .map((url) => url.trim())
      .filter((url) => url !== '')
      .slice(0, 3);
    onDraftChange?.({ tiktokUrls: cleaned, showTikTok });
  }, [urls, showTikTok, onDraftChange]);

  useEffect(() => {
    if (!isEditable) return;
    const cleaned = urls
      .map((url) => url.trim())
      .filter((url) => url !== '')
      .slice(0, 3);
    setLoadedUrls((prev) => (sameStringList(prev, cleaned) ? prev : cleaned));
  }, [urls, isEditable]);

  const embedKey = loadedUrls.filter((url) => /video\/(\d+)/.test(url)).join('\n');

  // embed.js はページ内で1つだけ。URL文字列が同じ間は初期化し直さない。
  useEffect(() => {
    if (!showTikTok || embedKey === '') return;
    let cancelled = false;
    syncTikTokEmbeds(() => cancelled).catch((error: unknown) => {
      if (!cancelled) console.warn('TikTok埋め込みの読み込みに失敗しました', error);
    });
    return () => {
      cancelled = true;
    };
  }, [showTikTok, embedKey]);

  const extractVideoId = (url: string): string => {
    const match = url.match(/video\/(\d+)/);
    if (!match) {
      console.warn('⚠ TikTok URLが無効です:', url);
      return '';
    }
    return match[1];
  };

  const hasTikTokContent = loadedUrls.some((url) =>
    Boolean(url?.trim() && extractVideoId(url.trim()))
  );

  if (!isEditable && !(showTikTok && hasTikTokContent)) return null;

  return (
    <div className="sns-bottom-row">
      <div className="sns-item" id="tiktok-section" style={snsCardBase}>
        <h2 style={cardTitle}>TikTok</h2>

        {isEditable && (
          <div className="sns-section" style={cardBody}>
            {urls.map((url, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <input
                  type="text"
                  value={url}
                  placeholder={`TikTok URL ${i + 1}`}
                  onChange={async (e) => {
                    const inputUrl = e.target.value.trim();
                    const updated = [...urls];
                    updated[i] = inputUrl;
                    setUrls(updated);

                    if (/^https:\/\/(vt|vm)\.tiktok\.com\//.test(inputUrl)) {
                      try {
                        const res = await fetch('/api/resolve-tiktok-url', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ url: inputUrl }),
                        });
                        const data = await res.json();

                        if (data.resolvedUrl) {
                          console.log('▶ TikTok展開後URL:', data.resolvedUrl);
                          const updatedResolved = [...urls];
                          updatedResolved[i] = data.resolvedUrl;
                          setUrls(updatedResolved);
                        } else {
                          console.warn('変換に失敗:', data.error);
                        }
                      } catch (err) {
                        console.error('省略URLの展開に失敗:', err);
                      }
                    }
                  }}
                  className="tiktok-input"
                  style={{ ...inputBase, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const updated = [...urls];
                    updated.splice(i, 1);
                    setUrls(updated);
                  }}
                  style={{
                    marginLeft: 8,
                    height: 40,
                    minWidth: 40,
                    padding: '0 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#ef4444',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            {urls.filter(url => url.trim() !== '').length < 3 && (
              <button onClick={() => setUrls([...urls, ''])} style={{ ...buttonPrimary, justifySelf: 'start' }}>
                ＋ 入力欄を追加
              </button>
            )}
          </div>
        )}

        <div style={{ flex: 1 }}>
          {showTikTok && loadedUrls.length > 0 ? (
            <div style={cardPreviewArea}>
              <div id="tiktok-container" className="tiktok-grid">
                {loadedUrls.map((url, i) => {
                  const videoId = extractVideoId(url);
                  if (!videoId) return null;

                  const safeUrl = escapeHtmlAttr(url);
                  const embedHtml = `
                    <blockquote class="tiktok-embed"
                      cite="${safeUrl}"
                      data-video-id="${videoId}"
                      style="max-width: 325px; min-width: 325px;">
                      <section>
                        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">TikTokで投稿を見る</a>
                      </section>
                    </blockquote>
                  `;
                  return (
                    <div
                      key={i}
                      className="tiktok-wrapper"
                      dangerouslySetInnerHTML={{ __html: embedHtml }}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={emptyStateBox}>未設定（URLを入力するとここに表示されます）</div>
          )}
        </div>

        {isEditable && (
          <div style={cardActions}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <SnsVisibilityToggle
                label="TikTokを表示する"
                checked={showTikTok}
                onChange={setShowTikTok}
              />
              <SnsHelpTooltip />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
