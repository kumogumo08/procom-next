'use client';

import { useEffect, useState } from 'react';

interface Props {
  uid: string;
  isEditable: boolean;
}

export default function TikTokEmbed({ uid, isEditable }: Props) {
  const [urls, setUrls] = useState<string[]>([]);
  const [loadedUrls, setLoadedUrls] = useState<string[]>([]);

  // 🔽 Firestoreから初期データを取得
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/user/${uid}`);
        const data = await res.json();
        const profile = data.profile || {};
        const tiktok = (profile.tiktokUrls || [])
            .map((url: string) => url.trim())
            .filter((url: string) => url !== '')
            .slice(0, 3); // ← ✅ ここで初期ロードも最大3件に制限！
        setUrls(tiktok);
        setLoadedUrls(tiktok);
      } catch (e) {
        console.warn('TikTok情報の取得に失敗しました');
      }
    }
    fetchData();
  }, [uid]);

  // 🔽 TikTok埋め込みスクリプトを再実行
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).tiktokEmbedLoad) {
      (window as any).tiktokEmbedLoad();
    } else if (typeof window !== 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://www.tiktok.com/embed.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, [loadedUrls]);

  // 🔽 保存処理
    const handleSave = async () => {
    const cleaned = urls
        .map(url => url.trim())
        .filter(url => url !== '')
        .slice(0, 3); // 最大3件に制限

    await fetch(`/api/user/${uid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: { tiktokUrls: cleaned } }),
    });

    setLoadedUrls(cleaned);
    setUrls(cleaned); 
    alert('TikTokリンクを保存しました');
    };

  // 🔽 動画IDをURLから抽出
  const extractVideoId = (url: string): string => {
    const match = url.match(/video\/(\d+)/);
    return match ? match[1] : '';
  };

  return (
    <div className="sns-bottom-row">
      <div className="sns-item" id="tiktok-section">
        <h2>TikTok動画を登録（最大3つ）</h2>

        {/* 🔽 入力欄 */}
      {isEditable && (
        <div className="sns-section">
          {urls.map((url, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '10px',
              }}
            >
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

          <button onClick={handleSave} className="auth-only">保存</button>
        </div>
      )}


        {/* 🔽 表示エリア */}
        <div id="tiktok-container" className="tiktok-grid">
          {loadedUrls.map((url, i) => (
            <div key={i} className="tiktok-wrapper">
              <blockquote
                className="tiktok-embed"
                cite={url}
                data-video-id={extractVideoId(url)}
              >
                <a href={url}>TikTok</a>
              </blockquote>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
