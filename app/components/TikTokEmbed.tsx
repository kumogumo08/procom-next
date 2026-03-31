'use client';

import { useEffect, useState } from 'react';
import SnsVisibilityToggle from './SnsVisibilityToggle';
import SnsHelpTooltip from './SnsHelpTooltip';
import { fetchUserApi } from '@/lib/userProfileClient';
import { buttonPrimary, buttonRowRight, cardBase, cardBody, cardTitle, inputBase } from '@/components/ui/cardStyles';

interface Props {
  uid: string;
  isEditable: boolean;
  hasInitialProfile?: boolean;
  initialUrls?: string[];
  initialShowTikTok?: boolean;
}

export default function TikTokEmbed({
  uid,
  isEditable,
  hasInitialProfile,
  initialUrls,
  initialShowTikTok,
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

  // 🔽 スクリプト読み込み
  useEffect(() => {
    if (!showTikTok || loadedUrls.length === 0) return;

    const script = document.createElement('script');
    script.src = 'https://www.tiktok.com/embed.js';
    script.async = true;

    script.onload = () => {
      if (typeof window !== 'undefined' && (window as any).tiktokEmbedLoad) {
        (window as any).tiktokEmbedLoad();
      }
    };

    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [loadedUrls, showTikTok]);

  if (!isEditable && !showTikTok) return null;

  const handleSave = async () => {
    const cleaned = urls
      .map(url => url.trim())
      .filter(url => url !== '')
      .slice(0, 3);

    await fetch(`/api/user/${uid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: {
          tiktokUrls: cleaned,
          settings: { showTikTok },
        },
      }),
    });

    setLoadedUrls(cleaned);
    setUrls(cleaned);
    alert('TikTokリンクを保存しました');
  };

    const extractVideoId = (url: string): string => {
      const match = url.match(/video\/(\d+)/);
      if (!match) {
        console.warn('⚠ TikTok URLが無効です:', url);
        return ''; // ← 空文字で明示的にreturn
      }
      return match[1];
    };


  return (
    <div className="sns-bottom-row">
      <div className="sns-item" id="tiktok-section" style={cardBase}>
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
            <div style={buttonRowRight}>
              <button onClick={handleSave} className="auth-only" style={buttonPrimary}>
                保存
              </button>
            </div>
            <SnsVisibilityToggle
              label="TikTokを表示する"
              checked={showTikTok}
              onChange={setShowTikTok}
            />
            <SnsHelpTooltip />
          </div>
        )}

        {showTikTok && (
          <div id="tiktok-container" className="tiktok-grid">
            {loadedUrls.map((url, i) => {
              const videoId = extractVideoId(url);
              if (!videoId) return null;
              
              const embedHtml = `
                <blockquote class="tiktok-embed"
                  cite="${url}"
                  data-video-id="${videoId}"
                  style="max-width: 325px; min-width: 325px;">
                  <section>Loading...</section>
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
        )}
      </div>
    </div>
  );
}
