/**
 * プロフィール SEO 用の既存公開判定・title 組み立て。
 * 公開フラグは Firestore `profile.isPublic`（未設定は公開）。新フィールドは作らない。
 */

const TITLE_NAME_MAX = 48;
const TITLE_JOB_MAX = 48;

export function isProfilePublic(profile: unknown): boolean {
  if (!profile || typeof profile !== 'object') return true;
  return (profile as { isPublic?: unknown }).isPublic !== false;
}

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

/** 検索結果・OG 用。肩書が空なら `{名前}｜Procom` */
export function buildProfileDocumentTitle(nameRaw: unknown, jobTitleRaw: unknown): string {
  const name =
    typeof nameRaw === 'string' && nameRaw.trim()
      ? clip(nameRaw, TITLE_NAME_MAX)
      : 'Procomユーザー';
  const job =
    typeof jobTitleRaw === 'string' && jobTitleRaw.trim()
      ? clip(jobTitleRaw, TITLE_JOB_MAX)
      : '';
  if (!job) return `${name}｜Procom`;
  return `${name}｜${job}｜Procom`;
}

/** 一覧カード用: 先頭1枚のみ（過剰なプロフィール露出を抑える） */
export function slimProfileForList(profile: Record<string, unknown>): {
  name: string;
  title: string;
  photos: unknown[];
} {
  const name = typeof profile.name === 'string' ? profile.name : '';
  const title = typeof profile.title === 'string' ? profile.title : '';
  const raw = Array.isArray(profile.photos) ? profile.photos : [];
  const first = raw[0];
  const photos: unknown[] = [];
  if (typeof first === 'string') {
    photos.push(first);
  } else if (first && typeof first === 'object' && first !== null && 'url' in first) {
    const u = (first as { url?: unknown; position?: unknown }).url;
    if (typeof u === 'string') {
      const pos = (first as { position?: unknown }).position;
      if (typeof pos === 'number' && !Number.isNaN(pos)) {
        photos.push({ url: u, position: Math.min(100, Math.max(0, pos)) });
      } else {
        photos.push({ url: u });
      }
    }
  }
  return { name, title, photos };
}
