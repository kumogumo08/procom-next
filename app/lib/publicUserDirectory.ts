/**
 * 公開プロフィール一覧の並び・ページ分割。
 * Firestore には依存しない。
 *
 * 並び: createdAt 降順。同時刻は uid 昇順。
 * createdAt が無い既存ユーザーは末尾（uid 昇順）で、ページから落とさない。
 */

export const PUBLIC_USERS_PAGE_SIZE = 20;

export type DirectoryOrderKey = {
  uid: string;
  createdAtMs: number | null;
};

export function createdAtToMillis(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const ms = Date.parse(value.trim());
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'object') {
    const maybe = value as {
      toDate?: () => Date;
      seconds?: unknown;
      _seconds?: unknown;
    };
    if (typeof maybe.toDate === 'function') {
      try {
        const ms = maybe.toDate().getTime();
        return Number.isFinite(ms) ? ms : null;
      } catch {
        return null;
      }
    }
    const seconds =
      typeof maybe.seconds === 'number'
        ? maybe.seconds
        : typeof maybe._seconds === 'number'
          ? maybe._seconds
          : null;
    if (seconds !== null && Number.isFinite(seconds)) return seconds * 1000;
  }
  return null;
}

/** createdAt 降順、未設定は末尾、同順位は uid 昇順でページ境界を固定する。 */
export function compareDirectoryOrder(a: DirectoryOrderKey, b: DirectoryOrderKey): number {
  if (a.createdAtMs !== null && b.createdAtMs !== null && a.createdAtMs !== b.createdAtMs) {
    return b.createdAtMs - a.createdAtMs;
  }
  if (a.createdAtMs !== null && b.createdAtMs === null) return -1;
  if (a.createdAtMs === null && b.createdAtMs !== null) return 1;
  if (a.uid < b.uid) return -1;
  if (a.uid > b.uid) return 1;
  return 0;
}

export type UsersPageParam =
  | { status: 'absent' }
  | { status: 'invalid' }
  | { status: 'ok'; page: number };

/** 未指定だけ1ページ目。空文字・整数以外・0以下・6桁超は不正。 */
export function parseUsersPageParam(raw: string | undefined): UsersPageParam {
  if (raw === undefined) return { status: 'absent' };
  const text = raw.trim();
  if (text === '') return { status: 'invalid' };
  if (!/^[1-9]\d{0,5}$/.test(text)) return { status: 'invalid' };
  const page = Number(text);
  if (!Number.isSafeInteger(page) || page < 1) return { status: 'invalid' };
  return { status: 'ok', page };
}

export function directoryPageCount(total: number, pageSize = PUBLIC_USERS_PAGE_SIZE): number {
  if (total <= 0) return 1;
  return Math.ceil(total / pageSize);
}

export function sliceDirectoryPage<T>(
  items: readonly T[],
  page: number,
  pageSize = PUBLIC_USERS_PAGE_SIZE
): T[] {
  const start = (page - 1) * pageSize;
  if (start >= items.length || start < 0) return [];
  return items.slice(start, start + pageSize);
}

/** 1ページ目は `/users`。2ページ目以降は `?page=`。検索語があるときは q を維持する。 */
export function usersPageHref(page: number, q?: string): string {
  const params = new URLSearchParams();
  const query = q?.trim() ?? '';
  if (query) params.set('q', query);
  if (page > 1) params.set('page', String(page));
  const search = params.toString();
  return search ? `/users?${search}` : '/users';
}

/** 検索URLは従来どおり `/users` に正規化する。一覧は1ページ目が `/users`、以降は各ページ自身。 */
export function usersCanonicalPath(page: number, q?: string): string {
  if (q?.trim()) return '/users';
  return usersPageHref(page);
}

export function visiblePageNumbers(page: number, pageCount: number): Array<number | 'gap'> {
  if (pageCount <= 1) return [1];
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const items: Array<number | 'gap'> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) items.push('gap');
  for (let n = start; n <= end; n += 1) items.push(n);
  if (end < pageCount - 1) items.push('gap');
  items.push(pageCount);
  return items;
}
