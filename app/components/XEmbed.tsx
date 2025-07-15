'use client';

import { useEffect, useState } from 'react';
import SnsVisibilityToggle from './SnsVisibilityToggle';
import SnsHelpTooltip from './SnsHelpTooltip';

type Props = {
  uid: string;
  isEditable: boolean;
};

export default function XEmbed({ uid, isEditable }: Props) {
  const [username, setUsername] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [showX, setShowX] = useState<boolean>(true); // 初期値 true に修正
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchXUsername() {
      try {
        const res = await fetch(`/api/user/${uid}`);
        const data = await res.json();
        const profile = data?.profile || {};
        const name = profile.xUsername || '';
        const flag = profile.settings?.showX;

        setUsername(name);
        setInputValue(name);
        setShowX(flag !== undefined ? flag : true); // undefined のとき true
      } catch (err) {
        console.warn('Xユーザー名の取得に失敗:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchXUsername();
  }, [uid]);

const handleSave = async () => {
  if (showX && !inputValue.trim()) {
    alert('ユーザー名を入力してください');
    return;
  }

  try {
    const res = await fetch(`/api/user/${uid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: {
          xUsername: inputValue.trim(),
          settings: {
            showX: showX,
          },
        },
      }),
    });

    if (!res.ok) throw new Error('保存失敗');
    alert('Xユーザー名を保存しました');
    setUsername(inputValue.trim());
  } catch (err) {
    alert('保存に失敗しました');
  }
};

  const profileUrl = username ? `https://x.com/${username}` : '';

  // ✅ フックの後で return 条件を判定
  if (loading) return null;

  if (!isEditable && (!username || showX === false)) return null;

  return (
    <div className="sns-item">
      <h2>X（旧Twitter）</h2>

      {isEditable && (
        <div style={{ marginBottom: 10 }}>
          <input
            type="text"
            placeholder="ユーザー名（@なし）"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            style={{ padding: '6px', width: '100%', maxWidth: 400 }}
          />
          <button onClick={handleSave} style={{ marginTop: 8 }}>保存</button>
          <SnsVisibilityToggle
            label="Xを表示する"
            checked={showX}
            onChange={setShowX}
          />
          <SnsHelpTooltip />
        </div>
      )}

      {username && showX && (
        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', fontWeight: 'bold', marginBottom: 8 }}
          >
            @{username} さんのXプロフィールを見る
          </a>
          <a href={profileUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={`https://unavatar.io/x/${username}`}
              alt={`${username} のプロフィール画像`}
              style={{
                width: '100%',
                maxWidth: 500,
                borderRadius: 12,
              }}
            />
          </a>
        </div>
      )}
    </div>
  );
}
