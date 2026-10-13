import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import {
  getCachedFixedPage,
  getCachedListingPageCount,
  getNewestListed,
  type ListedCard,
} from '@/lib/listing/firestoreListing';
import { getLegacyDirectory } from '@/lib/listing/legacyDirectory';
import { crawlPageNumbers, fixedPageHref } from '@/lib/listing/links';
import { isListingDirectoryReady } from '@/lib/listing/readiness';
import {
  directoryPageCount,
  parseUsersPageParam,
  sliceDirectoryPage,
  usersCanonicalPath,
  usersPageHref,
} from '@/lib/publicUserDirectory';

import UsersPageClient from './UsersPageClient';

export const runtime = 'nodejs';
export const revalidate = 60;

const DIRECTORY_TITLE = 'ユーザー検索・一覧 | Procom';
const DIRECTORY_DESCRIPTION =
  'Procomに登録されているユーザーを名前・肩書きで検索できます。';

function firstQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function toListUser(card: ListedCard) {
  return {
    uid: card.uid,
    profile: {
      name: card.name,
      title: card.title,
      photos: card.photoUrl ? [{ url: card.photoUrl }] : [],
    },
  };
}

type SearchParams = {
  q?: string | string[];
  page?: string | string[];
};

type Listing =
  | { kind: 'search'; q: string; searchPage: number }
  | { kind: 'invalid'; redirectTo: string }
  | { kind: 'redirect'; redirectTo: string }
  | { kind: 'newest'; users: ReturnType<typeof toListUser>[]; pageCount: number }
  | {
      kind: 'fixed';
      page: number;
      pageCount: number;
      users: ReturnType<typeof toListUser>[];
    }
  | { kind: 'error' }
  | {
      kind: 'legacy';
      page: number;
      pageCount: number;
      users: ReturnType<typeof toListUser>[];
    };

async function resolveLegacy(q: string, requested: number, pageSpecified: boolean): Promise<Listing> {
  if (q) return { kind: 'search', q, searchPage: requested };
  try {
    const all = await getLegacyDirectory();
    const pageCount = directoryPageCount(all.length);
    if (pageSpecified && requested === 1) {
      return { kind: 'redirect', redirectTo: '/users' };
    }
    if (requested > pageCount) {
      return { kind: 'redirect', redirectTo: usersPageHref(pageCount) };
    }
    return {
      kind: 'legacy',
      page: requested,
      pageCount,
      users: sliceDirectoryPage(all, requested).map((row) =>
        toListUser({ uid: row.uid, name: row.name, title: row.title, photoUrl: row.photoUrl })
      ),
    };
  } catch (err) {
    console.error('legacy directory failed:', err);
    return { kind: 'error' };
  }
}

async function resolveListing(sp: SearchParams): Promise<Listing> {
  const q = firstQueryValue(sp.q).trim();
  const pageRaw = sp.page === undefined ? undefined : firstQueryValue(sp.page);
  const parsed = parseUsersPageParam(pageRaw);
  if (parsed.status === 'invalid') {
    return { kind: 'invalid', redirectTo: q ? usersPageHref(1, q) : '/users' };
  }

  const requested = parsed.status === 'ok' ? parsed.page : 1;
  if (!isListingDirectoryReady()) {
    return resolveLegacy(q, requested, parsed.status === 'ok');
  }
  if (q) {
    return { kind: 'search', q, searchPage: requested };
  }

  try {
    const pageCount = await getCachedListingPageCount();
    if (parsed.status === 'absent') {
      const newest = await getNewestListed(20);
      return { kind: 'newest', users: newest.map(toListUser), pageCount };
    }
    if (pageCount < 1 || requested > pageCount) {
      return {
        kind: 'redirect',
        redirectTo: pageCount >= 1 ? fixedPageHref(pageCount) : '/users',
      };
    }
    const cards = await getCachedFixedPage(requested);
    return {
      kind: 'fixed',
      page: requested,
      pageCount,
      users: cards.map(toListUser),
    };
  } catch (err) {
    console.error('listing page failed:', err);
    return { kind: 'error' };
  }
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const listing = await resolveListing(await searchParams);
  if (listing.kind === 'legacy') {
    return {
      title: listing.page <= 1 ? DIRECTORY_TITLE : `ユーザー検索・一覧（${listing.page}ページ目） | Procom`,
      description:
        listing.page <= 1
          ? DIRECTORY_DESCRIPTION
          : `Procomに登録されている公開プロフィールの一覧（${listing.page}ページ目）です。`,
      alternates: { canonical: usersCanonicalPath(listing.page) },
      robots: { index: true, follow: true },
      pagination: {
        previous: listing.page > 1 ? usersPageHref(listing.page - 1) : null,
        next: listing.page < listing.pageCount ? usersPageHref(listing.page + 1) : null,
      },
    };
  }
  if (listing.kind === 'newest') {
    return {
      title: DIRECTORY_TITLE,
      description: DIRECTORY_DESCRIPTION,
      alternates: { canonical: '/users' },
      robots: { index: true, follow: true },
    };
  }
  if (listing.kind === 'fixed') {
    return {
      title: `ユーザー検索・一覧（${listing.page}ページ目） | Procom`,
      description: `Procomに登録されている公開プロフィールの一覧（${listing.page}ページ目）です。`,
      alternates: { canonical: fixedPageHref(listing.page) },
      robots: { index: true, follow: true },
      pagination: {
        previous: listing.page > 1 ? fixedPageHref(listing.page - 1) : null,
        next: listing.page < listing.pageCount ? fixedPageHref(listing.page + 1) : null,
      },
    };
  }
  return {
    title: DIRECTORY_TITLE,
    description: DIRECTORY_DESCRIPTION,
    alternates: { canonical: '/users' },
    robots: { index: false, follow: true },
  };
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const listing = await resolveListing(await searchParams);
  if (listing.kind === 'invalid' || listing.kind === 'redirect') {
    redirect(listing.redirectTo);
  }

  if (listing.kind === 'search') {
    return (
      <UsersPageClient
        q={listing.q}
        searchPage={listing.searchPage}
        listError={false}
        showDirectory={false}
        directoryMode="newest"
        directoryUsers={[]}
        directoryPage={1}
        directoryPageCount={1}
        crawlPages={[]}
      />
    );
  }

  if (listing.kind === 'error') {
    return (
      <UsersPageClient
        q=""
        searchPage={1}
        listError
        showDirectory={false}
        directoryMode="newest"
        directoryUsers={[]}
        directoryPage={1}
        directoryPageCount={1}
        crawlPages={[]}
      />
    );
  }

  if (listing.kind === 'newest' || listing.kind === 'legacy') {
    return (
      <UsersPageClient
        q=""
        searchPage={1}
        listError={false}
        showDirectory
        directoryMode={listing.kind}
        directoryUsers={listing.users}
        directoryPage={listing.kind === 'legacy' ? listing.page : 1}
        directoryPageCount={listing.pageCount}
        crawlPages={listing.kind === 'legacy' ? crawlPageNumbers(listing.page, listing.pageCount) : []}
      />
    );
  }

  return (
    <UsersPageClient
      q=""
      searchPage={1}
      listError={false}
      showDirectory
      directoryMode="fixed"
      directoryUsers={listing.users}
      directoryPage={listing.page}
      directoryPageCount={listing.pageCount}
      crawlPages={crawlPageNumbers(listing.page, listing.pageCount)}
    />
  );
}
