import Link from 'next/link';

import { visiblePageNumbers } from '@/lib/publicUserDirectory';

import styles from './users.module.css';

function withGaps(pages: number[]): Array<number | 'gap'> {
  const items: Array<number | 'gap'> = [];
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    if (index > 0 && page - pages[index - 1] > 1) items.push('gap');
    items.push(page);
  }
  return items;
}

export default function UsersPagination({
  page,
  pageCount,
  hrefForPage,
  pageNumbers,
}: {
  page: number;
  pageCount: number;
  hrefForPage: (page: number) => string;
  pageNumbers?: number[];
}) {
  if (pageCount <= 1 && (!pageNumbers || pageNumbers.length <= 1)) return null;

  const items = pageNumbers ? withGaps(pageNumbers) : visiblePageNumbers(page, pageCount);

  return (
    <nav className={styles.pagination} aria-label="ページ">
      {page > 1 ? (
        <Link href={hrefForPage(page - 1)} className={styles.pageLink} rel="prev">
          前へ
        </Link>
      ) : (
        <span className={styles.pageDisabled}>前へ</span>
      )}
      {items.map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} className={styles.pageGap} aria-hidden="true">
            …
          </span>
        ) : item === page ? (
          <span key={item} className={styles.pageCurrent} aria-current="page">
            {item}
          </span>
        ) : (
          <Link key={item} href={hrefForPage(item)} className={styles.pageLink}>
            {item}
          </Link>
        )
      )}
      {page < pageCount ? (
        <Link href={hrefForPage(page + 1)} className={styles.pageLink} rel="next">
          次へ
        </Link>
      ) : (
        <span className={styles.pageDisabled}>次へ</span>
      )}
    </nav>
  );
}
