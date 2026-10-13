import { pageNoForSeq, type ListingFields } from '@/lib/listing/engine';
import {
  assertNotUsersPath,
  emptyMigrationState,
  planMigration,
  reachableProfileHrefs,
  type MigrateUser,
} from '@/lib/listing/migrate';
import { isListingDirectoryReady } from '@/lib/listing/readiness';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function fields(name: string): ListingFields {
  return {
    name,
    title: '',
    photoUrl: '',
    sortAtMs: 0,
    missingCreatedAt: true,
    hasPhoto: false,
    searchTokens: [],
    categorySlugs: [],
  };
}

function users(count: number, dated = 17): MigrateUser[] {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    const createdAtMs = n <= dated ? 1_700_000_000_000 - n : null;
    return {
      uid: `u${String(n).padStart(2, '0')}`,
      isPublic: true,
      createdAtMs,
      fields: {
        ...fields(`n${n}`),
        sortAtMs: createdAtMs ?? 0,
        missingCreatedAt: createdAtMs == null,
      },
    };
  });
}

const first = planMigration(users(44), emptyMigrationState());
assert(first.report.plannedReady, '44人の計画は切り替え可能');
assert(!first.report.currentReady, '未書き込みの現状は READY にしない');
assert(first.report.pageSizes.join(',') === '20,20,4', `ページは 20,20,4: ${first.report.pageSizes.join(',')}`);
assert(first.state.profiles.size === 44, '44 UID');
assert(new Set([...first.state.profiles.values()].map((profile) => profile.seq)).size === 44, 'seq は重複しない');
const hrefs = new Set(reachableProfileHrefs(first.state));
for (const profile of first.state.profiles.values()) {
  assert(hrefs.has(`/user/${profile.uid}`), `${profile.uid} が固定ページから到達できない`);
  assert(profile.pageNo === pageNoForSeq(profile.seq ?? 0), 'ページ番号が seq と一致しない');
}
assert(hrefs.has('/users?page=1') && hrefs.has('/users?page=2') && hrefs.has('/users?page=3'), '固定ページへ到達できる');

const second = planMigration(users(44), first.state);
assert(second.report.writes === 0, '再実行は書き込みなし');
assert(second.report.currentReady && second.report.plannedReady, '再実行後も整合');
assert([...second.state.profiles.values()].every((profile, _, all) => {
  const previous = first.state.profiles.get(profile.uid);
  return previous?.seq === profile.seq && all.filter((item) => item.seq === profile.seq).length === 1;
}), 'seq を維持する');

const changed = users(44).map((user, index) =>
  index === 0 ? { ...user, fields: { ...user.fields, name: 'updated' } } : user
);
const updated = planMigration(changed, first.state);
const kept = updated.state.profiles.get('u01');
assert(kept?.seq === first.state.profiles.get('u01')?.seq, '更新で seq が変わらない');
assert((kept?.revision ?? 0) > (first.state.profiles.get('u01')?.revision ?? 0), '更新は revision を進める');

const added = [...users(44), { ...users(1)[0], uid: 'u45', createdAtMs: 1_800_000_000_000, fields: { ...fields('new'), sortAtMs: 1_800_000_000_000, missingCreatedAt: false } }];
const grew = planMigration(added, first.state);
assert(grew.state.profiles.get('u45')?.seq === 45, '移行中の新規は次の seq');
assert(grew.state.profiles.get('u02')?.seq === first.state.profiles.get('u02')?.seq, '既存 seq を維持');

const withdrawn = users(44).map((user) => (user.uid === 'u10' ? { ...user, isPublic: false } : user));
const removed = planMigration(withdrawn, first.state);
assert(!removed.state.profiles.has('u10'), '退会を掲載から外す');
assert(![...removed.state.profiles.values()].some((profile) => profile.seq === first.state.profiles.get('u10')?.seq), '退会の seq は再利用しない');
assert(removed.report.plannedReady, '退会後も残りの整合は取れる');

const conflicted = emptyMigrationState();
const base = first.state.profiles.get('u01');
const other = first.state.profiles.get('u02');
if (!base || !other || base.seq == null) throw new Error('fixture');
conflicted.profiles.set(base.uid, { ...base });
conflicted.profiles.set(other.uid, { ...other, seq: base.seq, pageNo: base.pageNo });
conflicted.nextSeq = 45;
const conflict = planMigration(users(44), conflicted);
assert(!conflict.report.canApply && !conflict.report.plannedReady, 'seq 重複なら READY も書き込みも禁止');

let blocked = false;
try {
  assertNotUsersPath('users');
} catch {
  blocked = true;
}
assert(blocked, 'users への書き込みを拒否する');
assertNotUsersPath('publicProfiles');
assert(!isListingDirectoryReady(undefined), '未設定では新方式の全件回避パスを使わない');
assert(isListingDirectoryReady('1'), 'READY=1 のときだけ新方式');

console.log('listing migrate check: ok');
