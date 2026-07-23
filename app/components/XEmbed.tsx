'use client';

import { useEffect, useState } from 'react';
import SnsVisibilityToggle from './SnsVisibilityToggle';
import SnsHelpTooltip from './SnsHelpTooltip';
import { fetchUserApi } from '@/lib/userProfileClient';
import {
  buttonPrimary,
  buttonRowRight,
  cardActions,
  cardBody,
  cardTitle,
  emptyStateBox,
  inputBase,
  snsCardBase,
} from '@/components/ui/cardStyles';
import { buildXProfileUrl, formatXHandle } from '@/lib/xUsername';

type Props = {
  uid: string;
  isEditable: boolean;
  hasInitialProfile?: boolean;
  initialUsername?: string;
  initialShowX?: boolean;
};

export default function XEmbed({
  uid,
  isEditable,
  hasInitialProfile,
  initialUsername,
  initialShowX,
}: Props) {
  const [username, setUsername] = useState(initialUsername ?? '');
  const [inputValue, setInputValue] = useState(initialUsername ?? '');
  const [showX, setShowX] = useState<boolean>(initialShowX ?? true); // 初期値 true
  const [loading, setLoading] = useState(!hasInitialProfile);

  useEffect(() => {
    async function fetchXUsername() {
      try {
        const data = await fetchUserApi(uid, { caller: 'XEmbed', reason: 'initial load (x settings)' });
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

    if (hasInitialProfile) return;
    fetchXUsername();
  }, [uid, hasInitialProfile]);

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

  const profileUrl = buildXProfileUrl(username);
  const handleLabel = formatXHandle(username);
  const canShowPublicLink = Boolean(username && showX && profileUrl);

  // ✅ フックの後で return 条件を判定
  if (loading) return null;

  if (!isEditable && !canShowPublicLink) return null;

  // 公開プロフィール: [Xアイコン] [プロフィール画像] @username の横長リンクのみ
  if (!isEditable) {
    return (
      <a
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="sns-link-row"
        aria-label={`${handleLabel}（外部リンク）`}
      >
        <img
          className="sns-link-row__brand"
          src="/icons/x.svg"
          alt=""
          width={18}
          height={18}
          aria-hidden="true"
        />
        <img
          className="sns-link-row__avatar"
          src={`https://unavatar.io/x/${username}`}
          alt=""
          width={30}
          height={30}
        />
        <span className="sns-link-row__label">{handleLabel}</span>
      </a>
    );
  }

  return (
    <div className="sns-item" style={snsCardBase}>
      <h2 style={cardTitle}>X（旧Twitter）</h2>

      <div style={cardBody}>
        <input
          type="text"
          placeholder="ユーザー名（@なし）"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          style={{ ...inputBase, maxWidth: 520 }}
        />
        <div style={buttonRowRight}>
          <button onClick={handleSave} style={buttonPrimary}>保存</button>
        </div>
      </div>

      {username && showX && profileUrl && (
        <div style={{ flex: 1, display: 'grid', gap: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}
            >
              @{username} さんのXプロフィールを見る
            </a>
          </div>
          <div style={{ minHeight: 220, borderRadius: 12, overflow: 'hidden', background: '#fafbfc', border: '1px solid #eef2f7', padding: 12 }}>
            <a href={profileUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
              <img
                src={`https://unavatar.io/x/${username}`}
                alt={`${username} のプロフィール画像`}
                style={{
                  width: '100%',
                  maxWidth: 520,
                  borderRadius: 12,
                  display: 'block',
                  margin: '0 auto',
                }}
              />
            </a>
          </div>
        </div>
      )}

      {(!username || showX === false) && (
        <div style={{ flex: 1 }}>
          <div style={emptyStateBox}>未設定（ユーザー名を入力するとここに表示されます）</div>
        </div>
      )}

      <div style={cardActions}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <SnsVisibilityToggle label="Xを表示する" checked={showX} onChange={setShowX} />
          <SnsHelpTooltip />
        </div>
      </div>
    </div>
  );
}
