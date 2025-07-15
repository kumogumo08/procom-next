'use client';

import { useEffect, useState, useRef } from 'react';
import SnsVisibilityToggle from './SnsVisibilityToggle';
import SnsHelpTooltip from './SnsHelpTooltip';

interface Props {
  uid: string;
  isEditable: boolean;
}

export default function InstagramEmbed({ uid, isEditable }: Props) {
  const [url, setUrl] = useState('');
  const [loadedUrl, setLoadedUrl] = useState('');
  const [showInstagram, setShowInstagram] = useState<boolean | undefined>(undefined);
  const [isLoaded, setIsLoaded] = useState(false);
  const embedRef = useRef<HTMLDivElement>(null);

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

        if (profile.settings?.showInstagram !== undefined) {
          setShowInstagram(profile.settings.showInstagram);
        } else {
          setShowInstagram(true); // デフォルト true
        }
      } catch (err) {
        console.warn('Instagram情報の取得に失敗しました');
      } finally {
        setIsLoaded(true);
      }
    }
    fetchData();
  }, [uid]);

  useEffect(() => {
    if (!loadedUrl || !showInstagram) return;

    const processInstagram = () => {
      try {
        (window as any).instgrm.Embeds.process();
      } catch (err) {
        console.warn('Instagram埋め込み処理エラー:', err);
      }
    };

    if (!(window as any).instgrm) {
      const script = document.createElement('script');
      script.src = 'https://www.instagram.com/embed.js';
      script.async = true;
      script.onload = () => {
        setTimeout(processInstagram, 100);
      };
      document.body.appendChild(script);
    } else {
      setTimeout(processInstagram, 100);
    }
  }, [loadedUrl, showInstagram]);

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/user/${uid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          profile: {
            instagramPostUrl: url,
            settings: {
              showInstagram,
            },
          },
        }),
      });

      if (!res.ok) throw new Error('保存失敗');
      setLoadedUrl(url);
      alert('Instagramリンクを保存しました');
    } catch (err) {
      console.error('保存エラー:', err);
      alert('保存に失敗しました');
    }
  };

  // ✅ フックの後に早期 return
  if (!isEditable && showInstagram === false) {
    return null;
  }

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
            style={{ width: '100%', marginBottom: '6px' }}
          />
          <p style={{ fontSize: '12px', color: '#555' }}>
            プロフィールページまたはお気に入りのインスタ画像URLをご入力ください
          </p>
          <button onClick={handleSave} style={{ marginTop: '10px' }}>
            保存
          </button>

          <SnsVisibilityToggle
            label="Instagramを表示する"
            checked={showInstagram ?? true}
            onChange={setShowInstagram}
          />
          <SnsHelpTooltip />
        </>
      )}

      {isLoaded && loadedUrl && showInstagram && (
        <div ref={embedRef}>
          <blockquote
            className="instagram-media"
            data-instgrm-permalink={loadedUrl}
            data-instgrm-version="14"
            style={{ width: '100%', margin: '20px auto' }}
          ></blockquote>
        </div>
      )}
    </div>
  );
}
