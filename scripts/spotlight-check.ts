/**
 * スポットライト抽選のローカル検査。Firestore には接続しない。
 * 実行: npx tsx scripts/spotlight-check.ts
 */
import { meaningfulProfileChanged, nextContentStamp } from '@/lib/profileContent';
import {
  SPOTLIGHT_NEW_MS,
  SPOTLIGHT_POOL_MAX,
  SPOTLIGHT_SOURCE_MAX,
  SPOTLIGHT_SOURCE_REVALIDATE_SECONDS,
  SPOTLIGHT_UPDATE_MS,
  buildSpotlightPool,
  isNewSpotlight,
  isUpdatedSpotlight,
  mulberry32,
  selectSpotlight,
  spotlightHourSeed,
  spotlightProfileHref,
  toSpotlightCandidate,
  type SpotlightCandidate,
} from '@/lib/listing/spotlight';

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function zero(): number {
  return 0;
}

function person(
  uid: string,
  createdDaysAgo: number | null,
  updatedDaysAgo: number | null,
  photo = true
): SpotlightCandidate {
  return {
    uid,
    name: uid,
    title: 'dancer',
    photoUrl: photo ? `https://example.com/${uid}.jpg` : '',
    createdAtMs: createdDaysAgo == null ? null : NOW - createdDaysAgo * DAY,
    contentUpdatedAtMs: updatedDaysAgo == null ? null : NOW - updatedDaysAgo * DAY,
  };
}

function ids(users: readonly SpotlightCandidate[]): string[] {
  return users.map((user) => user.uid);
}

function band(user: SpotlightCandidate): 'N' | 'U' | 'R' {
  if (isNewSpotlight(user, NOW)) return 'N';
  if (isUpdatedSpotlight(user, NOW)) return 'U';
  return 'R';
}

const fresh = [1, 2, 3, 4, 5].map((n) => person(`n${n}`, 3, 1));
const updated = [1, 2, 3, 4, 5].map((n) => person(`u${n}`, 40, 5));
const regular = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => person(`r${n}`, 400, null));
const both = person('both', 2, 1);
const balanced = [...fresh, ...updated, ...regular];

const exact = selectSpotlight(balanced, NOW, zero);
assert(exact.users.length === 12, '候補が足りるとき 12 人');
assert(ids(exact.users).join(',') === 'n1,n2,n3,n4,u1,u2,u3,u4,r1,r2,r3,r4', '各枠 4 人。通常枠は残りから');
assert(new Set(ids(exact.users)).size === 12, '重複しない');
assert(exact.featuredUid === 'n1', '乱数 0 の PICK UP は抽選後の先頭');
assert(exact.users.every((user) => user.photoUrl.length > 0), '画像なしは残らない');

const short = selectSpotlight(
  [person('n1', 1, null), person('u1', 40, 2), ...regular],
  NOW,
  zero
);
assert(short.users.length === 12, '不足枠は他カテゴリで 12 人まで補充');
assert(ids(short.users)[0] === 'n1' && ids(short.users)[1] === 'u1', '新規と更新を残して補充');
assert(ids(short.users).filter((id) => id.startsWith('r')).length === 10, '不足分は通常ユーザーで埋める');

const few = selectSpotlight([person('a', 1, null), person('b', 40, 2), person('c', 800, null)], NOW, zero);
assert(ids(few.users).join(',') === 'a,b,c', '12 人未満なら全員');

const onlyNew = selectSpotlight(
  Array.from({ length: 20 }, (_, index) => person(`n${index + 1}`, 1, null)),
  NOW,
  zero
);
assert(onlyNew.users.length === 12, '新規だけでも最大 12 人');
assert(onlyNew.users.every((user) => isNewSpotlight(user, NOW)), '補充は残りの新規から');

const overlap = selectSpotlight([both, ...updated.slice(0, 4), ...regular.slice(0, 4)], NOW, zero);
assert(ids(overlap.users).filter((id) => id === 'both').length === 1, '新規かつ更新でも 1 回だけ');
assert(isNewSpotlight(both, NOW) && !isUpdatedSpotlight(both, NOW), '両方に該当する人は新規枠');

const hidden = [
  toSpotlightCandidate({ uid: 'private', photoUrl: 'https://example.com/p.jpg', isPublic: false, createdAtMs: NOW }),
  toSpotlightCandidate({ uid: 'nophoto', photoUrl: ' ', isPublic: true, createdAtMs: NOW }),
  toSpotlightCandidate({ uid: 'ok', photoUrl: 'https://example.com/ok.jpg', isPublic: true, createdAtMs: NOW - DAY }),
];
assert(hidden[0] == null && hidden[1] == null && hidden[2]?.uid === 'ok', '非公開と画像なしは候補にしない');
const dropped = selectSpotlight([person('blank', 10, null, false), person('kept', 10, null)], NOW, zero);
assert(ids(dropped.users).join(',') === 'kept', '空の画像 URL は抽選で除外');

const dup = selectSpotlight([person('same', 10, null), { ...person('same', 10, null), name: 'later' }], NOW, zero);
assert(ids(dup.users).join(',') === 'same' && dup.users[0]?.name === 'same', '同一 uid は先の一件');

const edgeNew = person('edge', 14, null);
const justOld = person('old-edge', 14, null);
justOld.createdAtMs = (justOld.createdAtMs ?? 0) - 1;
assert(isNewSpotlight(edgeNew, NOW), '登録から 14 日ちょうどは新規');
assert(!isNewSpotlight(justOld, NOW), '14 日を超えたら新規ではない');
const edgeUpdate = person('upd-edge', 40, 30);
const staleUpdate = person('upd-stale', 40, 30);
staleUpdate.contentUpdatedAtMs = (staleUpdate.contentUpdatedAtMs ?? 0) - 1;
assert(isUpdatedSpotlight(edgeUpdate, NOW), '更新から 30 日ちょうどは更新枠');
assert(!isUpdatedSpotlight(staleUpdate, NOW), '30 日を超えたら通常枠');
assert(!isUpdatedSpotlight(person('missing', 100, null), NOW), '更新日時がなくてもエラーにしない');
assert(!isNewSpotlight(person('no-created', null, 1), NOW), '作成日時がなくても新規扱いにしない');

const fortyFive = [
  ...Array.from({ length: 15 }, (_, index) => person(`n${index}`, 2, null)),
  ...Array.from({ length: 15 }, (_, index) => person(`u${index}`, 50, 3)),
  ...Array.from({ length: 15 }, (_, index) => person(`r${index}`, 500, null)),
];
assert(selectSpotlight(fortyFive, NOW, mulberry32(3)).users.length === 12, '45 人規模でも最大 12 人');

const firstDraw = selectSpotlight(fortyFive, NOW, mulberry32(11));
const secondDraw = selectSpotlight(fortyFive, NOW, mulberry32(12));
assert(ids(firstDraw.users).join(',') !== ids(secondDraw.users).join(','), '別の乱数では組み合わせが変わる');
assert(firstDraw.featuredUid != null && firstDraw.users.some((user) => user.uid === firstDraw.featuredUid), 'PICK UP は表示中の誰か');

const seed = spotlightHourSeed(NOW);
const stablePool = buildSpotlightPool(fortyFive, NOW, mulberry32(seed));
const stableA = selectSpotlight(stablePool, NOW, mulberry32(seed + 1));
const stableB = selectSpotlight(stablePool, NOW, mulberry32(seed + 1));
assert(JSON.stringify(stableA) === JSON.stringify(stableB), '同じ時間帯の初期表示は安定');
assert(stableA.users.every((user) => spotlightProfileHref(user.uid) === `/user/${user.uid}`), '初期 HTML のリンクはプロフィール');

let shuffled = false;
for (let sample = 1; sample <= 8; sample += 1) {
  const picked = selectSpotlight(balanced, NOW, mulberry32(sample));
  if (picked.users.map(band).join('') !== 'NNNNUUUURRRR') shuffled = true;
}
assert(shuffled, '表示順はカテゴリ順に固定しない');

const oldestFirst = Array.from({ length: 1000 }, (_, index) => person(`old-${index}`, 3000 - index, null));
const newestThirty = oldestFirst.slice(-30).map((user) => user.uid);
const capped = buildSpotlightPool(oldestFirst, NOW, zero);
assert(capped.length === 30, '1000 人の通常候補は 30 人まで');
assert(capped.length <= SPOTLIGHT_POOL_MAX, 'ブラウザへ渡す候補は 90 人以内');
assert(!capped.every((user, index) => user.uid === newestThirty[index]), '通常候補を新しい順の 30 人に固定しない');
assert(SPOTLIGHT_SOURCE_MAX >= 1000, '1000 人は全件上限の内側');
assert(SPOTLIGHT_SOURCE_REVALIDATE_SECONDS === 3600, '候補の再取得は 60 分');

let oldestSeen = 0;
const oldestId = oldestFirst[0]?.uid ?? '';
for (let sample = 0; sample < 200; sample += 1) {
  const pool = buildSpotlightPool(oldestFirst, NOW, mulberry32(sample));
  if (pool.some((user) => user.uid === oldestId)) oldestSeen += 1;
}
assert(oldestSeen > 0, '古い登録者にも候補へ入る機会がある');

const mixed = [
  ...Array.from({ length: 400 }, (_, index) => person(`n${index}`, 1, null)),
  ...Array.from({ length: 400 }, (_, index) => person(`u${index}`, 80, 2)),
  ...Array.from({ length: 400 }, (_, index) => person(`r${index}`, 900, null)),
];
const mixedPool = buildSpotlightPool(mixed, NOW, mulberry32(4));
assert(mixedPool.length === SPOTLIGHT_POOL_MAX, '1000 人超の混合でも候補は 90 人');
const shown = selectSpotlight(mixedPool, NOW, mulberry32(5));
assert(shown.users.length === 12, '縮めた候補からも 12 人');
assert(new Set(ids(shown.users)).size === 12, '縮めた候補でも重複しない');

const profile = {
  name: '花',
  title: 'ダンサー',
  bio: '自己紹介',
  photos: [{ url: 'https://example.com/a.jpg' }],
  xUsername: 'hana',
  customLinks: [{ label: 'Site', url: 'https://example.com' }],
  apps: [{ id: 'app_1', title: 'App', appStoreUrl: 'https://apps.apple.com/app/id1', updatedAt: '2020-01-01', iconUrl: 'https://example.com/icon.png' }],
  settings: { showApps: true },
  contentUpdatedAtMs: NOW - DAY,
};
assert(!meaningfulProfileChanged(profile, { ...profile, settings: { showApps: false }, contentUpdatedAtMs: NOW }), '設定と更新時刻だけでは更新枠に入らない');
assert(nextContentStamp(profile, profile, NOW) == null, '同じ内容の保存は時刻を進めない');
assert(meaningfulProfileChanged(profile, { ...profile, bio: '新しい自己紹介' }), '自己紹介の変更は対象');
assert(meaningfulProfileChanged(profile, { ...profile, photos: [{ url: 'https://example.com/b.jpg' }] }), '画像の変更は対象');
assert(meaningfulProfileChanged(profile, { ...profile, xUsername: 'hana2' }), 'SNS の変更は対象');
assert(
  !meaningfulProfileChanged(
    { photos: [{ url: 'https://example.com/a.jpg' }] },
    { photos: [{ url: 'https://example.com/a.jpg', position: 50 }] }
  ),
  '未設定の表示位置を既定値で保存しても更新にしない'
);
assert(
  meaningfulProfileChanged(
    { photos: [{ url: 'https://example.com/a.jpg', position: 20 }] },
    { photos: [{ url: 'https://example.com/a.jpg', position: 50 }] }
  ),
  '画像の表示位置の変更は対象'
);
assert(
  !meaningfulProfileChanged(
    profile,
    {
      ...profile,
      apps: [{ id: 'app_1', title: 'App', appStoreUrl: 'https://apps.apple.com/app/id1', updatedAt: new Date(NOW).toISOString(), iconUrl: 'https://example.com/other.png' }],
    }
  ),
  'アプリアイコンの自動更新だけでは対象にしない'
);
assert(nextContentStamp(profile, { ...profile, bio: '変わった' }, NOW) === NOW, '実質的な変更だけ時刻を返す');

console.log('spotlight check: ok');
