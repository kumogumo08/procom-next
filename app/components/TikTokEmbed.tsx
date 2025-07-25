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

  // 🔽 データ取得
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/user/${uid}`);
        const data = await res.json();
        const profile = data.profile || {};
        const tiktok = (profile.tiktokUrls || [])
          .map((url: string) => url.trim())
          .filter((url: string) => url !== '')
          .slice(0, 3);

        setUrls(tiktok);
        setLoadedUrls(tiktok);
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

    const timeout = setTimeout(() => {
      const script = document.createElement('script');
      script.src = 'https://www.tiktok.com/embed.js';
      script.async = true;
      document.body.appendChild(script);
    }, 100);

    return () => clearTimeout(timeout);
  }, [loadedUrls, showTikTok]);

  // ✅ フックの後に早期 return を入れる（ここが大事）
  if (!isEditable && !showTikTok) {
    return null;
  }

  // 🔽 残りの処理
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
    return match ? match[1] : '';
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
                  onChange={(e) => {
                    const updated = [...urls];
                    updated[i] = e.target.value;
                    setUrls(updated);
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

            {urls.filter((url) => url.trim() !== '').length < 3 && (
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
              const embedUrl = `https://www.tiktok.com/embed/${videoId}`;
              return (
                <div key={i} className="tiktok-wrapper">
                  <iframe
                    src={embedUrl}
                    width="325"
                    height="570"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    style={{
                      border: 'none',
                      maxWidth: '100%',
                      borderRadius: '8px',
                    }}
                  ></iframe>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
