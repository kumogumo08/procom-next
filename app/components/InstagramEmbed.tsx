'use client';

import { useEffect, useState } from 'react';
import SnsVisibilityToggle from './SnsVisibilityToggle';
import SnsHelpTooltip from './SnsHelpTooltip';
import { fetchUserApi } from '@/lib/userProfileClient';
import {
  buttonPrimary,
  cardActions,
  cardBody,
  cardTitle,
  emptyStateBox,
  inputBase,
  snsCardBase,
} from '@/components/ui/cardStyles';
import {
  buildInstagramProfileUrl,
  formatInstagramHandle,
  normalizeInstagramUsername,
} from '@/lib/instagramUsername';

type Props = {
  uid: string;
  isEditable: boolean;
  hasInitialProfile?: boolean;
  initialInstagramUrl?: string;
  initialShowInstagram?: boolean;
};

/** 公開プロフィールと同じ [Instagramロゴ][@ユーザー名] 横長リンク（プロフィール画像は非表示） */
function InstagramProfileLinkRow({ username }: { username: string }) {
  const normalized = normalizeInstagramUsername(username);
  const profileUrl = buildInstagramProfileUrl(normalized);
  const handleLabel = formatInstagramHandle(normalized);

  if (!normalized || !profileUrl) return null;

  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="sns-link-row"
      aria-label={`${handleLabel}（外部リンク）`}
    >
      <img
        className="sns-link-row__brand sns-link-row__brand--instagram"
        src="/icons/Instagram.svg"
        alt=""
        width={18}
        height={18}
        aria-hidden="true"
      />
      <span className="sns-link-row__label">{handleLabel}</span>
    </a>
  );
}

export default function InstagramEmbed({
  uid,
  isEditable,
  hasInitialProfile,
  initialInstagramUrl,
  initialShowInstagram,
}: Props) {
  const [username, setUsername] = useState(initialInstagramUrl ?? '');
  const [inputValue, setInputValue] = useState(initialInstagramUrl ?? '');
  const [showInstagram, setShowInstagram] = useState<boolean>(initialShowInstagram ?? true);
  const [loading, setLoading] = useState(!hasInitialProfile);

  useEffect(() => {
    async function fetchInstagramUsername() {
      try {
        const data = await fetchUserApi(uid, {
          caller: 'InstagramEmbed',
          reason: 'initial load (instagram settings)',
        });
        const profile = data?.profile || {};
        const name = profile.instagramPostUrl || '';
        const flag = profile.settings?.showInstagram;

        setUsername(name);
        setInputValue(name);
        setShowInstagram(flag !== undefined ? flag : true);
      } catch (err) {
        console.warn('Instagramユーザー名の取得に失敗:', err);
      } finally {
        setLoading(false);
      }
    }

    if (hasInitialProfile) return;
    fetchInstagramUsername();
  }, [uid, hasInitialProfile]);

  const handleSave = async () => {
    if (showInstagram && !inputValue.trim()) {
      alert('ユーザー名を入力してください');
      return;
    }

    const normalizedInput = inputValue.trim()
      ? normalizeInstagramUsername(inputValue)
      : '';

    if (inputValue.trim() && !normalizedInput) {
      alert(
        '正しいInstagramユーザー名を入力してください（例: username または https://www.instagram.com/username/）'
      );
      return;
    }

    try {
      const res = await fetch(`/api/user/${uid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          profile: {
            instagramPostUrl: normalizedInput,
            settings: {
              showInstagram,
            },
          },
        }),
      });

      if (!res.ok) throw new Error('保存失敗');
      alert('Instagramユーザー名を保存しました');
      setUsername(normalizedInput);
      setInputValue(normalizedInput);
    } catch (err) {
      console.error('保存エラー:', err);
      alert('保存に失敗しました');
    }
  };

  const publicUsername = normalizeInstagramUsername(username);
  const canShowPublicLink = Boolean(
    publicUsername && showInstagram && buildInstagramProfileUrl(publicUsername)
  );

  // 編集画面プレビュー: 入力中の値を即時反映（不正・空は非表示）
  const previewUsername = normalizeInstagramUsername(inputValue);
  const canShowPreview = Boolean(
    previewUsername && showInstagram && buildInstagramProfileUrl(previewUsername)
  );

  if (loading) return null;

  if (!isEditable && !canShowPublicLink) return null;

  // 公開プロフィール: [Instagramアイコン] [プロフィール画像] @username の横長リンクのみ
  if (!isEditable) {
    return <InstagramProfileLinkRow username={publicUsername} />;
  }

  return (
    <div className="sns-item" style={snsCardBase}>
      <h2 style={cardTitle}>Instagram</h2>

      <div style={cardBody}>
        <input
          type="text"
          placeholder="ユーザー名（@なし）"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          style={{ ...inputBase, maxWidth: 520 }}
        />
      </div>

      {canShowPreview && (
        <div style={{ flex: 1, display: 'grid', gap: 12 }}>
          <InstagramProfileLinkRow username={previewUsername} />
        </div>
      )}

      {(!previewUsername || showInstagram === false) && (
        <div style={{ flex: 1 }}>
          <div style={emptyStateBox}>未設定（ユーザー名を入力するとここに表示されます）</div>
        </div>
      )}

      <div
        style={{
          ...cardActions,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <SnsVisibilityToggle
            label="Instagramを表示する"
            checked={showInstagram}
            onChange={setShowInstagram}
          />
          <SnsHelpTooltip />
        </div>
        <button type="button" onClick={handleSave} style={buttonPrimary}>
          保存
        </button>
      </div>
    </div>
  );
}
