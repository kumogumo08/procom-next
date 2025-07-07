'use client';

import { useEffect } from 'react';

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
};

type Props = {
  uid: string;
  profile: Profile;
  isEditable: boolean;
};

const UserPageClient = ({ uid, profile, isEditable }: Props) => {
  useEffect(() => {
    if (!uid) return;

    // ローカルストレージのクリア
    localStorage.removeItem('youtubeChannelId');
    localStorage.removeItem('instagramPostUrl');
    localStorage.removeItem('xUsername');
    localStorage.removeItem('tiktokUrls');
    localStorage.removeItem('calendarEvents');

    const own = isEditable;

    // タイトル・名前・職業・自己紹介
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = `${profile.name || 'ユーザー'}さんのページ`;

    const nameEl = document.getElementById('name');
    if (nameEl) nameEl.textContent = profile.name || '';

    const titleLabel = document.getElementById('title');
    if (titleLabel) titleLabel.textContent = profile.title ? `（${profile.title}）` : '';

    const bioEl = document.getElementById('bio');
    if (bioEl) bioEl.innerHTML = (profile.bio || '').replace(/\n/g, '<br>');

    // 写真スライダー
    if (Array.isArray(profile.photos)) {
      window.updatePhotoSlider?.(profile.photos, own);
    }

    // YouTube設定
    if (profile.youtubeMode === 'manual') {
      const manualRadio = document.querySelector('input[name="youtubeMode"][value="manual"]') as HTMLInputElement | null;
      const latestInput = document.getElementById('youtube-latest-input');
      const manualInput = document.getElementById('youtube-manual-input');

      if (manualRadio) manualRadio.checked = true;
      if (latestInput) latestInput.style.display = 'none';
      if (manualInput) manualInput.style.display = 'block';

      window.displayManualYouTubeVideos?.(profile.manualYouTubeUrls || []);
    } else if (profile.youtubeChannelId) {
      const latestRadio = document.querySelector('input[name="youtubeMode"][value="latest"]') as HTMLInputElement | null;
      const latestInput = document.getElementById('youtube-latest-input');
      const manualInput = document.getElementById('youtube-manual-input');
      const input = document.getElementById('channelIdInput') as HTMLInputElement | null;

      if (latestRadio) latestRadio.checked = true;
      if (latestInput) latestInput.style.display = 'block';
      if (manualInput) manualInput.style.display = 'none';
      if (input) input.value = profile.youtubeChannelId;

      window.fetchLatestVideos?.(profile.youtubeChannelId);
    }

    // SNS表示
    if (profile.xUsername) window.showXProfile?.(profile.xUsername);
    if (profile.instagramPostUrl) window.embedInstagramPost?.(profile.instagramPostUrl);
    if (Array.isArray(profile.tiktokUrls)) window.displayTikTokVideos?.(profile.tiktokUrls);

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

  return null;
};

export default UserPageClient;
