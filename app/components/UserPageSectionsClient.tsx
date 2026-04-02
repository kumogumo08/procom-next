'use client';

import type { JSX } from 'react';
import { useCallback, useMemo, useState } from 'react';
import UserPhotoSliderClient from '@/components/UserPhotoSliderClient';
import OshiButton from '@/components/OshiButton';
import XShareButton from '@/components/XShareButton';
import UserProfileSection from '@/components/UserProfileSection';
import UserPageClient from '@/components/UserPageClient';
import YouTubeEmbedBlock from '@/components/YouTubeEmbedBlock';
import XEmbed from '@/components/XEmbed';
import InstagramEmbed from '@/components/InstagramEmbed';
import TikTokEmbed from '@/components/TikTokEmbed';
import FacebookEmbedBlock from '@/components/FacebookEmbedBlock';
import QRCodeBlock from '@/components/QRCodeBlock';
import BannerLinksBlock from '@/components/BannerLinksBlock';
import UserPageClientWrapper from '@/components/UserPageClientWrapper';
import AppProjectBlock from '@/components/AppProjectBlock';
import type { AppProject } from '@/lib/appProjects';

type Photo = { url: string; position?: string };

type Profile = {
  name?: string;
  title?: string;
  bio?: string;
  emailForContact?: string | null;
  photos?: Photo[];
  youtubeMode?: 'latest' | 'manual';
  youtubeChannelId?: string;
  manualYouTubeUrls?: string[];
  xUsername?: string;
  instagramPostUrl?: string;
  tiktokUrls?: string[];
  calendarEvents?: { date: string; events: string[] }[];
  facebookUrl?: string;
  facebookPageUrl?: string;
  apps?: AppProject[];
  settings?: {
    showYouTube?: boolean;
    showX?: boolean;
    showApps?: boolean;
    showInstagram?: boolean;
    showTikTok?: boolean;
    showFacebook?: boolean;
    sectionOrder?: string[];
  };
};

function ensureAppProjectsInOrder(order: string[]): string[] {
  if (order.includes('AppProjects')) return order;
  const snsIdx = order.indexOf('SNSButtons');
  if (snsIdx >= 0) return [...order.slice(0, snsIdx), 'AppProjects', ...order.slice(snsIdx)];
  return [...order, 'AppProjects'];
}

export default function UserPageSectionsClient({
  uid,
  isEditable,
  initialProfile,
  initialPhotos,
  initialSectionOrder,
  initialApps,
}: {
  uid: string;
  isEditable: boolean;
  initialProfile: Profile;
  initialPhotos: Photo[];
  initialSectionOrder: string[];
  initialApps: AppProject[];
}) {
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [sectionOrder, setSectionOrder] = useState<string[]>(
    ensureAppProjectsInOrder(initialSectionOrder)
  );
  const [apps, setApps] = useState<AppProject[]>(initialApps);

  const onSectionOrderSaved = useCallback(
    (nextOrder: string[]) => {
      const normalized = ensureAppProjectsInOrder(nextOrder);
      setSectionOrder(normalized);
      setProfile((prev) => ({
        ...prev,
        settings: { ...(prev.settings ?? {}), sectionOrder: normalized },
      }));
    },
    []
  );

  const onAppsChange = useCallback((next: AppProject[]) => {
    setApps(next);
    setProfile((prev) => ({ ...prev, apps: next }));
  }, []);

  const onShowAppsSaved = useCallback((showApps: boolean) => {
    setProfile((prev) => ({
      ...prev,
      settings: { ...(prev.settings ?? {}), showApps },
    }));
  }, []);

  const sectionMap: Record<string, JSX.Element> = useMemo(
    () => ({
      YouTube: (
        <YouTubeEmbedBlock
          uid={uid}
          isEditable={isEditable}
          hasInitialProfile
          initialMode={profile?.youtubeMode}
          initialChannelId={profile?.youtubeChannelId}
          initialManualUrls={profile?.manualYouTubeUrls}
          initialShowYouTube={profile?.settings?.showYouTube}
        />
      ),
      X: (
        <XEmbed
          uid={uid}
          isEditable={isEditable}
          hasInitialProfile
          initialUsername={profile?.xUsername}
          initialShowX={profile?.settings?.showX}
        />
      ),
      Instagram: (
        <InstagramEmbed
          uid={uid}
          isEditable={isEditable}
          hasInitialProfile
          initialInstagramUrl={profile?.instagramPostUrl}
          initialShowInstagram={profile?.settings?.showInstagram}
        />
      ),
      TikTok: (
        <TikTokEmbed
          uid={uid}
          isEditable={isEditable}
          hasInitialProfile
          initialUrls={profile?.tiktokUrls}
          initialShowTikTok={profile?.settings?.showTikTok}
        />
      ),
      Facebook: (
        <FacebookEmbedBlock
          uid={uid}
          isEditable={isEditable}
          hasInitialProfile
          initialUrl={profile?.facebookUrl}
          initialShowFacebook={profile?.settings?.showFacebook}
        />
      ),
      BannerLinks: <BannerLinksBlock uid={uid} isEditable={isEditable} />,
      AppProjects: (
        <AppProjectBlock
          uid={uid}
          initialApps={apps}
          initialShowApps={profile?.settings?.showApps}
          isEditable={isEditable}
          onChange={onAppsChange}
          onShowAppsSaved={onShowAppsSaved}
        />
      ),
      SNSButtons: <UserPageClientWrapper uid={uid} profile={profile} isEditable={isEditable} />,
    }),
    [apps, isEditable, onAppsChange, onShowAppsSaved, profile, uid]
  );

  const renderedSections = useMemo(() => {
    const out: JSX.Element[] = [];
    const is1Col = (key: string) =>
      key === 'X' || key === 'Instagram' || key === 'Facebook' || key === 'BannerLinks';
    const is2Col = (key: string) =>
      key === 'YouTube' || key === 'TikTok' || key === 'SNSButtons' || key === 'AppProjects';

    for (let i = 0; i < sectionOrder.length; i++) {
      const curr = sectionOrder[i];
      const next = sectionOrder[i + 1];

      if (is1Col(curr) && is1Col(next)) {
        out.push(
          <div
            className="sns-container"
            key={`group-${i}`}
            style={{ display: 'flex', gap: 24, alignItems: 'stretch' }}
          >
            <div className="sns-box" style={{ flex: 1, display: 'flex' }}>
              {sectionMap[curr]}
            </div>
            <div className="sns-box" style={{ flex: 1, display: 'flex' }}>
              {sectionMap[next]}
            </div>
          </div>
        );
        i++;
      } else if (is1Col(curr)) {
        out.push(
          <div className="sns-container" key={curr}>
            <div className="sns-box">{sectionMap[curr]}</div>
          </div>
        );
      } else if (is2Col(curr)) {
        out.push(
          <div className="single-column-wrapper" key={curr}>
            {sectionMap[curr]}
          </div>
        );
      }
    }
    return out;
  }, [sectionMap, sectionOrder]);

  return (
    <>
      {profile?.name && (
        <h1
          style={{
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: '1.8rem',
            margin: '1em 0',
          }}
        >
          {profile.name}さんのプロフィールページ
        </h1>
      )}

      <main>
        <UserPhotoSliderClient uid={uid} initialPhotos={initialPhotos} />
        <OshiButton uid={uid} />
        <XShareButton uid={uid} name={profile?.name} />

        <UserProfileSection uid={uid} isEditable={isEditable} initialProfile={profile} />

        <UserPageClient
          uid={uid}
          profile={profile}
          isEditable={isEditable}
          onSectionOrderSaved={onSectionOrderSaved}
        />

        {renderedSections}

        <QRCodeBlock initialName={profile?.name} />
      </main>
    </>
  );
}

