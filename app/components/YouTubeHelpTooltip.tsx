'use client';

import { useEffect, useState } from 'react';

export default function YouTubeHelpTooltip() {
  const [show, setShow] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // ✅ ログイン状態を確認
  useEffect(() => {
    const checkLogin = async () => {
      try {
        const res = await fetch('/api/session');
        const data = await res.json();
        if (data?.loggedIn) {
          setIsLoggedIn(true);
        }
      } catch (err) {
        console.error('ログイン確認失敗:', err);
      }
    };
    checkLogin();
  }, []);

  if (!isLoggedIn) return null; // ✅ 未ログインなら表示しない

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* ❓アイコン（デザイン統一） */}
      <span
        onClick={() => setShow(!show)}
        style={{
          cursor: 'pointer',
          marginLeft: '6px',
          color: '#1d72f3',
          background: '#eaf3ff',
          border: '1px solid #b3d4fc',
          borderRadius: '50%',
          width: '20px',
          height: '20px',
          display: 'inline-flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontWeight: 'bold',
          fontSize: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
        title="YouTube動画の説明"
      >
        ?
      </span>

      {/* ツールチップ本体 */}
      {show && (
        <div
          style={{
            position: 'absolute',
            top: '28px',
            left: 0,
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            padding: '10px',
            borderRadius: '6px',
            width: '280px',
            fontSize: '13px',
            zIndex: 100,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <p style={{ marginBottom: '8px' }}>
            ※YouTube動画のURLは希望の動画ページで「共有」ボタン → 「コピー」でURLを取得できます。
          </p>
          <p style={{ margin: 0 }}>
            ※チャンネルIDは YouTube にログイン後、「設定 → 詳細設定」で確認できます。
          </p>
        </div>
      )}
    </div>
  );
}
