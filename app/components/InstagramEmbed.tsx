'use client';

import { useEffect, useState } from 'react';

interface Props {
  uid: string;
  isEditable: boolean;
}

export default function InstagramEmbed({ uid, isEditable }: Props) {
  const [url, setUrl] = useState('');
  const [loadedUrl, setLoadedUrl] = useState('');

  // 🔽 プロフィールからURL取得
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/user/${uid}`);
        const data = await res.json();
        const profile = data.profile || {};
        if (profile.instagramPostUrl) {
          setUrl(profile.instagramPostUrl);
          setLoadedUrl(profile.instagramPostUrl);
        }
      } catch (err) {
        console.warn('Instagram情報の取得に失敗しました');
      }
    }
    fetchData();
  }, [uid]);

  // 🔽 Instagram埋め込みスクリプトの再読み込み
useEffect(() => {
  if (loadedUrl && typeof window !== 'undefined' && (window as any).instgrm) {
    setTimeout(() => {
      try {
        (window as any).instgrm.Embeds.process();
      } catch (err) {
        console.warn('Instagram埋め込み処理エラー:', err);
      }
    }, 100); // 少しだけ遅延させることでDOM更新が確実に終わる
  }
}, [loadedUrl]);

  // 🔽 保存処理
  const handleSave = async () => {
    await fetch(`/api/user/${uid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: {
          instagramPostUrl: url, // ✅ サーバーと一致させる！
        },
      }),
    });
    setLoadedUrl(url);
    alert('Instagramリンクを保存しました');
  };

  return (
    <div className="sns-item">
      <h2>Instagram</h2>
      {isEditable && (
        <>
          <input
            type="text"
            placeholder="Instagram投稿のURL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p style={{ fontSize: '12px', color: '#555'}}>
            プロフィールページまたはお気に入りのインスタ画像URLをご入力ください
          </p>
          <button onClick={handleSave}>保存</button>
        </>
      )}
      {loadedUrl && (
        <blockquote
          key={loadedUrl}
          className="instagram-media"
          data-instgrm-permalink={loadedUrl}
          data-instgrm-version="14"
          style={{ width: '100%', margin: '20px auto' }}
        />
      )}
    </div>
  );
}
