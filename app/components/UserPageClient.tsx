'use client';

import { useEffect, useRef, useState } from 'react';
import SectionReorderBlock from '@/components/SectionReorderBlock';

declare global {
  interface Window {
    embedFacebookPage?: (url: string) => void;
    embedInstagramPost?: (url: string) => void;
    updatePhotoSlider?: (photos: Photo[], own: boolean) => void;
    displayManualYouTubeVideos?: (urls: string[]) => void;
    fetchLatestVideos?: (channelId: string) => void;
    showXProfile?: (username: string) => void;
    displayTikTokVideos?: (urls: string[]) => void;
    createCalendar?: (date: Date, own: boolean) => void;
    savePhotos?: () => void;
  }
}

type Photo = {
  url: string;
  position?: string;
};

type Profile = {
  name?: string;
  title?: string;
  bio?: string;
  photos?: Photo[];
  youtubeMode?: 'latest' | 'manual';
  youtubeChannelId?: string;
  manualYouTubeUrls?: string[];
  xUsername?: string;
  instagramPostUrl?: string;
  tiktokUrls?: string[];
  calendarEvents?: { date: string; events: string[] }[];
  settings?: {
    showX?: boolean;
    showInstagram?: boolean;
    showTikTok?: boolean;
    showFacebook?: boolean;
    sectionOrder?: string[];
  };
  facebookPageUrl?: string;
};

type Props = {
  uid: string;
  profile: Profile;
  isEditable: boolean;
};

const DEFAULT_ORDER = ['YouTube', 'X', 'Instagram', 'TikTok', 'Facebook', 'BannerLinks', 'SNSButtons'];

const UserPageClient = ({ uid, profile, isEditable }: Props) => {
  const lastInstagramUrlRef = useRef<string | null>(null);
  const lastFacebookUrlRef = useRef<string | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<string[]>(profile.settings?.sectionOrder ?? DEFAULT_ORDER);

    // --- 並び順保存 ---
const saveOrderToServer = async () => {
  try {
    const updatedProfile = {
      ...profile,
      settings: {
        ...profile.settings,
        sectionOrder: sectionOrder,
      },
    };

    const res = await fetch(`/api/user/${uid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: updatedProfile }),
    });

    if (res.ok) {
      alert('並び順を保存しました');
      window.location.reload(); 
    } else {
      throw new Error();
    }
  } catch (err) {
    alert('保存に失敗しました');
  }
};


  useEffect(() => {
    if (!uid) return;

    // ローカルストレージのクリア
    ['youtubeChannelId', 'instagramPostUrl', 'xUsername', 'tiktokUrls', 'calendarEvents'].forEach(key => {
      localStorage.removeItem(key);
    });

    const own = isEditable;

    // タイトル・名前・職業・自己紹介
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = `${profile.name || 'ユーザー'}さんのページ`;

    const nameEl = document.getElementById('name');
    if (nameEl) nameEl.textContent = profile.name || '';

    const titleText = document.getElementById('title');
    if (titleText) titleText.textContent = profile.title ? `（${profile.title}）` : '';

    const bioEl = document.getElementById('bio');
    if (bioEl) bioEl.innerHTML = (profile.bio || '').replace(/\n/g, '<br>');

    // 写真スライダー
    if (Array.isArray(profile.photos)) {
      window.updatePhotoSlider?.(profile.photos, own);
    }

    // YouTube設定
if (profile.youtubeMode === 'manual') {
  (document.querySelector('input[name="youtubeMode"][value="manual"]') as HTMLInputElement | null)?.click();

  const latestInput = document.getElementById('youtube-latest-input');
  if (latestInput) latestInput.style.display = 'none';

  const manualInput = document.getElementById('youtube-manual-input');
  if (manualInput) manualInput.style.display = 'block';

  window.displayManualYouTubeVideos?.(profile.manualYouTubeUrls || []);
} else if (profile.youtubeChannelId) {
  (document.querySelector('input[name="youtubeMode"][value="latest"]') as HTMLInputElement | null)?.click();

  const latestInput = document.getElementById('youtube-latest-input');
  if (latestInput) latestInput.style.display = 'block';

  const manualInput = document.getElementById('youtube-manual-input');
  if (manualInput) manualInput.style.display = 'none';

  const input = document.getElementById('channelIdInput') as HTMLInputElement | null;
  if (input) input.value = profile.youtubeChannelId;

  window.fetchLatestVideos?.(profile.youtubeChannelId);
}

    // SNS表示
    if (profile.settings?.showX && profile.xUsername) {
      window.showXProfile?.(profile.xUsername);
    }

    if (profile.settings?.showInstagram && profile.instagramPostUrl) {
      if (lastInstagramUrlRef.current !== profile.instagramPostUrl) {
        lastInstagramUrlRef.current = profile.instagramPostUrl;
        window.embedInstagramPost?.(profile.instagramPostUrl);
      }
    }

    if (profile.settings?.showTikTok && Array.isArray(profile.tiktokUrls)) {
      window.displayTikTokVideos?.(profile.tiktokUrls);
    }

    if (profile.settings?.showFacebook && profile.facebookPageUrl) {
      if (lastFacebookUrlRef.current !== profile.facebookPageUrl) {
        lastFacebookUrlRef.current = profile.facebookPageUrl;
        window.embedFacebookPage?.(profile.facebookPageUrl);
      }
    }

    // カレンダーイベント
    if (Array.isArray(profile.calendarEvents)) {
      const events: Record<string, string[]> = {};
      profile.calendarEvents.forEach(e => {
        if (e.date && Array.isArray(e.events)) {
          events[e.date] = e.events;
        }
      });
      localStorage.setItem('calendarEvents', JSON.stringify(events));
      window.createCalendar?.(new Date(), own);
    }

    // お気に入りボタン
    const favBtn = document.getElementById('favoriteBtn');
    if (!own && favBtn) {
      favBtn.style.display = 'inline-block';
      favBtn.onclick = async () => {
        const res = await fetch(`/api/favorites/${uid}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) {
          alert('お気に入りに追加しました');
          (favBtn as HTMLButtonElement).disabled = true;
        } else {
          alert('ログインしてください');
          window.location.href = '/login';
        }
      };
    } else if (favBtn) {
      favBtn.style.display = 'none';
    }

    // 写真保存ボタン
    const photoBtn = document.getElementById('savePhotosBtn');
    if (own && photoBtn && typeof window.savePhotos === 'function') {
      photoBtn.removeEventListener('click', window.savePhotos);
      photoBtn.addEventListener('click', window.savePhotos);
    }

    // 表示制御
    document.body.classList.toggle('own-page', own);
    document.querySelectorAll('.auth-only').forEach(el => {
      (el as HTMLElement).style.display = own ? 'block' : 'none';
    });

  }, [uid, profile, isEditable]);

  // ✅ 編集モードボタン + 並び替えUI（isEditableのときだけ表示）
  return (
          <>
      {isEditable && !isReorderMode && (
        <div style={{ textAlign: 'center', margin: '30px 0' }}>
          <button
            onClick={() => setIsReorderMode(true)}
            style={{
              backgroundColor: '#0070f3',
              color: '#fff',
              padding: '10px 20px',
              fontSize: '1rem',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            📦 並び替えモードを開始
          </button>
        </div>
      )}

      {isEditable && isReorderMode && (
        <SectionReorderBlock
          sectionOrder={sectionOrder}
          onChange={(newOrder) => setSectionOrder(newOrder)}
          onSave={saveOrderToServer}
          onCancel={() => setIsReorderMode(false)}
        />
      )}
    </>
  );
};

export default UserPageClient;
