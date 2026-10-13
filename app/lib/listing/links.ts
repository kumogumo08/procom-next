/** 固定ページは常に ?page=。/users 自体は新着で、page=1 とは別URL。 */

export function fixedPageHref(page: number): string {
  return `/users?page=${page}`;
}

/** 隣接、先頭、末尾、±10/20/50/100。全ページ番号は出さない。 */
export function crawlPageNumbers(current: number, pageCount: number): number[] {
  if (pageCount <= 1) return pageCount === 1 ? [1] : [];
  const found = new Set<number>();
  const add = (n: number) => {
    if (n >= 1 && n <= pageCount) found.add(n);
  };
  add(1);
  add(pageCount);
  add(current - 1);
  add(current);
  add(current + 1);
  for (const step of [10, 20, 50, 100]) {
    add(current - step);
    add(current + step);
  }
  return [...found].sort((a, b) => a - b);
}

export function pageCountFromNextSeq(nextSeq: number): number {
  if (nextSeq <= 1) return 0;
  return Math.ceil((nextSeq - 1) / 20);
}
