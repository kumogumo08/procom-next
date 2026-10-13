import { compareDirectoryOrder } from '@/lib/publicUserDirectory';

import {
  pageNoForSeq,
  type ListingFields,
  type LiveProfile,
  type OutboxItem,
  type PageCard,
} from './engine';
import { crawlPageNumbers } from './links';
import { assessDirectoryReady } from './readiness';

/** 移行が書いてよいコレクション。users は含まない。 */
export const MIGRATION_WRITE_COLLECTIONS = [
  'publicProfiles',
  'listingOutbox',
  'listingTombstones',
  'directoryPages',
  'directoryMeta',
] as const;

export function assertNotUsersPath(collection: string): void {
  if (collection === 'users' || collection.startsWith('users/')) {
    throw new Error('users コレクションは変更しません');
  }
  if (!MIGRATION_WRITE_COLLECTIONS.includes(collection as (typeof MIGRATION_WRITE_COLLECTIONS)[number])) {
    throw new Error(`移行の書き込み先ではありません: ${collection}`);
  }
}

export type MigrateUser = {
  uid: string;
  isPublic: boolean;
  createdAtMs: number | null;
  fields: ListingFields;
};

export type MigrationState = {
  profiles: Map<string, LiveProfile>;
  tombstones: Map<string, number>;
  outbox: Map<string, OutboxItem>;
  pages: Map<number, PageCard[]>;
  nextSeq: number;
};

export function emptyMigrationState(): MigrationState {
  return {
    profiles: new Map(),
    tombstones: new Map(),
    outbox: new Map(),
    pages: new Map(),
    nextSeq: 1,
  };
}

export type MigrateAction =
  | { type: 'skip'; uid: string; reason: 'unchanged' }
  | { type: 'upsert'; uid: string; profile: LiveProfile }
  | { type: 'remove'; uid: string; revision: number; pageNo: number | null };

export type MigrationReport = {
  publicCount: number;
  writes: number;
  skips: number;
  pageSizes: number[];
  currentReady: boolean;
  plannedReady: boolean;
  canApply: boolean;
  problems: string[];
};

function sameFields(profile: LiveProfile, fields: ListingFields): boolean {
  const keys: (keyof ListingFields)[] = [
    'name',
    'title',
    'photoUrl',
    'sortAtMs',
    'missingCreatedAt',
    'hasPhoto',
  ];
  if (keys.some((key) => profile[key] !== fields[key])) return false;
  return (
    profile.searchTokens.join('\n') === fields.searchTokens.join('\n') &&
    profile.categorySlugs.join('\n') === fields.categorySlugs.join('\n')
  );
}

function cardMatches(pages: Map<number, PageCard[]>, profile: LiveProfile): boolean {
  if (profile.pageNo == null) return false;
  const cards = pages.get(profile.pageNo) ?? [];
  return cards.some(
    (card) =>
      card.uid === profile.uid &&
      card.name === profile.name &&
      card.title === profile.title &&
      card.photoUrl === profile.photoUrl
  );
}

function highestRevision(state: MigrationState, uid: string): number {
  return Math.max(
    state.profiles.get(uid)?.revision ?? 0,
    state.tombstones.get(uid) ?? 0,
    state.outbox.get(uid)?.revision ?? 0
  );
}

function cloneState(state: MigrationState): MigrationState {
  const pages = new Map<number, PageCard[]>();
  for (const [pageNo, cards] of state.pages) {
    pages.set(
      pageNo,
      cards.map((card) => ({ ...card }))
    );
  }
  return {
    profiles: new Map([...state.profiles].map(([uid, profile]) => [uid, { ...profile }])),
    tombstones: new Map(state.tombstones),
    outbox: new Map([...state.outbox].map(([uid, item]) => [uid, { ...item }])),
    pages,
    nextSeq: state.nextSeq,
  };
}

function rebuildPages(profiles: Iterable<LiveProfile>): Map<number, PageCard[]> {
  const pages = new Map<number, PageCard[]>();
  const ordered = [...profiles].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  for (const profile of ordered) {
    if (profile.seq == null || profile.pageNo == null) continue;
    const cards = pages.get(profile.pageNo) ?? [];
    cards.push({
      uid: profile.uid,
      name: profile.name,
      title: profile.title,
      photoUrl: profile.photoUrl,
    });
    pages.set(profile.pageNo, cards);
  }
  return pages;
}

export function planMigration(users: readonly MigrateUser[], existing: MigrationState): {
  actions: MigrateAction[];
  state: MigrationState;
  report: MigrationReport;
} {
  const problems: string[] = [];
  const publicUsers = users.filter((user) => user.isPublic);
  publicUsers.sort((a, b) => compareDirectoryOrder(a, b));
  const publicSet = new Set(publicUsers.map((user) => user.uid));

  const seqOwner = new Map<number, string>();
  for (const profile of existing.profiles.values()) {
    if (profile.seq == null) continue;
    const owner = seqOwner.get(profile.seq);
    if (owner && owner !== profile.uid) {
      problems.push(`seq ${profile.seq} が ${owner} と ${profile.uid} に重複`);
    } else {
      seqOwner.set(profile.seq, profile.uid);
    }
  }

  const canApply = problems.length === 0;
  const assigned = new Map<string, { seq: number; pageNo: number }>();
  for (const [seq, uid] of seqOwner) {
    if (!publicSet.has(uid)) continue;
    assigned.set(uid, { seq, pageNo: pageNoForSeq(seq) });
  }
  const used = [...seqOwner.keys()];
  let cursor = Math.max(existing.nextSeq, used.length > 0 ? Math.max(...used) + 1 : 1);
  for (const user of publicUsers) {
    if (assigned.has(user.uid)) continue;
    const seq = cursor;
    cursor += 1;
    assigned.set(user.uid, { seq, pageNo: pageNoForSeq(seq) });
  }

  const actions: MigrateAction[] = [];
  const nextProfiles = new Map<string, LiveProfile>();

  for (const user of publicUsers) {
    const place = assigned.get(user.uid);
    if (!place) {
      problems.push(`${user.uid} に seq を割り当てられない`);
      continue;
    }
    const prev = existing.profiles.get(user.uid);
    const out = existing.outbox.get(user.uid);
    const tomb = existing.tombstones.get(user.uid) ?? 0;
    const unchanged =
      prev != null &&
      prev.seq === place.seq &&
      prev.pageNo === place.pageNo &&
      sameFields(prev, user.fields) &&
      tomb === 0 &&
      (out == null || (out.op === 'upsert' && out.revision <= prev.revision)) &&
      cardMatches(existing.pages, prev);
    if (unchanged) {
      actions.push({ type: 'skip', uid: user.uid, reason: 'unchanged' });
      nextProfiles.set(user.uid, { ...prev });
      continue;
    }
    const revision = highestRevision(existing, user.uid) + 1;
    if (prev && revision <= prev.revision) {
      problems.push(`${user.uid} の revision が下がる`);
      continue;
    }
    if (tomb >= revision || (out && out.revision >= revision)) {
      problems.push(`${user.uid} の既存 revision を上書きする`);
      continue;
    }
    const profile: LiveProfile = {
      ...user.fields,
      uid: user.uid,
      revision,
      seq: place.seq,
      pageNo: place.pageNo,
    };
    actions.push({ type: 'upsert', uid: user.uid, profile });
    nextProfiles.set(user.uid, profile);
  }

  for (const [uid, profile] of existing.profiles) {
    if (publicSet.has(uid)) continue;
    const revision = highestRevision(existing, uid) + 1;
    const tomb = existing.tombstones.get(uid) ?? 0;
    if (tomb >= revision) {
      actions.push({ type: 'skip', uid, reason: 'unchanged' });
      continue;
    }
    actions.push({
      type: 'remove',
      uid,
      revision,
      pageNo: profile.pageNo ?? existing.outbox.get(uid)?.pageNo ?? null,
    });
  }

  const pages = rebuildPages(nextProfiles.values());
  const state: MigrationState = {
    profiles: nextProfiles,
    tombstones: new Map(existing.tombstones),
    outbox: new Map(existing.outbox),
    pages,
    nextSeq: cursor,
  };
  for (const action of actions) {
    if (action.type === 'upsert') {
      state.tombstones.delete(action.uid);
      state.outbox.set(action.uid, {
        uid: action.uid,
        revision: action.profile.revision,
        op: 'upsert',
        pageNo: action.profile.pageNo,
      });
    } else if (action.type === 'remove') {
      state.profiles.delete(action.uid);
      state.tombstones.set(action.uid, action.revision);
      state.outbox.set(action.uid, {
        uid: action.uid,
        revision: action.revision,
        op: 'remove',
        pageNo: action.pageNo,
      });
    }
  }

  const planned = inspectMigration(publicUsers.map((user) => user.uid), state);
  const current = inspectMigration(
    publicUsers.map((user) => user.uid),
    existing
  );
  const report: MigrationReport = {
    publicCount: publicUsers.length,
    writes: actions.filter((action) => action.type !== 'skip').length,
    skips: actions.filter((action) => action.type === 'skip').length,
    pageSizes: planned.pageSizes,
    currentReady: current.ready,
    plannedReady: planned.ready && canApply && problems.length === 0,
    canApply: canApply && problems.length === 0,
    problems: [...problems, ...planned.problems],
  };
  return { actions, state, report };
}

export function inspectMigration(
  publicUids: readonly string[],
  state: MigrationState
): { ready: boolean; problems: string[]; pageSizes: number[] } {
  const problems: string[] = [];
  const seqs = new Map<number, string>();
  const pageUids: string[] = [];
  const seenOnPage = new Map<string, number>();
  for (const [pageNo, cards] of state.pages) {
    for (const card of cards) {
      const previous = seenOnPage.get(card.uid);
      if (previous != null) problems.push(`${card.uid} がページ ${previous} と ${pageNo} にある`);
      seenOnPage.set(card.uid, pageNo);
      pageUids.push(card.uid);
    }
  }
  for (const profile of state.profiles.values()) {
    if (profile.seq == null || profile.pageNo == null) {
      problems.push(`${profile.uid} に seq が無い`);
      continue;
    }
    const owner = seqs.get(profile.seq);
    if (owner) problems.push(`seq ${profile.seq} が重複`);
    else seqs.set(profile.seq, profile.uid);
    if (profile.pageNo !== pageNoForSeq(profile.seq)) {
      problems.push(`${profile.uid} のページ番号が seq と一致しない`);
    }
    if (seenOnPage.get(profile.uid) !== profile.pageNo) {
      problems.push(`${profile.uid} が固定ページに無い`);
    }
  }
  const assessed = assessDirectoryReady({
    publicUids,
    listedUids: [...state.profiles.keys()],
    pageUids,
  });
  if (assessed.missing > 0) problems.push(`公開UIDの欠落 ${assessed.missing}`);
  if (assessed.extra > 0) problems.push(`公開でないUIDが掲載 ${assessed.extra}`);
  if (assessed.unpaged > 0) problems.push(`ページ未掲載 ${assessed.unpaged}`);
  const maxSeq = seqs.size > 0 ? Math.max(...seqs.keys()) : 0;
  if (state.nextSeq <= maxSeq) problems.push('nextSeq が既存 seq 以下');
  const pageSizes = [...state.pages.keys()]
    .sort((a, b) => a - b)
    .map((pageNo) => state.pages.get(pageNo)?.length ?? 0);
  return { ready: problems.length === 0 && assessed.ready, problems, pageSizes };
}

/** /users の固定ページリンクから到達できるプロフィールURL。 */
export function reachableProfileHrefs(state: MigrationState): string[] {
  const pageCount = state.pages.size === 0 ? 0 : Math.max(...state.pages.keys());
  const seen = new Set<number>();
  const queue = pageCount > 0 ? [1] : [];
  while (queue.length > 0) {
    const page = queue.shift();
    if (page == null || seen.has(page) || page < 1 || page > pageCount) continue;
    seen.add(page);
    for (const next of crawlPageNumbers(page, pageCount)) queue.push(next);
    if (page < pageCount) queue.push(page + 1);
  }
  const hrefs: string[] = ['/users?page=1'];
  for (const page of seen) {
    hrefs.push(`/users?page=${page}`);
    for (const card of state.pages.get(page) ?? []) hrefs.push(`/user/${card.uid}`);
  }
  return hrefs;
}

export function simulateMigration(users: readonly MigrateUser[], existing: MigrationState): MigrationState {
  return planMigration(users, existing).state;
}

export function cloneMigrationState(state: MigrationState): MigrationState {
  return cloneState(state);
}
