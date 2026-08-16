'use client';

import { useEffect, useState } from 'react';
import SnsVisibilityToggle from './SnsVisibilityToggle';
import SnsHelpTooltip from './SnsHelpTooltip';
import { fetchUserApi } from '@/lib/userProfileClient';
import {
  cardActions,
  cardBody,
  cardTitle,
  emptyStateBox,
  inputBase,
  snsCardBase,
} from '@/components/ui/cardStyles';
import { buildXProfileUrl, formatXHandle, normalizeXUsername } from '@/lib/xUsername';

type Props = {
  uid: string;
  isEditable: boolean;
  hasInitialProfile?: boolean;
  initialUsername?: string;
  initialShowX?: boolean;
  onDraftChange?: (draft: { xUsername: string; showX: boolean }) => void;
};

/** 公開プロフィールと同じ [Xロゴ][アバター][@ユーザー名] 横長リンク */
function XProfileLinkRow({ username }: { username: string }) {
  const normalized = normalizeXUsername(username);
  const profileUrl = buildXProfileUrl(normalized);
  const handleLabel = formatXHandle(normalized);

  if (!normalized || !profileUrl) return null;

  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="sns-link-row"
      aria-label={`${handleLabel}（外部リンク）`}
    >
      <span className="sns-link-row__brand-slot">
        <img
          className="sns-link-row__brand"
          src="/icons/x.svg"
          alt=""
          width={18}
          height={18}
          aria-hidden="true"
        />
      </span>
      <img
        className="sns-link-row__avatar"
        src={`https://unavatar.io/x/${normalized}`}
        alt=""
        width={30}
        height={30}
      />
      <span className="sns-link-row__label">{handleLabel}</span>
    </a>
  );
}

export default function XEmbed({
  uid,
  isEditable,
  hasInitialProfile,
  initialUsername,
  initialShowX,
  onDraftChange,
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

  useEffect(() => {
    onDraftChange?.({ xUsername: inputValue, showX });
  }, [inputValue, showX, onDraftChange]);

  const publicUsername = normalizeXUsername(username);
  const hasXContent = Boolean(publicUsername && buildXProfileUrl(publicUsername));
  const canShowPublicLink = Boolean(showX && hasXContent);

  // 編集画面プレビュー: 入力中の値を即時反映（不正・空は非表示）
  const previewUsername = normalizeXUsername(inputValue);
  const canShowPreview = Boolean(previewUsername && showX && buildXProfileUrl(previewUsername));

  // ✅ フックの後で return 条件を判定
  if (loading) return null;

  if (!isEditable && !canShowPublicLink) return null;

  // 公開プロフィール: [Xアイコン] [プロフィール画像] @username の横長リンクのみ
  if (!isEditable) {
    return <XProfileLinkRow username={publicUsername} />;
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
      </div>

      {canShowPreview && (
        <div style={{ flex: 1, display: 'grid', gap: 12 }}>
          <XProfileLinkRow username={previewUsername} />
        </div>
      )}

      {(!previewUsername || showX === false) && (
        <div style={{ flex: 1 }}>
          <div style={emptyStateBox}>未設定（ユーザー名を入力するとここに表示されます）</div>
        </div>
      )}

      <div
        style={{
          ...cardActions,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <SnsVisibilityToggle label="Xを表示する" checked={showX} onChange={setShowX} />
          <SnsHelpTooltip />
        </div>
      </div>
    </div>
  );
}
