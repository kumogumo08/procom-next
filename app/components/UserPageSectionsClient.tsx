'use client';

import type { JSX } from 'react';
import { useCallback, useMemo, useState } from 'react';
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

type Photo = { url: string; position?: number };

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
  initialSectionOrder,
  initialApps,
}: {
  uid: string;
  isEditable: boolean;
  initialProfile: Profile;
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

  /** Phase1: 常にワンカラム縦積み（PC で隣接セクションを横並びにしない） */
  const renderedSections = useMemo(() => {
    return sectionOrder.map((key) => {
      const node = sectionMap[key];
      if (!node) return null;
      return (
        <div className="user-page-section" key={key}>
          {node}
        </div>
      );
    });
  }, [sectionMap, sectionOrder]);

  return (
    <>
      {profile?.name && (
        <h2
          style={{
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: 'clamp(1rem, 2.8vw, 1.25rem)',
            margin: '0.5em 0 0.45em',
            color: '#0f172a',
          }}
        >
          {profile.name}さんのプロフィールページ
        </h2>
      )}

      <main>
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

