'use client';

import React, { useEffect, useState } from 'react';
import { fetchLatestVideos, embedInstagramPost, showXProfile, displayTikTokVideos } from '@/lib/sns';
import { createCalendar } from '@/lib/calendar';
import { updatePhotoSlider } from '@/lib/photoSlider';

function getUidFromURL(): string {
  const match = window.location.pathname.match(/\/user\/([^\/]+)/);
  return match ? match[1] : '';
}

type CalendarEvent = {
  date: string;
  events: string[];
};

type Photo = {
  url: string;
  position?: string;
};

type Profile = {
  name?: string;
  title?: string;
  bio?: string;
  photos?: Photo[];
  youtubeChannelId?: string;
  instagramPostUrl?: string;
  xUsername?: string;
  tiktokUrls?: string[];
  calendarEvents?: CalendarEvent[];
  facebookPageUrl?: string;
};

type Props = {
  profile: Profile;
  isOwnPage: boolean;
};

export default function UserProfileDisplay({ profile, isOwnPage }: Props) {
  const [events, setEvents] = useState<Record<string, string[]>>({});
  const [currentDate] = useState(new Date());

  const uid = getUidFromURL();

  useEffect(() => {
    // 名前、肩書き、紹介文の表示
    const nameEl = document.getElementById('name');
    if (nameEl) nameEl.textContent = profile.name || '';

    const titleEl = document.getElementById('title');
    if (titleEl) titleEl.textContent = profile.title ? `（${profile.title}）` : '';

    const bioEl = document.getElementById('bio');
    if (bioEl) bioEl.innerHTML = (profile.bio || '').replace(/\n/g, '<br>');

    // 写真スライダーの表示
    if (Array.isArray(profile.photos)) {
      updatePhotoSlider(profile.photos, isOwnPage);
    }

    // SNSの埋め込み
    if (profile.youtubeChannelId) {
      fetchLatestVideos(profile.youtubeChannelId);
    }

    if (profile.instagramPostUrl) {
      embedInstagramPost(profile.instagramPostUrl);
    }

    if (profile.xUsername) {
      showXProfile(profile.xUsername);
    }

    if (Array.isArray(profile.tiktokUrls)) {
      displayTikTokVideos(profile.tiktokUrls);
    }

    // カレンダー表示
    if (Array.isArray(profile.calendarEvents)) {
      const eventObj: Record<string, string[]> = {};
      profile.calendarEvents.forEach(e => {
        if (e.date && Array.isArray(e.events)) {
          eventObj[e.date] = e.events;
        }
      });
      localStorage.setItem('calendarEvents', JSON.stringify(eventObj));
      setEvents(eventObj);
      createCalendar(currentDate, isOwnPage, true, uid);
    }
  }, [profile, isOwnPage, currentDate]);

  return null; // このコンポーネントは DOM 更新専用なので描画は行わない
}
