'use client';

import { useEffect, useState } from 'react';
import SnsVisibilityToggle from './SnsVisibilityToggle';
import SnsHelpTooltip from './SnsHelpTooltip';
import { fetchUserApi } from '@/lib/userProfileClient';
import { buttonPrimary, cardActions, cardBody, cardPreviewArea, cardTitle, emptyStateBox, inputBase, snsCardBase } from '@/components/ui/cardStyles';

const TIKTOK_PLAYER_QUERY = 'autoplay=0&controls=1&music_info=1&description=1';

function tiktokPlayerSrc(videoId: string): string {
  return `https://www.tiktok.com/player/v1/${videoId}?${TIKTOK_PLAYER_QUERY}`;
}

function sameStringList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
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

                  return (
                    <div key={`${videoId}-${i}`} className="tiktok-wrapper">
                      <iframe
                        loading="lazy"
                        src={tiktokPlayerSrc(videoId)}
                        title="TikTok動画"
                        allow="fullscreen; encrypted-media; picture-in-picture"
                      />
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ flex: '1 1 100%', textAlign: 'center' }}
                      >
                        TikTokで投稿を見る
                      </a>
                    </div>
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
