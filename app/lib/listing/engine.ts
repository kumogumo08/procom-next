/**
 * 一覧同期の純粋モデル。Firestore には依存しない。
 * revision は uid ごとに単調増加。古い outbox は新しいプロフィールや墓標を上書きしない。
 * seq は nextSeq を同じ決定の中で一度だけ進める。再実行で同じ人に別の seq は付かない。
 */

export const LISTING_PAGE_SIZE = 20;

export type ListingOp = 'upsert' | 'remove';

export type ListingFields = {
  name: string;
  title: string;
  photoUrl: string;
  sortAtMs: number;
  missingCreatedAt: boolean;
  hasPhoto: boolean;
  /** 実質的なプロフィール更新。未記録は null。一覧の seq や並びには使わない。 */
  contentUpdatedAtMs: number | null;
  searchTokens: string[];
  categorySlugs: string[];
};

export type LiveProfile = ListingFields & {
  uid: string;
  revision: number;
  seq: number | null;
  pageNo: number | null;
};

export type OutboxItem = {
  uid: string;
  revision: number;
  op: ListingOp;
  pageNo: number | null;
};

export type PageCard = {
  uid: string;
  name: string;
  title: string;
  photoUrl: string;
};

export type ListingState = {
  profiles: Map<string, LiveProfile>;
  tombstones: Map<string, number>;
  outbox: Map<string, OutboxItem>;
  pages: Map<number, PageCard[]>;
  nextSeq: number;
  lock: { owner: string; untilMs: number; fence: number } | null;
};

export function emptyListingState(): ListingState {
  return {
    profiles: new Map(),
    tombstones: new Map(),
    outbox: new Map(),
    pages: new Map(),
    nextSeq: 1,
    lock: null,
  };
}

export function pageNoForSeq(seq: number): number {
  return Math.ceil(seq / LISTING_PAGE_SIZE);
}

function highestRevision(state: ListingState, uid: string): number {
  return Math.max(
    state.profiles.get(uid)?.revision ?? 0,
    state.tombstones.get(uid) ?? 0,
    state.outbox.get(uid)?.revision ?? 0
  );
}

function cloneState(state: ListingState): ListingState {
  const pages = new Map<number, PageCard[]>();
  for (const [pageNo, cards] of state.pages) {
    pages.set(pageNo, cards.map((card) => ({ ...card })));
  }
  return {
    profiles: new Map([...state.profiles].map(([uid, profile]) => [uid, { ...profile }])),
    tombstones: new Map(state.tombstones),
    outbox: new Map([...state.outbox].map(([uid, item]) => [uid, { ...item }])),
    pages,
    nextSeq: state.nextSeq,
    lock: state.lock ? { ...state.lock } : null,
  };
}

function cardOf(profile: LiveProfile): PageCard {
  return {
    uid: profile.uid,
    name: profile.name,
    title: profile.title,
    photoUrl: profile.photoUrl,
  };
}

function writeCard(state: ListingState, pageNo: number, card: PageCard) {
  const cards = (state.pages.get(pageNo) ?? []).filter((item) => item.uid !== card.uid);
  cards.push(card);
  state.pages.set(pageNo, cards);
}

function removeCard(state: ListingState, pageNo: number | null, uid: string) {
  if (pageNo == null) return;
  const cards = state.pages.get(pageNo);
  if (!cards) return;
  state.pages.set(
    pageNo,
    cards.filter((card) => card.uid !== uid)
  );
}

export function enqueueListing(
  state: ListingState,
  uid: string,
  op: ListingOp,
  fields?: ListingFields
): { state: ListingState; revision: number } {
  const next = cloneState(state);
  const revision = highestRevision(next, uid) + 1;
  if (op === 'remove') {
    const profile = next.profiles.get(uid);
    const pageNo = profile?.pageNo ?? next.outbox.get(uid)?.pageNo ?? null;
    removeCard(next, pageNo, uid);
    next.profiles.delete(uid);
    next.tombstones.set(uid, revision);
    next.outbox.set(uid, { uid, revision, op: 'remove', pageNo });
    return { state: next, revision };
  }
  if (!fields) throw new Error('upsert にはフィールドが必要です');
  const prev = next.profiles.get(uid);
  const tombstone = next.tombstones.get(uid) ?? 0;
  if (tombstone >= revision) {
    return { state: next, revision };
  }
  next.tombstones.delete(uid);
  next.profiles.set(uid, {
    ...fields,
    uid,
    revision,
    seq: prev?.seq ?? null,
    pageNo: prev?.pageNo ?? null,
  });
  next.outbox.set(uid, { uid, revision, op: 'upsert', pageNo: prev?.pageNo ?? null });
  return { state: next, revision };
}

export type SyncDecision =
  | { action: 'idle' }
  | { action: 'drop-outbox'; uid: string; revision: number }
  | { action: 'finish-remove'; uid: string; revision: number; pageNo: number | null }
  | {
      action: 'place';
      uid: string;
      revision: number;
      seq: number;
      pageNo: number;
      assign: boolean;
    };

export function planSync(state: ListingState, uid: string): SyncDecision {
  const outbox = state.outbox.get(uid);
  if (!outbox) return { action: 'idle' };
  const tombstone = state.tombstones.get(uid) ?? 0;
  const profile = state.profiles.get(uid);

  if (profile && profile.revision > outbox.revision) {
    return { action: 'drop-outbox', uid, revision: outbox.revision };
  }

  if (outbox.op === 'remove' || tombstone >= outbox.revision) {
    return {
      action: 'finish-remove',
      uid,
      revision: outbox.revision,
      pageNo: profile?.pageNo ?? outbox.pageNo,
    };
  }

  if (!profile || profile.revision !== outbox.revision) {
    return { action: 'drop-outbox', uid, revision: outbox.revision };
  }

  if (profile.seq == null) {
    const seq = state.nextSeq;
    return {
      action: 'place',
      uid,
      revision: outbox.revision,
      seq,
      pageNo: pageNoForSeq(seq),
      assign: true,
    };
  }

  return {
    action: 'place',
    uid,
    revision: outbox.revision,
    seq: profile.seq,
    pageNo: profile.pageNo ?? pageNoForSeq(profile.seq),
    assign: false,
  };
}

export function decisionStillValid(state: ListingState, decision: SyncDecision): boolean {
  if (decision.action === 'idle') return true;
  const outbox = state.outbox.get(decision.uid);
  if (!outbox || outbox.revision !== decision.revision) return false;
  if (decision.action === 'drop-outbox') return true;
  if (decision.action === 'finish-remove') {
    const profile = state.profiles.get(decision.uid);
    return (profile?.revision ?? 0) <= decision.revision;
  }
  const profile = state.profiles.get(decision.uid);
  const tombstone = state.tombstones.get(decision.uid) ?? 0;
  if (!profile || profile.revision !== decision.revision) return false;
  if (tombstone >= decision.revision) return false;
  if (decision.assign) {
    return profile.seq == null && state.nextSeq === decision.seq;
  }
  return profile.seq === decision.seq;
}

export function commitDecision(state: ListingState, decision: SyncDecision): ListingState | null {
  if (!decisionStillValid(state, decision)) return null;
  if (decision.action === 'idle') return state;
  const next = cloneState(state);
  if (decision.action === 'drop-outbox') {
    const current = next.outbox.get(decision.uid);
    if (current?.revision === decision.revision) next.outbox.delete(decision.uid);
    return next;
  }
  if (decision.action === 'finish-remove') {
    const profile = next.profiles.get(decision.uid);
    removeCard(next, profile?.pageNo ?? decision.pageNo, decision.uid);
    next.profiles.delete(decision.uid);
    const tombstone = next.tombstones.get(decision.uid) ?? 0;
    if (tombstone < decision.revision) next.tombstones.set(decision.uid, decision.revision);
    const current = next.outbox.get(decision.uid);
    if (current?.revision === decision.revision) next.outbox.delete(decision.uid);
    return next;
  }
  const profile = next.profiles.get(decision.uid);
  if (!profile) return null;
  profile.seq = decision.seq;
  profile.pageNo = decision.pageNo;
  if (decision.assign) next.nextSeq = decision.seq + 1;
  writeCard(next, decision.pageNo, cardOf(profile));
  const current = next.outbox.get(decision.uid);
  if (current?.revision === decision.revision) next.outbox.delete(decision.uid);
  return next;
}

/** 1人分。失敗したら同じ状態で再実行できる。 */
export function stepListing(state: ListingState, uid: string): ListingState {
  const decision = planSync(state, uid);
  return commitDecision(state, decision) ?? state;
}

export function tryAcquireLock(
  state: ListingState,
  owner: string,
  nowMs: number,
  ttlMs: number
): { state: ListingState; ok: boolean; fence: number } {
  if (state.lock && state.lock.untilMs > nowMs && state.lock.owner !== owner) {
    return { state, ok: false, fence: state.lock.fence };
  }
  const next = cloneState(state);
  const fence = (state.lock?.fence ?? 0) + 1;
  next.lock = { owner, untilMs: nowMs + ttlMs, fence };
  return { state: next, ok: true, fence };
}

/** 取得時の fence と期限内の所有者だけが書ける。期限後や交代後の旧ワーカーは書けない。 */
export function lockAllowsWrite(
  lock: ListingState['lock'],
  owner: string,
  fence: number,
  nowMs: number
): boolean {
  if (!lock) return false;
  if (lock.owner !== owner || lock.fence !== fence) return false;
  return lock.untilMs > nowMs;
}

export function profilesOnPages(state: ListingState): string[] {
  const uids: string[] = [];
  for (const cards of state.pages.values()) {
    for (const card of cards) uids.push(card.uid);
  }
  return uids;
}
