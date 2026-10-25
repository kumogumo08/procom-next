'use client';

import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  type SortingStrategy,
} from '@dnd-kit/sortable';
import { buttonPrimary } from '@/components/ui/cardStyles';
import OshiButton from '@/components/OshiButton';
import { WorkRequestButton } from '@/components/ContactButtonBlock';
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
import CalendarBlock from '@/components/CalendarBlock';
import UnsavedChangesLeaveGuard from '@/components/UnsavedChangesLeaveGuard';
import {
  BlockAddControl,
  BlockDragPreview,
  PALETTE_DRAG_PREFIX,
  PROFILE_ADD_PANEL_ID,
  PROFILE_INSERT_COLUMN_ID,
  ProfileInsertColumn,
  SortableProfileBlock,
  blockIdFromPaletteDrag,
} from '@/components/BlockPlacementControls';
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
  showsFixedCalendar,
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
    calendarLayout?: 'section';
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
      ...(settings.calendarLayout === 'section' ? { calendarLayout: 'section' as const } : {}),
    },
  };

  if (Array.isArray(draft.bannerLinks)) {
    payload.bannerLinks = draft.bannerLinks.filter((b) => isUploadedBannerUrl(b.imageUrl));
  }

  return payload;
}

const SHOW_FLAG_DEFAULT = true;
const BLOCK_DRAG_PREVIEW_WIDTH = 220;
const BLOCK_DRAG_PREVIEW_HEIGHT = 76;
const BLOCK_DRAG_PREVIEW_STYLE = {
  width: `min(${BLOCK_DRAG_PREVIEW_WIDTH}px, calc(100vw - 32px))`,
  height: BLOCK_DRAG_PREVIEW_HEIGHT,
  pointerEvents: 'none' as const,
};
/** 動画の高さでは動かさない。隙間が分かる程度だけ隣をずらす */
const INSERT_NUDGE_PX = 36;
const INSERT_ADOPT_PX = 28;
const INSERT_HYSTERESIS_PX = 10;

type LayoutRow = { id: string; top: number; bottom: number };
type InsertGap = { y: number; upper: number | null; lower: number | null };
type InsertGuide = { lineId: string; edge: 'before' | 'after' };

/**
 * プレビュー中心がブロック境界の近くに来たときだけ挿入先を切り替える。
 * 掴んだ直後はブロック内側なので、上の境界へは飛ばない。
 */
function pickBlockInsertion(
  rows: LayoutRow[],
  activeId: string,
  y: number,
  previousGapIndex: number | null
): { overId: string; guide: InsertGuide | null; gapIndex: number | null } {
  const activeIndex = rows.findIndex((row) => row.id === activeId);
  if (activeIndex < 0 || rows.length === 0) {
    return { overId: activeId, guide: null, gapIndex: null };
  }

  const active = rows[activeIndex];
  const gaps: InsertGap[] = [{ y: rows[0].top, upper: null, lower: 0 }];
  for (let index = 0; index < rows.length - 1; index += 1) {
    gaps.push({
      y: (rows[index].bottom + rows[index + 1].top) / 2,
      upper: index,
      lower: index + 1,
    });
  }
  gaps.push({
    y: rows[rows.length - 1].bottom,
    upper: rows.length - 1,
    lower: null,
  });

  let nearest = 0;
  let nearestDist = Math.abs(y - gaps[0].y);
  for (let index = 1; index < gaps.length; index += 1) {
    const dist = Math.abs(y - gaps[index].y);
    if (dist < nearestDist) {
      nearest = index;
      nearestDist = dist;
    }
  }

  const insideActive = y >= active.top && y <= active.bottom;
  let chosen: number | null = previousGapIndex;
  if (nearestDist <= INSERT_ADOPT_PX) {
    chosen = nearest;
    if (
      previousGapIndex != null &&
      previousGapIndex !== nearest &&
      previousGapIndex >= 0 &&
      previousGapIndex < gaps.length &&
      Math.abs(y - gaps[previousGapIndex].y) <= nearestDist + INSERT_HYSTERESIS_PX
    ) {
      chosen = previousGapIndex;
    }
  } else if (
    previousGapIndex != null &&
    previousGapIndex >= 0 &&
    previousGapIndex < gaps.length &&
    Math.abs(y - gaps[previousGapIndex].y) <= INSERT_ADOPT_PX + INSERT_HYSTERESIS_PX
  ) {
    chosen = previousGapIndex;
  } else if (insideActive) {
    chosen = null;
  } else if (previousGapIndex == null) {
    chosen = nearest;
  }

  if (chosen == null) {
    return { overId: activeId, guide: null, gapIndex: null };
  }

  const gap = gaps[chosen];
  const target = insertionTargetIndex(activeIndex, gap, rows.length);
  const overId = rows[target].id;
  if (target === activeIndex) {
    return { overId, guide: null, gapIndex: chosen };
  }
  return { overId, guide: insertionGuide(rows, activeId, gap), gapIndex: chosen };
}

function insertionTargetIndex(activeIndex: number, gap: InsertGap, count: number): number {
  if (gap.upper == null && gap.lower != null) return 0;
  if (gap.lower == null && gap.upper != null) return count - 1;
  if (gap.upper == null || gap.lower == null) return activeIndex;
  if (activeIndex <= gap.upper) {
    return activeIndex === gap.upper ? gap.lower : gap.upper;
  }
  return activeIndex === gap.lower ? gap.upper : gap.lower;
}

function insertionGuide(rows: LayoutRow[], activeId: string, gap: InsertGap): InsertGuide | null {
  if (gap.upper == null && gap.lower != null) {
    return { lineId: rows[gap.lower].id, edge: 'before' };
  }
  if (gap.lower == null && gap.upper != null) {
    return { lineId: rows[gap.upper].id, edge: 'after' };
  }
  if (gap.lower != null && rows[gap.lower].id !== activeId) {
    return { lineId: rows[gap.lower].id, edge: 'before' };
  }
  if (gap.upper != null) {
    return { lineId: rows[gap.upper].id, edge: 'after' };
  }
  return null;
}

const sectionSortingStrategy: SortingStrategy = ({ activeIndex, index, overIndex }) => {
  const idle = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
  if (activeIndex < 0 || overIndex < 0 || index === activeIndex || activeIndex === overIndex) {
    return idle;
  }
  if (index > activeIndex && index <= overIndex) {
    return { x: 0, y: -INSERT_NUDGE_PX, scaleX: 1, scaleY: 1 };
  }
  if (index < activeIndex && index >= overIndex) {
    return { x: 0, y: INSERT_NUDGE_PX, scaleX: 1, scaleY: 1 };
  }
  return idle;
};

const restrictPlacedBlockAxis: Modifier = (args) => {
  const id = args.active == null ? '' : String(args.active.id);
  if (id.startsWith(PALETTE_DRAG_PREFIX)) return args.transform;
  return restrictToVerticalAxis(args);
};

function placedLayoutRows(
  containers: { id: UniqueIdentifier }[],
  rects: { get: (id: UniqueIdentifier) => { top: number; bottom: number } | null | undefined }
): LayoutRow[] {
  const rows: LayoutRow[] = [];
  for (const container of containers) {
    const id = String(container.id);
    if (
      id === PROFILE_INSERT_COLUMN_ID ||
      id === PROFILE_ADD_PANEL_ID ||
      id.startsWith(PALETTE_DRAG_PREFIX)
    ) {
      continue;
    }
    const rect = rects.get(container.id);
    if (!rect) continue;
    rows.push({ id, top: rect.top, bottom: rect.bottom });
  }
  rows.sort((left, right) => left.top - right.top || left.id.localeCompare(right.id));
  return rows;
}

function guideForNewBlock(rows: LayoutRow[], gapIndex: number): InsertGuide | null {
  if (rows.length === 0) return { lineId: '__empty__', edge: 'before' };
  if (gapIndex <= 0) return { lineId: rows[0].id, edge: 'before' };
  if (gapIndex >= rows.length) return { lineId: rows[rows.length - 1].id, edge: 'after' };
  return { lineId: rows[gapIndex].id, edge: 'before' };
}

/** 追加パネルからのドラッグ。プロフィール列の中に入ったときだけ、境目へ挿入する */
function pickPaletteInsertion(
  rows: LayoutRow[],
  x: number,
  y: number,
  column: { left: number; right: number; top: number; bottom: number } | null,
  panel: { left: number; right: number; top: number; bottom: number } | null,
  previousGapIndex: number | null
): { index: number; guide: InsertGuide | null; gapIndex: number | null } | null {
  if (panel && x >= panel.left && x <= panel.right && y >= panel.top && y <= panel.bottom) return null;
  if (!column) return null;
  const xInside = x >= column.left && x <= column.right;
  const yInside = y >= column.top - 40 && y <= column.bottom + 40;
  if (!xInside || !yInside) return null;
  if (rows.length === 0) {
    const yInside = y >= column.top - 24 && y <= column.bottom + 48;
    if (!yInside) return null;
    return { index: 0, guide: guideForNewBlock(rows, 0), gapIndex: 0 };
  }

  const gaps: InsertGap[] = [{ y: rows[0].top, upper: null, lower: 0 }];
  for (let index = 0; index < rows.length - 1; index += 1) {
    gaps.push({
      y: (rows[index].bottom + rows[index + 1].top) / 2,
      upper: index,
      lower: index + 1,
    });
  }
  gaps.push({
    y: rows[rows.length - 1].bottom,
    upper: rows.length - 1,
    lower: null,
  });

  let nearest = 0;
  let nearestDist = Math.abs(y - gaps[0].y);
  for (let index = 1; index < gaps.length; index += 1) {
    const dist = Math.abs(y - gaps[index].y);
    if (dist < nearestDist) {
      nearest = index;
      nearestDist = dist;
    }
  }

  let chosen: number | null = previousGapIndex;
  if (nearestDist <= INSERT_ADOPT_PX) {
    chosen = nearest;
    if (
      previousGapIndex != null &&
      previousGapIndex !== nearest &&
      previousGapIndex >= 0 &&
      previousGapIndex < gaps.length &&
      Math.abs(y - gaps[previousGapIndex].y) <= nearestDist + INSERT_HYSTERESIS_PX
    ) {
      chosen = previousGapIndex;
    }
  } else if (
    previousGapIndex != null &&
    previousGapIndex >= 0 &&
    previousGapIndex < gaps.length &&
    Math.abs(y - gaps[previousGapIndex].y) <= INSERT_ADOPT_PX + INSERT_HYSTERESIS_PX
  ) {
    chosen = previousGapIndex;
  } else if (previousGapIndex == null) {
    chosen = nearest;
  }

  if (chosen == null) return null;
  const index = Math.min(Math.max(chosen, 0), rows.length);
  return { index, guide: guideForNewBlock(rows, index), gapIndex: chosen };
}

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
  const savedPayload = normalizePayloadForCompare(
    buildDraftSavePayload(saved, {
      apps: fallbacks.apps,
      sectionOrder: resolveSectionOrder(
        saved.settings?.sectionOrder,
        saved.settings?.blockLayoutVersion
      ),
    })
  );
  const draftPayload = normalizePayloadForCompare(
    buildDraftSavePayload(draft, {
      apps: fallbacks.apps,
      sectionOrder: fallbacks.sectionOrder,
    })
  );
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
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [paletteDrag, setPaletteDrag] = useState(false);
  const [addPanelCloseTick, setAddPanelCloseTick] = useState(0);
  const [insertGuide, setInsertGuide] = useState<InsertGuide | null>(null);
  const layoutSnapshotRef = useRef<{ anchorId: string; anchorTop: number; rows: LayoutRow[] } | null>(
    null
  );
  const gapIndexRef = useRef<number | null>(null);
  const paletteGapRef = useRef<number | null>(null);
  const paletteInsertRef = useRef<number | null>(null);
  const insertGuideRef = useRef<InsertGuide | null>(null);

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
      if (!next) return false;
      const current = draftProfileRef.current.settings;
      const sameOrder = JSON.stringify(next.sectionOrder) === JSON.stringify(current?.sectionOrder ?? []);
      const sameVersion = next.blockLayoutVersion === current?.blockLayoutVersion;
      if (sameOrder && sameVersion) return false;
      setSectionOrder(next.sectionOrder);
      updateDraftSettings({
        sectionOrder: next.sectionOrder,
        blockLayoutVersion: next.blockLayoutVersion,
        ...(edit.block === 'Calendar' ? { calendarLayout: 'section' as const } : {}),
      });
      return true;
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
      Calendar: <CalendarBlock isEditable={isEditable} uid={uid} />,
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

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const clearDragVisual = useCallback(() => {
    layoutSnapshotRef.current = null;
    gapIndexRef.current = null;
    paletteGapRef.current = null;
    paletteInsertRef.current = null;
    insertGuideRef.current = null;
    setDraggingBlockId(null);
    setPaletteDrag(false);
    setInsertGuide(null);
  }, []);

  const publishInsertGuide = useCallback(() => {
    const next = insertGuideRef.current;
    setInsertGuide((prev) => {
      if (prev?.lineId === next?.lineId && prev?.edge === next?.edge) return prev;
      if (!prev && !next) return prev;
      return next;
    });
  }, []);

  const sectionCollisionDetection = useCallback<CollisionDetection>((args) => {
    const activeId = String(args.active.id);
    const previewHeight =
      args.collisionRect.height > BLOCK_DRAG_PREVIEW_HEIGHT + 8
        ? BLOCK_DRAG_PREVIEW_HEIGHT
        : args.collisionRect.height;
    const previewWidth =
      args.collisionRect.width > BLOCK_DRAG_PREVIEW_WIDTH + 8
        ? BLOCK_DRAG_PREVIEW_WIDTH
        : args.collisionRect.width;
    const y = args.collisionRect.top + previewHeight / 2;
    const x = args.collisionRect.left + previewWidth / 2;

    if (activeId.startsWith(PALETTE_DRAG_PREFIX)) {
      const rows = placedLayoutRows(args.droppableContainers, args.droppableRects);
      const column = args.droppableRects.get(PROFILE_INSERT_COLUMN_ID) ?? null;
      const panel = args.droppableRects.get(PROFILE_ADD_PANEL_ID) ?? null;
      const picked = pickPaletteInsertion(rows, x, y, column, panel, paletteGapRef.current);
      paletteGapRef.current = picked?.gapIndex ?? null;
      paletteInsertRef.current = picked?.index ?? null;
      insertGuideRef.current = picked?.guide ?? null;
      return [{ id: picked ? PROFILE_INSERT_COLUMN_ID : activeId }];
    }

    const activeRect = args.droppableRects.get(args.active.id);
    let snapshot = layoutSnapshotRef.current;
    if (!snapshot || snapshot.anchorId !== activeId) {
      const rows = placedLayoutRows(args.droppableContainers, args.droppableRects);
      if (activeRect && rows.length > 0) {
        snapshot = { anchorId: activeId, anchorTop: activeRect.top, rows };
        layoutSnapshotRef.current = snapshot;
      }
    }

    const scrollDelta = snapshot && activeRect ? activeRect.top - snapshot.anchorTop : 0;
    const rows =
      snapshot?.rows.map((row) => ({
        ...row,
        top: row.top + scrollDelta,
        bottom: row.bottom + scrollDelta,
      })) ?? [];
    const picked = pickBlockInsertion(rows, activeId, y, gapIndexRef.current);
    gapIndexRef.current = picked.gapIndex;
    insertGuideRef.current = picked.guide;
    paletteInsertRef.current = null;
    return [{ id: picked.overId }];
  }, []);

  const handleSectionDragStart = useCallback((event: DragStartEvent) => {
    const activeId = String(event.active.id);
    const paletteBlock = blockIdFromPaletteDrag(activeId);
    layoutSnapshotRef.current = null;
    gapIndexRef.current = null;
    paletteGapRef.current = null;
    paletteInsertRef.current = null;
    insertGuideRef.current = null;
    setInsertGuide(null);
    setPaletteDrag(paletteBlock != null);
    setDraggingBlockId(paletteBlock ?? activeId);
  }, []);

  const handleSectionDragCancel = useCallback(() => {
    clearDragVisual();
  }, [clearDragVisual]);

  const handleSectionDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = String(event.active.id);
      const paletteBlock = blockIdFromPaletteDrag(activeId);
      if (paletteBlock) {
        const index = paletteInsertRef.current;
        clearDragVisual();
        if (index == null) return;
        const added = applyBlockEdit({ op: 'add', block: paletteBlock, index });
        if (added) setAddPanelCloseTick((current) => current + 1);
        return;
      }

      clearDragVisual();
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = sectionOrder.indexOf(String(active.id));
      const newIndex = sectionOrder.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      onSectionOrderDraftChange(arrayMove(sectionOrder, oldIndex, newIndex));
    },
    [applyBlockEdit, clearDragVisual, onSectionOrderDraftChange, sectionOrder]
  );

  const visibleSectionIds = sectionOrder.filter((key) => Boolean(sectionMap[key]));

  const renderedSections = useMemo(() => {
    return sectionOrder.map((key) => {
      const node = sectionMap[key];
      if (!node) return null;
      const label = isKnownBlockType(key) ? BLOCK_LABELS[key] : key;
      return (
        <div className="user-page-section" key={`${key}-${formEpoch}`}>
          {canEditBlocks ? (
            <SortableProfileBlock
              id={key}
              label={label}
              insertEdge={insertGuide?.lineId === key ? insertGuide.edge : null}
              onDetach={() => applyBlockEdit({ op: 'remove', block: key })}
            >
              {node}
            </SortableProfileBlock>
          ) : (
            node
          )}
        </div>
      );
    });
  }, [applyBlockEdit, canEditBlocks, formEpoch, insertGuide, sectionMap, sectionOrder]);

  return (
    <div
      className={
        isEditable
          ? `profile-edit-with-save-bar${showSaveBar ? ' profile-save-bar-open' : ''}`
          : undefined
      }
    >
      {profile?.name && (
        <h2 className="profile-page-heading">
          <span className="profile-page-heading__kicker" lang="en" aria-hidden="true">
            CREATOR PROFILE
          </span>
          <span className="profile-page-heading__name">{profile.name}</span>
          <span className="profile-page-heading__rule" aria-hidden="true" />
          <span className="profile-page-heading__page">
            <span className="sr-only">さんの</span>
            プロフィールページ
          </span>
        </h2>
      )}

      <main>
        <div className="profile-action-row">
          <OshiButton uid={uid} />
          {typeof profile.emailForContact === 'string' && profile.emailForContact.trim() ? (
            <WorkRequestButton email={profile.emailForContact} />
          ) : null}
        </div>
        <XShareButton uid={uid} name={profile?.name} />

        <UserProfileSection
          key={`profile-${formEpoch}`}
          uid={uid}
          isEditable={isEditable}
          initialProfile={profile}
          showFixedCalendar={showsFixedCalendar(draftProfile.settings?.calendarLayout, sectionOrder)}
          onBasicDraftChange={isEditable ? onBasicDraftChange : undefined}
          onContactDraftChange={isEditable ? onContactDraftChange : undefined}
        />

        <UserPageClient
          key={`effects-${formEpoch}`}
          uid={uid}
          profile={profile}
          isEditable={isEditable}
        />

        {canEditBlocks ? (
          <DndContext
            sensors={sensors}
            collisionDetection={sectionCollisionDetection}
            modifiers={[restrictPlacedBlockAxis]}
            onDragStart={handleSectionDragStart}
            onDragMove={publishInsertGuide}
            onDragCancel={handleSectionDragCancel}
            onDragEnd={handleSectionDragEnd}
          >
            <ProfileInsertColumn
              empty={visibleSectionIds.length === 0}
              highlighted={insertGuide?.lineId === '__empty__'}
            >
              <SortableContext items={visibleSectionIds} strategy={sectionSortingStrategy}>
                {renderedSections}
              </SortableContext>
            </ProfileInsertColumn>
            <DragOverlay
              adjustScale={false}
              dropAnimation={null}
              modifiers={[restrictPlacedBlockAxis]}
              zIndex={paletteDrag ? 1080 : 900}
              style={BLOCK_DRAG_PREVIEW_STYLE}
            >
              {draggingBlockId ? <BlockDragPreview id={draggingBlockId} /> : null}
            </DragOverlay>
            <BlockAddControl
              available={availableBlocks(sectionOrder)}
              closeTick={addPanelCloseTick}
              dragActive={paletteDrag}
              onAdd={(block) => applyBlockEdit({ op: 'add', block })}
            />
          </DndContext>
        ) : (
          renderedSections
        )}

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

