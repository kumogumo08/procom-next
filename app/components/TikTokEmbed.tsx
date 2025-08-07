'use client';

import { useEffect, useState } from 'react';
import SnsVisibilityToggle from './SnsVisibilityToggle';
import SnsHelpTooltip from './SnsHelpTooltip';

interface Props {
  uid: string;
  isEditable: boolean;
}

export default function TikTokEmbed({ uid, isEditable }: Props) {
  const [urls, setUrls] = useState<string[]>([]);
  const [loadedUrls, setLoadedUrls] = useState<string[]>([]);
  const [showTikTok, setShowTikTok] = useState(true);

  // 🔽 データ取得 & 短縮URLの展開処理
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/user/${uid}`);
        const data = await res.json();
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
    fetchData();
  }, [uid]);

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
      <div className="sns-item" id="tiktok-section">
        <h2>TikTok動画を登録（最大3つ）</h2>

        {isEditable && (
          <div className="sns-section">
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
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const updated = [...urls];
                    updated.splice(i, 1);
                    setUrls(updated);
                  }}
                  style={{
                    marginLeft: '8px',
                    background: 'red',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            {urls.filter(url => url.trim() !== '').length < 3 && (
              <button onClick={() => setUrls([...urls, ''])}>＋ 入力欄を追加</button>
            )}
            <button onClick={handleSave} className="auth-only" style={{ marginTop: '10px' }}>
              保存
            </button>
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
