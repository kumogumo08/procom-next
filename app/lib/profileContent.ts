import { clampPhotoPositionY } from '@/lib/photoPosition';
import { normalizeInstagramUrl } from '@/lib/sns';
import { createdAtToMillis } from '@/lib/publicUserDirectory';

/**
 * スポットライトの「最近の更新」に使う時刻。
 * 閲覧数・推し数・内部同期では更新しない。未設定は null。
 */

export function positiveMillis(value: unknown): number | null {
  const ms = createdAtToMillis(value);
  if (ms == null || ms <= 0) return null;
  return ms;
}

export function readContentUpdatedAtMs(profile: unknown): number | null {
  if (!profile || typeof profile !== 'object') return null;
  return positiveMillis((profile as { contentUpdatedAtMs?: unknown }).contentUpdatedAtMs);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter((item) => item.length > 0);
}

function youtubeMode(value: unknown): string {
  const mode = text(value);
  return mode === '' || mode === 'latest' ? 'latest' : mode;
}

function photosOf(value: unknown): Array<{ url: string; position: number }> {
  if (!Array.isArray(value)) return [];
  const photos: Array<{ url: string; position: number }> = [];
  for (const item of value) {
    const url = typeof item === 'string' ? item.trim() : text(item && typeof item === 'object' ? (item as { url?: unknown }).url : '');
    if (!url) continue;
    const rawPosition = item && typeof item === 'object' ? (item as { position?: unknown }).position : undefined;
    photos.push({ url, position: clampPhotoPositionY(rawPosition) });
  }
  return photos;
}

function linkList(value: unknown): Array<Record<string, string>> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const normalized: Record<string, string> = {};
      for (const key of Object.keys(record).sort()) {
        const field = record[key];
        if (typeof field === 'string' && field.trim()) normalized[key] = field.trim();
        else if (typeof field === 'number' && Number.isFinite(field)) normalized[key] = String(field);
      }
      return Object.keys(normalized).length > 0 ? normalized : null;
    })
    .filter((item): item is Record<string, string> => item != null);
}

function calendarOf(value: unknown): Array<{ date: string; events: string[] }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as { date?: unknown; events?: unknown };
      const date = text(record.date);
      if (!date) return null;
      const events = Array.isArray(record.events) ? record.events.map((event) => text(event)).filter(Boolean) : [];
      return { date, events };
    })
    .filter((item): item is { date: string; events: string[] } => item != null)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function appsOf(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const release = record.releaseStatus;
    return {
      id: text(record.id),
      title: text(record.title),
      shortDescription: text(record.shortDescription),
      appStoreUrl: text(record.appStoreUrl),
      googlePlayUrl: text(record.googlePlayUrl),
      websiteUrl: text(record.websiteUrl),
      screenshotUrls: textList(record.screenshotUrls),
      showQrCode: record.showQrCode !== false,
      displayOrder: typeof record.displayOrder === 'number' && Number.isFinite(record.displayOrder) ? record.displayOrder : index,
      releaseStatus: release === 'review' || release === 'coming_soon' ? release : 'published',
    };
  });
}

/** 表示内容が同じ保存や、設定・推し数だけを変えても一致する。 */
export function profileContentFingerprint(profile: unknown): string {
  const record = profile && typeof profile === 'object' ? (profile as Record<string, unknown>) : {};
  const snapshot = {
    name: text(record.name),
    title: text(record.title),
    bio: text(record.bio),
    emailForContact: text(record.emailForContact),
    youtubeChannelId: text(record.youtubeChannelId),
    instagramPostUrl: normalizeInstagramUrl(text(record.instagramPostUrl)),
    xUsername: text(record.xUsername),
    facebookUrl: text(record.facebookUrl),
    facebookUsername: text(record.facebookUsername),
    youtubeMode: youtubeMode(record.youtubeMode),
    tiktokUrls: textList(record.tiktokUrls),
    manualYouTubeUrls: textList(record.manualYouTubeUrls),
    photos: photosOf(record.photos),
    customLinks: linkList(record.customLinks),
    bannerLinks: linkList(record.bannerLinks),
    calendarEvents: calendarOf(record.calendarEvents),
    apps: appsOf(record.apps),
  };
  return JSON.stringify(snapshot);
}

export function meaningfulProfileChanged(before: unknown, after: unknown): boolean {
  return profileContentFingerprint(before) !== profileContentFingerprint(after);
}

/** 実質的な変更のときだけ現在時刻。変化がなければ undefined（既存の時刻を残す）。 */
export function nextContentStamp(before: unknown, after: unknown, now = Date.now()): number | undefined {
  if (!meaningfulProfileChanged(before, after)) return undefined;
  return now;
}
