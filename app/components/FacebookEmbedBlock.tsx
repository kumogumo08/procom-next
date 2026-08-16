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
import {
  getFacebookDisplayName,
  isValidFacebookUrl,
  normalizeFacebookUrl,
} from '@/lib/facebookProfile';

type Props = {
  uid: string;
  isEditable: boolean;
  hasInitialProfile?: boolean;
  initialUrl?: string;
  initialFacebookUsername?: string;
  initialShowFacebook?: boolean;
  onDraftChange?: (draft: {
    facebookUrl: string;
    facebookUsername: string;
    showFacebook: boolean;
  }) => void;
};

/** 公開プロフィールと同じ [Facebookアイコン][表示名] 横長リンク */
function FacebookProfileLinkRow({
  url,
  displayName,
}: {
  url: string;
  displayName?: string;
}) {
  const label = getFacebookDisplayName(url, displayName);
  const href = normalizeFacebookUrl(url);
  const canLink = Boolean(href && isValidFacebookUrl(href));

  const content = (
    <>
      <span className="sns-link-row__icon sns-link-row__icon--facebook" aria-hidden>
        <i className="fab fa-facebook-square" />
      </span>
      <span className="sns-link-row__label">{label}</span>
    </>
  );

  if (!canLink) {
    return (
      <div className="sns-link-row sns-link-row--static" aria-label={label}>
        {content}
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="sns-link-row"
      aria-label={`${label}（外部リンク）`}
    >
      {content}
    </a>
  );
}

export default function FacebookEmbedBlock({
  uid,
  isEditable,
  hasInitialProfile,
  initialUrl,
  initialFacebookUsername,
  initialShowFacebook,
  onDraftChange,
}: Props) {
  const [fbUrl, setFbUrl] = useState(initialUrl ?? '');
  const [inputValue, setInputValue] = useState(initialUrl ?? '');
  const [facebookUsername, setFacebookUsername] = useState(initialFacebookUsername ?? '');
  const [usernameInput, setUsernameInput] = useState(initialFacebookUsername ?? '');
  const [showFacebook, setShowFacebook] = useState<boolean>(initialShowFacebook ?? true);
  const [loading, setLoading] = useState(!hasInitialProfile);

  useEffect(() => {
    async function fetchFacebookSettings() {
      try {
        const data = await fetchUserApi(uid, {
          caller: 'FacebookEmbedBlock',
          reason: 'initial load (facebook settings)',
        });
        const profile = data?.profile || {};
        const url = profile.facebookUrl || '';
        const name = profile.facebookUsername || '';
        const flag = profile.settings?.showFacebook;

        setFbUrl(url);
        setInputValue(url);
        setFacebookUsername(name);
        setUsernameInput(name);
        setShowFacebook(flag !== undefined ? flag : true);
      } catch (err) {
        console.warn('Facebook設定の取得に失敗:', err);
      } finally {
        setLoading(false);
      }
    }

    if (hasInitialProfile) return;
    fetchFacebookSettings();
  }, [uid, hasInitialProfile]);

  useEffect(() => {
    onDraftChange?.({
      facebookUrl: inputValue,
      facebookUsername: usernameInput,
      showFacebook,
    });
  }, [inputValue, usernameInput, showFacebook, onDraftChange]);

  const publicUrl = normalizeFacebookUrl(fbUrl);
  const hasFacebookContent = Boolean(publicUrl && isValidFacebookUrl(publicUrl));
  const canShowPublicLink = Boolean(showFacebook && hasFacebookContent);

  // 編集画面プレビュー: 入力中の値を即時反映
  const previewUrl = inputValue.trim();
  const previewNormalized = previewUrl ? normalizeFacebookUrl(previewUrl) : '';
  const hasPreviewContent = Boolean(previewUrl || usernameInput.trim());
  const canShowPreview = Boolean(showFacebook && hasPreviewContent);

  if (loading) return null;

  if (!isEditable && !canShowPublicLink) return null;

  // 公開プロフィール: [Facebookアイコン] 表示名 の横長リンクのみ
  if (!isEditable) {
    return (
      <FacebookProfileLinkRow url={publicUrl} displayName={facebookUsername} />
    );
  }

  return (
    <div className="sns-item" style={snsCardBase}>
      <h2 style={cardTitle}>Facebook</h2>

      <div style={{ ...cardBody, display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6, maxWidth: 520 }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
            FacebookプロフィールURL
          </span>
          <input
            type="text"
            placeholder="https://www.facebook.com/username"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            style={inputBase}
          />
        </label>
        <label style={{ display: 'grid', gap: 6, maxWidth: 520 }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
            Facebook表示名
          </span>
          <input
            type="text"
            placeholder="例：山田 太郎"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            style={inputBase}
          />
        </label>
      </div>

      {canShowPreview && (
        <div style={{ flex: 1, display: 'grid', gap: 12 }}>
          <FacebookProfileLinkRow
            url={previewNormalized || previewUrl}
            displayName={usernameInput}
          />
        </div>
      )}

      {(!hasPreviewContent || showFacebook === false) && (
        <div style={{ flex: 1 }}>
          <div style={emptyStateBox}>未設定（URLを入力するとここに表示されます）</div>
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
          <SnsVisibilityToggle
            label="Facebookを表示する"
            checked={showFacebook}
            onChange={setShowFacebook}
          />
          <SnsHelpTooltip />
        </div>
      </div>
    </div>
  );
}
