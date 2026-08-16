'use client';

import type { JSX } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
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

type BannerLink = { imageUrl: string; linkUrl: string; visible?: boolean };
type CustomLink = { label: string; url: string; color?: string; icon?: string };

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
  facebookUsername?: string;
  facebookPageUrl?: string;
  apps?: AppProject[];
  bannerLinks?: BannerLink[];
  customLinks?: CustomLink[];
  settings?: {
    showYouTube?: boolean;
    showX?: boolean;
    showApps?: boolean;
    showInstagram?: boolean;
    showTikTok?: boolean;
    showFacebook?: boolean;
    showBanners?: boolean;
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
  const [draftProfile, setDraftProfile] = useState<Profile>(() => ({
    ...initialProfile,
    apps: initialApps,
  }));
  const draftProfileRef = useRef(draftProfile);
  draftProfileRef.current = draftProfile;

  const [sectionOrder, setSectionOrder] = useState<string[]>(
    ensureAppProjectsInOrder(initialSectionOrder)
  );
  const [apps, setApps] = useState<AppProject[]>(initialApps);

  const updateDraftProfile = useCallback((patch: Partial<Profile>) => {
    setDraftProfile((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateDraftSettings = useCallback((patch: NonNullable<Profile['settings']>) => {
    setDraftProfile((prev) => ({
      ...prev,
      settings: {
        ...(prev.settings ?? {}),
        ...patch,
      },
    }));
  }, []);

  const onSectionOrderSaved = useCallback(
    (nextOrder: string[]) => {
      const normalized = ensureAppProjectsInOrder(nextOrder);
      setSectionOrder(normalized);
      setProfile((prev) => ({
        ...prev,
        settings: { ...(prev.settings ?? {}), sectionOrder: normalized },
      }));
      updateDraftSettings({ sectionOrder: normalized });
    },
    [updateDraftSettings]
  );

  const onAppsChange = useCallback((next: AppProject[]) => {
    setApps(next);
    setProfile((prev) => ({ ...prev, apps: next }));
    updateDraftProfile({ apps: next });
  }, [updateDraftProfile]);

  const onShowAppsSaved = useCallback((showApps: boolean) => {
    setProfile((prev) => ({
      ...prev,
      settings: { ...(prev.settings ?? {}), showApps },
    }));
    updateDraftSettings({ showApps });
  }, [updateDraftSettings]);

  const onYouTubeDraftChange = useCallback(
    (draft: {
      youtubeMode: 'latest' | 'manual';
      youtubeChannelId: string;
      manualYouTubeUrls: string[];
      showYouTube?: boolean;
    }) => {
      updateDraftProfile({
        youtubeMode: draft.youtubeMode,
        youtubeChannelId: draft.youtubeChannelId,
        manualYouTubeUrls: draft.manualYouTubeUrls,
      });
      updateDraftSettings({ showYouTube: draft.showYouTube });
    },
    [updateDraftProfile, updateDraftSettings]
  );

  const onXDraftChange = useCallback(
    (draft: { xUsername: string; showX: boolean }) => {
      updateDraftProfile({ xUsername: draft.xUsername });
      updateDraftSettings({ showX: draft.showX });
    },
    [updateDraftProfile, updateDraftSettings]
  );

  const onInstagramDraftChange = useCallback(
    (draft: { instagramPostUrl: string; showInstagram: boolean }) => {
      updateDraftProfile({ instagramPostUrl: draft.instagramPostUrl });
      updateDraftSettings({ showInstagram: draft.showInstagram });
    },
    [updateDraftProfile, updateDraftSettings]
  );

  const onFacebookDraftChange = useCallback(
    (draft: { facebookUrl: string; facebookUsername: string; showFacebook: boolean }) => {
      updateDraftProfile({
        facebookUrl: draft.facebookUrl,
        facebookUsername: draft.facebookUsername,
      });
      updateDraftSettings({ showFacebook: draft.showFacebook });
    },
    [updateDraftProfile, updateDraftSettings]
  );

  const onTikTokDraftChange = useCallback(
    (draft: { tiktokUrls: string[]; showTikTok: boolean }) => {
      updateDraftProfile({ tiktokUrls: draft.tiktokUrls });
      updateDraftSettings({ showTikTok: draft.showTikTok });
    },
    [updateDraftProfile, updateDraftSettings]
  );

  const onBasicDraftChange = useCallback(
    (draft: { name?: string; title?: string; bio?: string }) => {
      updateDraftProfile(draft);
    },
    [updateDraftProfile]
  );

  const onContactDraftChange = useCallback(
    (emailForContact: string) => {
      updateDraftProfile({ emailForContact });
    },
    [updateDraftProfile]
  );

  const onBannerDraftChange = useCallback(
    (draft: { bannerLinks: BannerLink[]; showBanners: boolean }) => {
      updateDraftProfile({ bannerLinks: draft.bannerLinks });
      updateDraftSettings({ showBanners: draft.showBanners });
    },
    [updateDraftProfile, updateDraftSettings]
  );

  const onCustomLinksDraftChange = useCallback(
    (customLinks: CustomLink[]) => {
      updateDraftProfile({ customLinks });
    },
    [updateDraftProfile]
  );

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
          onDraftChange={isEditable ? onYouTubeDraftChange : undefined}
        />
      ),
      X: (
        <XEmbed
          uid={uid}
          isEditable={isEditable}
          hasInitialProfile
          initialUsername={profile?.xUsername}
          initialShowX={profile?.settings?.showX}
          onDraftChange={isEditable ? onXDraftChange : undefined}
        />
      ),
      Instagram: (
        <InstagramEmbed
          uid={uid}
          isEditable={isEditable}
          hasInitialProfile
          initialInstagramUrl={profile?.instagramPostUrl}
          initialShowInstagram={profile?.settings?.showInstagram}
          onDraftChange={isEditable ? onInstagramDraftChange : undefined}
        />
      ),
      TikTok: (
        <TikTokEmbed
          uid={uid}
          isEditable={isEditable}
          hasInitialProfile
          initialUrls={profile?.tiktokUrls}
          initialShowTikTok={profile?.settings?.showTikTok}
          onDraftChange={isEditable ? onTikTokDraftChange : undefined}
        />
      ),
      Facebook: (
        <FacebookEmbedBlock
          uid={uid}
          isEditable={isEditable}
          hasInitialProfile
          initialUrl={profile?.facebookUrl}
          initialFacebookUsername={profile?.facebookUsername}
          initialShowFacebook={profile?.settings?.showFacebook}
          onDraftChange={isEditable ? onFacebookDraftChange : undefined}
        />
      ),
      BannerLinks: (
        <BannerLinksBlock
          uid={uid}
          isEditable={isEditable}
          onDraftChange={isEditable ? onBannerDraftChange : undefined}
        />
      ),
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
      SNSButtons: (
        <UserPageClientWrapper
          uid={uid}
          profile={profile}
          isEditable={isEditable}
          onCustomLinksChange={isEditable ? onCustomLinksDraftChange : undefined}
        />
      ),
    }),
    [
      apps,
      isEditable,
      onAppsChange,
      onBannerDraftChange,
      onCustomLinksDraftChange,
      onFacebookDraftChange,
      onInstagramDraftChange,
      onShowAppsSaved,
      onTikTokDraftChange,
      onXDraftChange,
      onYouTubeDraftChange,
      profile,
      uid,
    ]
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

        <UserProfileSection
          uid={uid}
          isEditable={isEditable}
          initialProfile={profile}
          onBasicDraftChange={isEditable ? onBasicDraftChange : undefined}
          onContactDraftChange={isEditable ? onContactDraftChange : undefined}
        />

        <UserPageClient
          uid={uid}
          profile={profile}
          isEditable={isEditable}
          onSectionOrderSaved={onSectionOrderSaved}
        />

        {renderedSections}

        <div className="user-page-section">
          <QRCodeBlock uid={uid} initialName={profile?.name} />
        </div>
      </main>
    </>
  );
}

