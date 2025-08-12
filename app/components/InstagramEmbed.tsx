'use client';

import { useEffect, useState, useRef } from 'react';
import SnsVisibilityToggle from './SnsVisibilityToggle';
import SnsHelpTooltip from './SnsHelpTooltip';

type Props = { uid: string; isEditable: boolean };

// URL正規化（OKなら統一URLを返す／NGなら null）
const normalizeInstagramUrl = (raw: string): string | null => {
  try {
    const u = new URL(raw.trim());
    if (!/^(www\.)?instagram\.com$/.test(u.hostname)) return null;

    const seg = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    if (seg.length < 2) return null;

    const type = seg[0]; // p | reel | tv
    const id = seg[1];
    if (!/^(p|reel|tv)$/.test(type)) return null;
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;

    return `https://www.instagram.com/${type}/${id}/`;
  } catch {
    return null;
  }
};

export default function InstagramEmbed({ uid, isEditable }: Props) {
  const [url, setUrl] = useState('');
  const [loadedUrl, setLoadedUrl] = useState('');
  const [showInstagram, setShowInstagram] = useState<boolean | undefined>(undefined);
  const [isLoaded, setIsLoaded] = useState(false);

  const embedRef = useRef<HTMLDivElement>(null);
  const embedScriptLoadedRef = useRef(false);
  const scriptAppendedRef = useRef(false);
  const lastProcessedUrlRef = useRef<string | null>(null);

  // 初期データ取得
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/user/${uid}`);
        const data = await res.json();
        const profile = data.profile || {};

        if (profile.instagramPostUrl) {
          const normalized = normalizeInstagramUrl(profile.instagramPostUrl);
          if (normalized) {
            setUrl(normalized);
            setLoadedUrl(normalized);
          }
        }
        setShowInstagram(profile.settings?.showInstagram ?? true);
      } catch {
        console.warn('Instagram情報の取得に失敗しました');
      } finally {
        setIsLoaded(true);
      }
    })();
  }, [uid]);

  // 埋め込み処理（保存済みの loadedUrl を使用）
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
    block.setAttribute('data-instgrm-captioned', '');
    block.style.width = '100%';
    block.style.margin = '20px auto';
    container.appendChild(block);

    const process = () => {
      try {
        (window as any).instgrm?.Embeds?.process();
        lastProcessedUrlRef.current = loadedUrl;
      } catch (err) {
        console.warn('Instagram埋め込み処理エラー:', err);
      }
    };

    const available = (window as any).instgrm?.Embeds?.process;
    if (available) {
      process();
    } else if (!embedScriptLoadedRef.current && !scriptAppendedRef.current) {
      const script = document.createElement('script');
      script.src = 'https://www.instagram.com/embed.js';
      script.async = true;
      script.onload = () => {
        embedScriptLoadedRef.current = true;
        process();
      };
      document.body.appendChild(script);
      scriptAppendedRef.current = true;
    }

    // クリーンアップ（ページ遷移時に空に）
    return () => {
      if (container) container.innerHTML = '';
    };
  }, [loadedUrl, showInstagram]);

  // 保存
  const handleSave = async () => {
    try {
      let normalized: string | '';

      if (url.trim()) {
        const n = normalizeInstagramUrl(url);
        if (!n) {
          alert('⚠️ 正しいInstagram投稿URLを入力してください（例: https://www.instagram.com/p/xxxxx/ または /reel/ /tv/）');
          return;
        }
        normalized = n;
      } else {
        normalized = '';
      }

      const res = await fetch(`/api/user/${uid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          profile: {
            instagramPostUrl: normalized,
            settings: { showInstagram },
          },
        }),
      });

      if (!res.ok) throw new Error('保存失敗');
      setLoadedUrl(normalized);
      alert('Instagramリンクを保存しました');
    } catch (err) {
      console.error('保存エラー:', err);
      alert('保存に失敗しました');
    }
  };

  // 非編集かつ非表示設定なら描画しない
  if (!isEditable && showInstagram === false) return null;

  return (
    <div className="sns-item">
      <h2>Instagram</h2>

      {isEditable && (
        <>
          <input
            type="text"
            placeholder="Instagram投稿のURL（/p/xxxx/ /reel/xxxx/ /tv/xxxx/ のいずれか）"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ width: '100%', marginBottom: 6 }}
          />
          <p style={{ fontSize: 12, color: '#555' }}>
            お気に入りのinstagramのURLを入力してください。
          </p>
          <button onClick={handleSave} style={{ marginTop: 10 }}>
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

      {isLoaded && loadedUrl && showInstagram && <div ref={embedRef} />}
    </div>
  );
}
