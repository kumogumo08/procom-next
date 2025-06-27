'use client';

import { useEffect, useState } from 'react';

type Props = {
  uid: string;
};

const UserPageClient = ({ uid }: Props) => {
  const [isOwnPage, setIsOwnPage] = useState(false);

  useEffect(() => {
    if (!uid) return;

    // ローカルストレージのクリア
    localStorage.removeItem('youtubeChannelId');
    localStorage.removeItem('instagramPostUrl');
    localStorage.removeItem('xUsername');
    localStorage.removeItem('tiktokUrls');
    localStorage.removeItem('calendarEvents');

    const loadUserData = async () => {
      try {
        const sessionRes = await fetch('/api/session');
        const session = await sessionRes.json();
        const own = session.loggedIn && session.uid === uid;
        setIsOwnPage(own);

        const res = await fetch(`/api/user/${uid}`);
        if (!res.ok) throw new Error('ユーザーデータ取得失敗');
        const data = await res.json();
        const profile = data.profile || data;

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

        // SNS表示（ログイン関係なし）
        if (profile.xUsername) window.showXProfile?.(profile.xUsername);
        if (profile.instagramPostUrl) window.embedInstagramPost?.(profile.instagramPostUrl);
        if (Array.isArray(profile.tiktokUrls)) window.displayTikTokVideos?.(profile.tiktokUrls);

        // カレンダーイベント
        if (Array.isArray(profile.calendarEvents)) {
          const events: Record<string, string[]> = {};
          profile.calendarEvents.forEach((e: any) => {
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

        // 写真保存ボタン（自分のページ）
        if (own) {
          const photoBtn = document.getElementById('savePhotosBtn');
          if (photoBtn && typeof window.savePhotos === 'function') {
            // 古いイベントリスナーを削除してから、新しく追加
            photoBtn.removeEventListener('click', window.savePhotos);
            photoBtn.addEventListener('click', window.savePhotos);
          }
        }

        // 権限に応じた表示制御
        document.body.classList.toggle('own-page', own);
        document.querySelectorAll('.auth-only').forEach(el => {
          (el as HTMLElement).style.display = own ? 'block' : 'none';
        });

      } catch (err: any) {
        console.error('❌ ユーザーデータ取得エラー:', err.message);
        alert('ユーザーデータの取得に失敗しました');
      }
    };

    loadUserData();
  }, [uid]);

  return null;
};

export default UserPageClient;
