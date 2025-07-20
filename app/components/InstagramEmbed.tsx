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

  // 🔹 初期データ取得
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/user/${uid}`);
        const data = await res.json();
        const profile = data.profile || {};

        if (profile.instagramPostUrl) {
          const fixedUrl = profile.instagramPostUrl.endsWith('/')
            ? profile.instagramPostUrl
            : profile.instagramPostUrl + '/';
          setUrl(fixedUrl);
          setLoadedUrl(fixedUrl);
        }

        setShowInstagram(profile.settings?.showInstagram ?? true);
      } catch (err) {
        console.warn('Instagram情報の取得に失敗しました');
      } finally {
        setIsLoaded(true);
      }
    }
    fetchData();
  }, [uid]);

  // 🔹 Instagram embed.js 動的読み込み＋埋め込み実行
  // 🔁 外でフラグを定義（複数実行を防ぐ）
const embedScriptLoadedRef = useRef(false); 
const lastProcessedUrlRef = useRef<string | null>(null);
const scriptAppendedRef = useRef(false); // ✅ scriptが追加されたか判定

useEffect(() => {
  if (!loadedUrl || !showInstagram) return;
  if (lastProcessedUrlRef.current === loadedUrl) return;

  const container = embedRef.current;
  if (!container) return;

  container.innerHTML = '';

  const block = document.createElement('blockquote');
  block.className = 'instagram-media';
  block.setAttribute('data-instgrm-permalink', loadedUrl);
  block.setAttribute('data-instgrm-version', '14');
  block.setAttribute('data-instgrm-captioned', ''); // ← キャプション表示ON
  block.style.width = '100%';
  block.style.margin = '20px auto';
  container.appendChild(block);

  const processEmbed = () => {
    try {
      (window as any).instgrm?.Embeds?.process();
      lastProcessedUrlRef.current = loadedUrl;
    } catch (err) {
      console.warn('Instagram埋め込み処理エラー:', err);
    }
  };

  const isProcessAvailable = (window as any).instgrm?.Embeds?.process;

  if (isProcessAvailable) {
    processEmbed();
  } else if (!embedScriptLoadedRef.current && !scriptAppendedRef.current) {
    const script = document.createElement('script');
    script.src = 'https://www.instagram.com/embed.js';
    script.async = true;
    script.onload = () => {
      embedScriptLoadedRef.current = true;
      processEmbed();
    };
    document.body.appendChild(script);
    scriptAppendedRef.current = true;
  }

}, [loadedUrl, showInstagram]);


const isValidInstagramUrl = (url: string) => {
  return /^https:\/\/(www\.)?instagram\.com\/p\/[a-zA-Z0-9_-]+\/?$/.test(url);
};

const handleSave = async () => {
  try {
    const fixedUrl = url.endsWith('/') ? url : url + '/';

    if (!isValidInstagramUrl(fixedUrl)) {
      alert('⚠️ 正しいInstagram投稿URLを入力してください（例: https://www.instagram.com/p/xxxxxx/）');
      return;
    }

    const res = await fetch(`/api/user/${uid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        profile: {
          instagramPostUrl: fixedUrl,
          settings: { showInstagram },
        },
      }),
    });

    if (!res.ok) throw new Error('保存失敗');
    setLoadedUrl(fixedUrl);
    alert('Instagramリンクを保存しました');
  } catch (err) {
    console.error('保存エラー:', err);
    alert('保存に失敗しました');
  }
};


  // 🔹 表示制御
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
  <div ref={embedRef}></div>
)}

    </div>
  );
}
