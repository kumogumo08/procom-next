/**
 * Spotlight 掲載フラグのローカル検査。Firestore には接続しない。
 * 実行: npx tsx scripts/spotlight-moderation-check.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { isProfilePublic } from '@/lib/userSeo';
import { isProfilePublicWithOnboarding } from '@/lib/onboarding';
import {
  SPOTLIGHT_BAND,
  selectSpotlight,
  type SpotlightCandidate,
} from '@/lib/listing/spotlight';
import {
  assignSpotlightOff,
  decideAdminSpotlightPatch,
  isSpotlightExcluded,
  isTrustedOrigin,
  readUserSpotlightOff,
} from '@/lib/spotlightModeration';

const root = process.cwd();

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function person(uid: string, createdDaysAgo: number, updatedDaysAgo: number | null): SpotlightCandidate {
  const now = 1_700_000_000_000;
  const day = 24 * 60 * 60 * 1000;
  return {
    uid,
    name: uid,
    title: 'dancer',
    photoUrl: `https://example.com/${uid}.jpg`,
    createdAtMs: now - createdDaysAgo * day,
    contentUpdatedAtMs: updatedDaysAgo == null ? null : now - updatedDaysAgo * day,
  };
}

const unset = { profile: { name: 'A', isPublic: true } };
const off = { moderation: { spotlightOff: true }, profile: { name: 'A', isPublic: true } };
const on = { moderation: { spotlightOff: false }, profile: { name: 'A', isPublic: true } };

assert(readUserSpotlightOff(unset) === false, '1. 未設定は掲載ON');
assert(readUserSpotlightOff({}) === false, '1. moderation 無しは掲載ON');
assert(readUserSpotlightOff({ moderation: {} }) === false, '1. フラグ無しは掲載ON');
assert(readUserSpotlightOff({ moderation: { spotlightOff: 'true' } }) === false, '1. 文字列 true は掲載ON');
assert(isSpotlightExcluded(undefined) === false, '1. 候補側の未設定は除外しない');

assert(readUserSpotlightOff(off) === true, '2. true はOFF');
assert(isSpotlightExcluded(true) === true, '2. 候補の true は除外');
const listed = [
  { uid: 'keep', spotlightOff: false },
  { uid: 'drop', spotlightOff: true },
  { uid: 'plain' },
];
const kept = listed.filter((row) => !isSpotlightExcluded(row.spotlightOff)).map((row) => row.uid);
assert(kept.join(',') === 'keep,plain', '2. OFFだけ候補から外れる');

assert(readUserSpotlightOff(on) === false, '3. false は掲載ONへ戻る');
assert(isSpotlightExcluded(false) === false, '3. false は候補に残る');
const restored = assignSpotlightOff({ name: 'A', seq: 1 }, false);
assert(!('spotlightOff' in restored) && restored.name === 'A' && restored.seq === 1, '3. ONの同期はフラグを書かない');
const hidden = assignSpotlightOff({ name: 'A', seq: 1 }, true);
assert('spotlightOff' in hidden && hidden.spotlightOff === true && hidden.seq === 1, '2. OFFの同期は他の掲載フィールドを残す');

assert(isProfilePublic({ name: 'A', isPublic: true }) === true, '4. プロフィール公開判定は従来どおり');
assert(isProfilePublicWithOnboarding(off.profile) === true, '4. OFFでもプロフィール判定は公開');
assert(
  isProfilePublicWithOnboarding({ onboardingStatus: 'complete', name: 'A', title: 'B', isPublic: true }) === true,
  '5. 一覧へ載る公開条件はフラグを見ない'
);

const before = {
  moderation: { spotlightOff: true },
  favorites: ['other'],
  profile: { name: 'Before', isPublic: true },
};
const saved = {
  profile: {
    name: 'After',
    title: '',
    bio: '',
  },
};
const merged = { ...before, ...saved };
assert(
  merged.moderation.spotlightOff === true && merged.favorites[0] === 'other' && merged.profile.name === 'After',
  '6. profile だけの merge では直下の moderation が残る'
);

const guest = decideAdminSpotlightPatch({
  isAdmin: false,
  origin: 'https://procom.jp',
  dev: false,
  uid: 'user1',
  body: { spotlightOff: true },
});
assert(!guest.ok && guest.status === 403 && guest.error === 'unauthorized', '7. 一般ユーザーは拒否');

const badOrigin = decideAdminSpotlightPatch({
  isAdmin: true,
  origin: 'https://evil.example',
  dev: false,
  uid: 'user1',
  body: { spotlightOff: true },
});
assert(!badOrigin.ok && badOrigin.status === 403 && badOrigin.error === 'bad-origin', '8. 別オリジンは拒否');
assert(isTrustedOrigin(null, false) === false, '本番. Origin 無しは拒否');
assert(isTrustedOrigin('null', false) === false, '本番. Origin null は拒否');
assert(isTrustedOrigin('https://procom.jp', false) === true, '本番. https://procom.jp は許可');
assert(isTrustedOrigin('https://www.procom.jp', false) === true, '本番. https://www.procom.jp は許可');
assert(isTrustedOrigin('https://procom-next.onrender.com', false) === true, '本番. Render は許可');
assert(isTrustedOrigin('http://procom.jp', false) === false, '本番. http は拒否');
assert(isTrustedOrigin('https://procom.jp:443', false) === false, '本番. ポート付きは拒否');
assert(isTrustedOrigin('https://procom.jp/', false) === false, '本番. 末尾スラッシュは拒否');
assert(isTrustedOrigin('https://procom.jp.evil.example', false) === false, '本番. 偽ホストは拒否');
assert(isTrustedOrigin('http://localhost:3000', false) === false, '本番. localhost は拒否');
assert(isTrustedOrigin('http://127.0.0.1:3000', false) === false, '本番. 127.0.0.1 は拒否');
assert(isTrustedOrigin('http://localhost:3000', true) === true, '開発. localhost:3000 は許可');
assert(isTrustedOrigin('http://127.0.0.1:3000', true) === true, '開発. 127.0.0.1:3000 は許可');
assert(isTrustedOrigin('https://procom.jp', true) === true, '開発. 本番オリジンも許可');
assert(isTrustedOrigin('http://localhost:3100', true) === false, '開発. 3100番は拒否');
assert(isTrustedOrigin('http://localhost', true) === false, '開発. ポート無しは拒否');
assert(isTrustedOrigin(null, true) === false, '開発. Origin 無しは拒否');

const badUid = decideAdminSpotlightPatch({
  isAdmin: true,
  origin: 'https://procom.jp',
  dev: false,
  uid: '../users',
  body: { spotlightOff: true },
});
assert(!badUid.ok && badUid.status === 400, '8. 不正なUIDは拒否');

const extra = decideAdminSpotlightPatch({
  isAdmin: true,
  origin: 'https://procom.jp',
  dev: false,
  uid: 'user_1',
  body: { spotlightOff: true, suspended: true },
});
assert(!extra.ok && extra.status === 400, '8. 余計な項目は拒否');

const text = decideAdminSpotlightPatch({
  isAdmin: true,
  origin: 'https://procom.jp',
  dev: false,
  uid: 'user_1',
  body: { spotlightOff: 'true' },
});
assert(!text.ok && text.status === 400, '8. 文字列は拒否');

const okOff = decideAdminSpotlightPatch({
  isAdmin: true,
  origin: 'https://procom.jp',
  dev: false,
  uid: 'user_1',
  body: { spotlightOff: true },
});
const okOn = decideAdminSpotlightPatch({
  isAdmin: true,
  origin: 'https://procom.jp',
  dev: false,
  uid: 'user_1',
  body: { spotlightOff: false },
});
assert(okOff.ok && okOff.spotlightOff === true, '8. OFFは受け付ける');
assert(okOn.ok && okOn.spotlightOff === false, '8. ONは受け付ける');

const now = 1_700_000_000_000;
const fresh = [1, 2, 3, 4, 5].map((n) => person(`n${n}`, 3, 1));
const updated = [1, 2, 3, 4, 5].map((n) => person(`u${n}`, 40, 5));
const regular = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => person(`r${n}`, 400, null));
const picked = selectSpotlight([...fresh, ...updated, ...regular], now, () => 0);
assert(SPOTLIGHT_BAND === 4, '9. 各枠は4人のまま');
assert(
  picked.users.map((user) => user.uid).join(',') === 'n1,n2,n3,n4,u1,u2,u3,u4,r1,r2,r3,r4',
  '9. 新規4・更新4・通常4は変わらない'
);

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) files.push(full);
  }
  return files;
}

const allowed = new Set([
  'app/lib/spotlightModeration.ts',
  'app/lib/accountSuspension.ts',
  'app/lib/listing/firestoreListing.ts',
  'app/lib/listing/legacyDirectory.ts',
  'app/api/admin/users/[uid]/route.ts',
  'app/api/admin/users/[uid]/suspension/route.ts',
]);
const offenders: string[] = [];
for (const file of walk(join(root, 'app'))) {
  const rel = relative(root, file).replaceAll('\\', '/');
  const text = readFileSync(file, 'utf8');
  if (text.includes('moderation') && !allowed.has(rel)) offenders.push(rel);
}
assert(offenders.length === 0, `6. moderation を書くファイルが増えた: ${offenders.join(',')}`);

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

function sliceFn(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  assert(start >= 0, `${name} が見つからない`);
  const next = source.indexOf('\nexport async function ', start + name.length);
  return source.slice(start, next === -1 ? source.length : next);
}

const listing = read('app/lib/listing/firestoreListing.ts');
assert(!sliceFn(listing, 'searchListed').includes('spotlightOff'), '5. 検索クエリはフラグを見ない');
assert(!sliceFn(listing, 'profileSeqRange').includes('spotlightOff'), '5. sitemap の seq 範囲はフラグを見ない');
assert(sliceFn(listing, 'enqueueUserListing').includes('assignSpotlightOff'), '6. 同期はフラグを写す');
assert(!read('app/user/[uid]/page.tsx').includes('spotlightOff'), '4. プロフィールページはフラグを見ない');
assert(!read('app/lib/listing/spotlight.ts').includes('spotlightOff'), '9. 抽選関数はフラグを知らない');
assert(!read('app/api/user/[uid]/route.ts').includes('moderation'), '6. 本人の保存APIは moderation を書かない');
assert(!read('app/api/banner-links/route.ts').includes('moderation'), '6. バナー保存は moderation を書かない');
assert(!read('app/api/photos/route.ts').includes('moderation'), '6. 写真保存は moderation を書かない');

const migratedOff = assignSpotlightOff(
  { name: 'A', seq: 1, photoUrl: 'https://example.com/a.jpg' },
  readUserSpotlightOff({ moderation: { spotlightOff: true }, profile: { name: 'A', isPublic: true } })
);
assert(
  'spotlightOff' in migratedOff &&
    migratedOff.spotlightOff === true &&
    migratedOff.name === 'A' &&
    migratedOff.seq === 1 &&
    migratedOff.photoUrl === 'https://example.com/a.jpg',
  '移行. true のときだけ spotlightOff を足し、掲載フィールドは残す'
);
const migratedUnset = assignSpotlightOff(
  { name: 'A', seq: 1 },
  readUserSpotlightOff({ profile: { name: 'A', isPublic: true } })
);
const migratedFalse = assignSpotlightOff(
  { name: 'A', seq: 1 },
  readUserSpotlightOff({ moderation: { spotlightOff: false }, profile: { name: 'A' } })
);
assert(!('spotlightOff' in migratedUnset) && !('spotlightOff' in migratedFalse), '移行. 未設定と false はフィールドを足さない');
const migrateScript = read('scripts/listing-migrate.ts');
assert(
  migrateScript.includes('readUserSpotlightOff(data)') &&
    migrateScript.includes('assignSpotlightOff(action.profile, spotlightOffByUid.get(action.uid) === true)'),
  '移行. 書き込みは users の値だけを写す'
);
assert(!migrateScript.includes("tx.update(db.collection('users')") && !migrateScript.includes('collection("users")'), '移行. users への更新は足さない');

console.log('spotlight-moderation-check: ok');
