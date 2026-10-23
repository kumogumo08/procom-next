'use client';

import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buttonPrimary } from '@/components/ui/cardStyles';
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
import UnsavedChangesLeaveGuard from '@/components/UnsavedChangesLeaveGuard';
import { BlockAddControl, BlockDetachControl } from '@/components/BlockPlacementControls';
import { appProjectsContentEqual, type AppProject } from '@/lib/appProjects';
import {
  availableBlocks,
  BLOCK_LABELS,
  blockLayoutMode,
  comparableLayoutFields,
  editBlockPlacement,
  isKnownBlockType,
  layoutFieldsForSave,
  resolveSectionOrder,
  sectionOrderDraftFromReorder,
  type BlockPlacementEdit,
} from '@/lib/blockLayout';

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
    blockLayoutVersion?: number;
  };
};

function isUploadedBannerUrl(url: string | undefined): boolean {
  const trimmed = url?.trim() ?? '';
  return trimmed !== '' && !trimmed.startsWith('data:');
}

/** photos / calendarEvents は含めない。data URL のバナーは除外する */
function buildDraftSavePayload(
  draft: Profile,
  fallbacks: { apps: AppProject[]; sectionOrder: string[] }
) {
  const settings = draft.settings ?? {};
  const payload: Record<string, unknown> = {
    name: draft.name ?? '',
    title: draft.title ?? '',
    bio: draft.bio ?? '',
    emailForContact: draft.emailForContact ?? '',
    youtubeMode: draft.youtubeMode ?? 'latest',
    youtubeChannelId: draft.youtubeChannelId ?? '',
    manualYouTubeUrls: draft.manualYouTubeUrls ?? [],
    xUsername: draft.xUsername ?? '',
    instagramPostUrl: draft.instagramPostUrl ?? '',
    facebookUrl: draft.facebookUrl ?? '',
    facebookUsername: draft.facebookUsername ?? '',
    tiktokUrls: draft.tiktokUrls ?? [],
    apps: Array.isArray(draft.apps) ? draft.apps : fallbacks.apps,
    customLinks: Array.isArray(draft.customLinks) ? draft.customLinks : [],
    settings: {
      showYouTube: settings.showYouTube,
      showX: settings.showX,
      showInstagram: settings.showInstagram,
      showFacebook: settings.showFacebook,
      showTikTok: settings.showTikTok,
      showApps: settings.showApps,
      showBanners: settings.showBanners,
      ...layoutFieldsForSave(settings, fallbacks.sectionOrder),
    },
  };

  if (Array.isArray(draft.bannerLinks)) {
    payload.bannerLinks = draft.bannerLinks.filter((b) => isUploadedBannerUrl(b.imageUrl));
  }

  return payload;
}

const SHOW_FLAG_DEFAULT = true;

/** buildDraftSavePayload と同じ形を、未指定の表示フラグと bannerLinks 欠落だけ揃えて比較する */
function normalizePayloadForCompare(payload: Record<string, unknown>) {
  const settings = (payload.settings ?? {}) as Record<string, unknown>;
  const bannerLinks = Array.isArray(payload.bannerLinks)
    ? (payload.bannerLinks as BannerLink[]).map((b) => ({
        imageUrl: b.imageUrl ?? '',
        linkUrl: b.linkUrl ?? '',
        visible: b.visible ?? true,
      }))
    : [];
  return {
    ...payload,
    bannerLinks,
    settings: {
      showYouTube: settings.showYouTube ?? SHOW_FLAG_DEFAULT,
      showX: settings.showX ?? SHOW_FLAG_DEFAULT,
      showInstagram: settings.showInstagram ?? SHOW_FLAG_DEFAULT,
      showFacebook: settings.showFacebook ?? SHOW_FLAG_DEFAULT,
      showTikTok: settings.showTikTok ?? SHOW_FLAG_DEFAULT,
      showApps: settings.showApps ?? SHOW_FLAG_DEFAULT,
      showBanners: settings.showBanners ?? SHOW_FLAG_DEFAULT,
      ...comparableLayoutFields(settings),
    },
  };
}

function isDraftDirty(
  saved: Profile,
  draft: Profile,
  fallbacks: { apps: AppProject[]; sectionOrder: string[] }
) {
  const savedPayload = normalizePayloadForCompare(buildDraftSavePayload(saved, fallbacks));
  const draftPayload = normalizePayloadForCompare(buildDraftSavePayload(draft, fallbacks));
  return JSON.stringify(savedPayload) !== JSON.stringify(draftPayload);
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
  /** 最後に保存成功した状態（savedProfile） */
  const [profile, setProfile] = useState<Profile>(() => ({
    ...initialProfile,
    apps: initialApps,
  }));
  /** 編集途中状態 */
  const [draftProfile, setDraftProfile] = useState<Profile>(() => ({
    ...initialProfile,
    apps: initialApps,
  }));
  const draftProfileRef = useRef(draftProfile);
  draftProfileRef.current = draftProfile;

  const [sectionOrder, setSectionOrder] = useState<string[]>(() =>
    resolveSectionOrder(initialSectionOrder, initialProfile?.settings?.blockLayoutVersion)
  );
  const [apps, setApps] = useState<AppProject[]>(initialApps);
  const [isSaving, setIsSaving] = useState(false);
  const [formEpoch, setFormEpoch] = useState(0);
  const savingLockRef = useRef(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveMessageTone, setSaveMessageTone] = useState<'ok' | 'error'>('ok');

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

  const applyBlockEdit = useCallback(
    (edit: BlockPlacementEdit) => {
      const next = editBlockPlacement(draftProfileRef.current.settings, edit);
      if (!next) return;
      setSectionOrder(next.sectionOrder);
      updateDraftSettings({
        sectionOrder: next.sectionOrder,
        blockLayoutVersion: next.blockLayoutVersion,
      });
    },
    [updateDraftSettings]
  );

  const discardDraft = useCallback(() => {
    setDraftProfile(profile);
    setApps(Array.isArray(profile.apps) ? profile.apps : initialApps);
    setSectionOrder(
      resolveSectionOrder(profile.settings?.sectionOrder, profile.settings?.blockLayoutVersion)
    );
    setFormEpoch((current) => current + 1);
  }, [initialApps, profile]);

  const onSectionOrderDraftChange = useCallback(
    (nextOrder: string[]) => {
      const version = draftProfileRef.current.settings?.blockLayoutVersion;
      const normalized = sectionOrderDraftFromReorder(nextOrder, version);
      if (normalized == null) return;
      setSectionOrder(normalized);
      updateDraftSettings({ sectionOrder: normalized });
    },
    [updateDraftSettings]
  );

  const onAppsDraftChange = useCallback((draft: { apps: AppProject[]; showApps: boolean }) => {
    setDraftProfile((prev) => {
      const prevApps = Array.isArray(prev.apps) ? prev.apps : [];
      const prevShow = prev.settings?.showApps ?? true;
      if (prevShow === draft.showApps && appProjectsContentEqual(prevApps, draft.apps)) {
        return prev;
      }
      return {
        ...prev,
        apps: draft.apps,
        settings: {
          ...(prev.settings ?? {}),
          showApps: draft.showApps,
        },
      };
    });
  }, []);

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

  const saveDraftProfile = useCallback(async (): Promise<boolean> => {
    if (savingLockRef.current) return false;
    savingLockRef.current = true;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const draft = draftProfileRef.current;
      const profilePayload = buildDraftSavePayload(draft, { apps, sectionOrder });
      const res = await fetch(`/api/user/${uid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ profile: profilePayload }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        apps?: AppProject[];
      };
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : '保存に失敗しました');
      }

      const savedApps = Array.isArray(data.apps) ? data.apps : (profilePayload.apps as AppProject[]);
      const savedSettings = {
        ...(profile.settings ?? {}),
        ...(draft.settings ?? {}),
        ...((profilePayload.settings as Profile['settings']) ?? {}),
      };
      const savedProfile: Profile = {
        ...profile,
        name: profilePayload.name as string,
        title: profilePayload.title as string,
        bio: profilePayload.bio as string,
        emailForContact: profilePayload.emailForContact as string,
        youtubeMode: profilePayload.youtubeMode as Profile['youtubeMode'],
        youtubeChannelId: profilePayload.youtubeChannelId as string,
        manualYouTubeUrls: profilePayload.manualYouTubeUrls as string[],
        xUsername: profilePayload.xUsername as string,
        instagramPostUrl: profilePayload.instagramPostUrl as string,
        facebookUrl: profilePayload.facebookUrl as string,
        facebookUsername: profilePayload.facebookUsername as string,
        tiktokUrls: profilePayload.tiktokUrls as string[],
        apps: savedApps,
        customLinks: profilePayload.customLinks as CustomLink[],
        settings: savedSettings,
        ...(Array.isArray(profilePayload.bannerLinks)
          ? { bannerLinks: profilePayload.bannerLinks as BannerLink[] }
          : {}),
      };

      setProfile(savedProfile);
      setDraftProfile(savedProfile);
      setApps(savedApps);
      if (Array.isArray(savedSettings.sectionOrder)) {
        setSectionOrder(
          resolveSectionOrder(savedSettings.sectionOrder, savedSettings.blockLayoutVersion)
        );
      }
      setSaveMessageTone('ok');
      setSaveMessage('保存しました');
      return true;
    } catch (err) {
      setSaveMessageTone('error');
      setSaveMessage(err instanceof Error ? err.message : '保存に失敗しました');
      return false;
    } finally {
      savingLockRef.current = false;
      setIsSaving(false);
    }
  }, [apps, profile, sectionOrder, uid]);

  const payloadFallbacks = useMemo(
    () => ({ apps, sectionOrder }),
    [apps, sectionOrder]
  );

  const isDirty = useMemo(
    () => (isEditable ? isDraftDirty(profile, draftProfile, payloadFallbacks) : false),
    [draftProfile, isEditable, payloadFallbacks, profile]
  );

  useEffect(() => {
    if (isDirty && saveMessageTone === 'ok') {
      setSaveMessage(null);
    }
    if (!isDirty && saveMessageTone === 'error') {
      setSaveMessage(null);
    }
  }, [isDirty, saveMessageTone]);

  useEffect(() => {
    if (!saveMessage || saveMessageTone !== 'ok') return;
    const timer = window.setTimeout(() => setSaveMessage(null), 2000);
    return () => window.clearTimeout(timer);
  }, [saveMessage, saveMessageTone]);

  const showSaveBar = isEditable && (isDirty || isSaving || Boolean(saveMessage));

  const sectionMap: Record<string, JSX.Element> = useMemo(
    () => ({
      YouTube: (
        <YouTubeEmbedBlock
          uid={uid}
          isEditable={isEditable}
          hasInitialProfile
          initialMode={draftProfile?.youtubeMode}
          initialChannelId={draftProfile?.youtubeChannelId}
          initialManualUrls={draftProfile?.manualYouTubeUrls}
          initialShowYouTube={draftProfile?.settings?.showYouTube}
          onDraftChange={isEditable ? onYouTubeDraftChange : undefined}
        />
      ),
      X: (
        <XEmbed
          uid={uid}
          isEditable={isEditable}
          hasInitialProfile
          initialUsername={draftProfile?.xUsername}
          initialShowX={draftProfile?.settings?.showX}
          onDraftChange={isEditable ? onXDraftChange : undefined}
        />
      ),
      Instagram: (
        <InstagramEmbed
          uid={uid}
          isEditable={isEditable}
          hasInitialProfile
          initialInstagramUrl={draftProfile?.instagramPostUrl}
          initialShowInstagram={draftProfile?.settings?.showInstagram}
          onDraftChange={isEditable ? onInstagramDraftChange : undefined}
        />
      ),
      TikTok: (
        <TikTokEmbed
          uid={uid}
          isEditable={isEditable}
          hasInitialProfile
          initialUrls={draftProfile?.tiktokUrls}
          initialShowTikTok={draftProfile?.settings?.showTikTok}
          onDraftChange={isEditable ? onTikTokDraftChange : undefined}
        />
      ),
      Facebook: (
        <FacebookEmbedBlock
          uid={uid}
          isEditable={isEditable}
          hasInitialProfile
          initialUrl={draftProfile?.facebookUrl}
          initialFacebookUsername={draftProfile?.facebookUsername}
          initialShowFacebook={draftProfile?.settings?.showFacebook}
          onDraftChange={isEditable ? onFacebookDraftChange : undefined}
        />
      ),
      BannerLinks: (
        <BannerLinksBlock
          uid={uid}
          isEditable={isEditable}
          {...(Array.isArray(draftProfile.bannerLinks)
            ? {
                initialBannerLinks: draftProfile.bannerLinks,
                initialShowBanners: draftProfile.settings?.showBanners,
              }
            : {})}
          onDraftChange={isEditable ? onBannerDraftChange : undefined}
        />
      ),
      AppProjects: (
        <AppProjectBlock
          uid={uid}
          initialApps={Array.isArray(draftProfile.apps) ? draftProfile.apps : apps}
          initialShowApps={draftProfile?.settings?.showApps}
          isEditable={isEditable}
          onDraftChange={isEditable ? onAppsDraftChange : undefined}
        />
      ),
      SNSButtons: (
        <UserPageClientWrapper
          uid={uid}
          profile={draftProfile}
          isEditable={isEditable}
          onCustomLinksChange={isEditable ? onCustomLinksDraftChange : undefined}
        />
      ),
    }),
    [
      apps,
      isEditable,
      onAppsDraftChange,
      onBannerDraftChange,
      onCustomLinksDraftChange,
      onFacebookDraftChange,
      onInstagramDraftChange,
      onTikTokDraftChange,
      onXDraftChange,
      onYouTubeDraftChange,
      draftProfile,
      uid,
    ]
  );

  /** Phase1: 常にワンカラム縦積み（PC で隣接セクションを横並びにしない） */
  const layoutMode = blockLayoutMode(draftProfile.settings?.blockLayoutVersion);
  const canEditBlocks = isEditable && layoutMode !== 'unsupported';

  const renderedSections = useMemo(() => {
    return sectionOrder.map((key) => {
      const node = sectionMap[key];
      if (!node) return null;
      const label = isKnownBlockType(key) ? BLOCK_LABELS[key] : key;
      return (
        <div className="user-page-section" key={`${key}-${formEpoch}`}>
          {canEditBlocks ? (
            <div className="block-edit-frame">
              <BlockDetachControl label={label} onDetach={() => applyBlockEdit({ op: 'remove', block: key })} />
              {node}
            </div>
          ) : (
            node
          )}
        </div>
      );
    });
  }, [applyBlockEdit, canEditBlocks, formEpoch, sectionMap, sectionOrder]);

  return (
    <div
      className={
        isEditable
          ? `profile-edit-with-save-bar${showSaveBar ? ' profile-save-bar-open' : ''}`
          : undefined
      }
    >
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
          key={`profile-${formEpoch}`}
          uid={uid}
          isEditable={isEditable}
          initialProfile={profile}
          onBasicDraftChange={isEditable ? onBasicDraftChange : undefined}
          onContactDraftChange={isEditable ? onContactDraftChange : undefined}
        />

        <UserPageClient
          key={`reorder-${formEpoch}`}
          uid={uid}
          profile={profile}
          isEditable={isEditable}
          layoutOrder={sectionOrder}
          blockLayoutVersion={draftProfile.settings?.blockLayoutVersion}
          allowReorder={canEditBlocks}
          onSectionOrderChange={isEditable ? onSectionOrderDraftChange : undefined}
        />

        {renderedSections}

        {canEditBlocks ? (
          <BlockAddControl
            available={availableBlocks(sectionOrder)}
            onAdd={(block) => applyBlockEdit({ op: 'add', block })}
          />
        ) : null}

        <div className="user-page-section">
          <QRCodeBlock uid={uid} initialName={profile?.name} />
        </div>
      </main>

      {isEditable ? (
        <UnsavedChangesLeaveGuard
          isDirty={isDirty}
          isSaving={isSaving}
          saveDraftProfile={saveDraftProfile}
        />
      ) : null}

      {showSaveBar ? (
        <div className="profile-save-bar" role="status">
          {isDirty || isSaving ? (
            <>
              <p className="profile-save-bar__label">未保存の変更があります</p>
              <button
                type="button"
                onClick={() => void saveDraftProfile()}
                disabled={isSaving}
                style={{
                  ...buttonPrimary,
                  ...(isSaving ? { opacity: 0.65, cursor: 'wait' } : {}),
                }}
              >
                {isSaving ? '保存中...' : '変更を保存'}
              </button>
              <button
                type="button"
                className="block-placement-btn"
                onClick={discardDraft}
                disabled={isSaving}
              >
                変更を破棄
              </button>
            </>
          ) : null}
          {saveMessage ? (
            <p
              className="profile-save-bar__status"
              style={{ color: saveMessageTone === 'ok' ? '#15803d' : '#b91c1c' }}
            >
              {saveMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

