'use client';

import { useEffect, useState } from 'react';
import SnsVisibilityToggle from './SnsVisibilityToggle';
import SnsHelpTooltip from './SnsHelpTooltip';
import { fetchUserApi } from '@/lib/userProfileClient';
import { buttonPrimary, buttonRowRight, cardActions, cardBody, cardPreviewArea, cardTitle, emptyStateBox, inputBase, snsCardBase } from '@/components/ui/cardStyles';

type Props = {
  uid: string;
  isEditable: boolean;
  hasInitialProfile?: boolean;
  initialUrl?: string;
  initialShowFacebook?: boolean | undefined;
};

export default function FacebookEmbedBlock({
  uid,
  isEditable,
  hasInitialProfile,
  initialUrl,
  initialShowFacebook,
}: Props) {
  const [fbUrl, setFbUrl] = useState(initialUrl ?? '');
  const [inputValue, setInputValue] = useState(initialUrl ?? '');
  const [showFacebook, setShowFacebook] = useState<boolean | undefined>(initialShowFacebook);

  useEffect(() => {
    const fetchFacebookUrl = async () => {
      try {
        const data = await fetchUserApi(uid, { caller: 'FacebookEmbedBlock', reason: 'initial load (facebook settings)' });
        const url = data.profile?.facebookUrl || '';
        setFbUrl(url);
        setInputValue(url);
        setShowFacebook(data.profile?.settings?.showFacebook);
      } catch (err) {
        console.error('❌ Facebook URL取得エラー:', err);
      }
    };
    if (hasInitialProfile) return;
    fetchFacebookUrl();
  }, [uid, hasInitialProfile]);

  useEffect(() => {
    if (!document.getElementById('fb-root')) {
      const fbRoot = document.createElement('div');
      fbRoot.id = 'fb-root';
      document.body.prepend(fbRoot);
    }

    if (fbUrl && isFacebookPage(fbUrl) && !document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/ja_JP/sdk.js#xfbml=1&version=v19.0';
      script.async = true;
      document.body.appendChild(script);
    }

    if (fbUrl && typeof window !== 'undefined' && window.FB) {
      setTimeout(() => {
        window.FB?.XFBML.parse();
      }, 500);
    }
  }, [fbUrl]);

  const isFacebookPage = (url: string) => {
    if (!url) return false;
    const domain = url.toLowerCase();
    return domain.startsWith('https://www.facebook.com/') &&
      !domain.includes('profile.php') &&
      !domain.includes('/people/');
  };

  // ✅ フックの後に早期 return を置く
  if (!isEditable && (!fbUrl || showFacebook === false)) {
    return null;
  }

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/user/${uid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          profile: {
            facebookUrl: inputValue,
            settings: {
              showFacebook: showFacebook !== false,
            },
          },
        }),
      });

      if (!res.ok) throw new Error('保存失敗');
      setFbUrl(inputValue);
      alert('✅ FacebookページURLを保存しました');
    } catch (err) {
      console.error('❌ 保存エラー:', err);
      alert('❌ FacebookページURLの保存に失敗しました');
    }
  };

 return (
  <div className="facebook-section" style={snsCardBase}>
    <h3 style={cardTitle}>Facebook</h3>

    {isEditable && (
      <div style={cardBody}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="https://www.facebook.com/xxxxxx"
          style={inputBase}
        />
        <div style={buttonRowRight}>
          <button type="button" onClick={handleSave} style={buttonPrimary}>
            保存
          </button>
        </div>
      </div>
    )}

    <div style={{ flex: 1 }}>
      {fbUrl && showFacebook && (
        <>
          {/* 埋め込み：ページURL（/profile.php含まない場合）のみ表示 */}
          {isFacebookPage(fbUrl) && (
            <div
              id="fbEmbedContainer"
              style={{
                ...cardPreviewArea,
                marginTop: 0,
                maxWidth: 520,
                width: '100%',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              <div
                className="fb-page"
                data-href={fbUrl}
                data-tabs="timeline"
                data-width="500"
                data-height=""
                data-small-header="false"
                data-adapt-container-width="false"
                data-hide-cover="false"
                data-show-facepile="true"
              >
                <blockquote cite={fbUrl} className="fb-xfbml-parse-ignore" />
              </div>
            </div>
          )}

          {/* 📎 ページでなくてもリンクボタンは常に表示 */}
          <div style={{ marginTop: '32px', textAlign: 'center' }}>
            <a
              href={fbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="facebook-button"
              style={{
                display: 'inline-block',
                backgroundColor: '#1877f2',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: '5px',
                textDecoration: 'none',
                fontWeight: 'bold',
              }}
            >
              <i className="fab fa-facebook-square" style={{ marginRight: '8px' }}></i>
              Facebook を開く
            </a>
          </div>
        </>
      )}

      {(!fbUrl || showFacebook === false) && (
        <div style={emptyStateBox}>未設定（URLを入力するとここに表示されます）</div>
      )}
    </div>

    {isEditable && (
      <div style={cardActions}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <SnsVisibilityToggle
            label="Facebookを表示する"
            checked={showFacebook ?? true}
            onChange={setShowFacebook}
          />
          <SnsHelpTooltip />
        </div>
      </div>
    )}
  </div>
);
}