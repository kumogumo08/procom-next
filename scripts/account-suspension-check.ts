/**
 * アカウント停止の判定。Firestore には接続しない。
 * 実行: npx tsx scripts/account-suspension-check.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  blocksSuspensionChange,
  decideAdminSuspension,
  isPublicListingEligible,
  parseSuspensionBody,
  readUserSuspended,
  suspensionFieldUpdate,
} from '@/lib/accountSuspension';
import { retainListedCards } from '@/lib/listing/engine';
import { safeLoginRedirect } from '@/lib/onboarding';
import { readUserSpotlightOff } from '@/lib/spotlightModeration';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

process.env.ADMIN_UIDS = 'admin-self,admin-other';

const origin = 'https://procom.jp';
const base = {
  isAdmin: true,
  origin,
  dev: false,
  actorUid: 'admin-self',
  uid: 'user-1',
};

assert(readUserSuspended({}) === false, '未設定は通常');
assert(readUserSuspended({ moderation: {} }) === false, 'フラグ無しは通常');
assert(readUserSuspended({ moderation: { suspended: false } }) === false, 'false は通常');
assert(readUserSuspended({ moderation: { suspended: 'true' } }) === false, '文字列は通常');
assert(readUserSuspended({ moderation: { suspended: true } }) === true, 'true だけ停止');

const denied = decideAdminSuspension({ ...base, isAdmin: false, body: { suspended: false } });
assert(!denied.ok && denied.error === 'unauthorized', '1. 管理者以外は拒否');
const badOrigin = decideAdminSuspension({ ...base, origin: 'https://evil.example', body: { suspended: false } });
assert(!badOrigin.ok && badOrigin.error === 'bad-origin', '2. 許可外 Origin は拒否');
const missingOrigin = decideAdminSuspension({ ...base, origin: null, body: { suspended: false } });
assert(!missingOrigin.ok && missingOrigin.error === 'bad-origin', '2. Origin 無しは拒否');
const self = decideAdminSuspension({ ...base, uid: 'admin-self', body: { suspended: true, reason: 'x' } });
assert(!self.ok && self.error === 'forbidden-target', '3. 自分は停止できない');
const otherAdmin = decideAdminSuspension({ ...base, uid: 'admin-other', body: { suspended: true, reason: 'x' } });
assert(!otherAdmin.ok && otherAdmin.error === 'forbidden-target', '3. 他の管理者も停止できない');

const suspendBody = { suspended: true, reason: ' 規約違反 ' };
const parsed = parseSuspensionBody(suspendBody);
assert(parsed?.suspended === true && parsed.reason === '規約違反', '理由は前後の空白を除く');
assert(parseSuspensionBody({ suspended: true, reason: '' }) === null, '空の理由は拒否');
assert(parseSuspensionBody({ suspended: true, reason: 'a'.repeat(201) }) === null, '201文字は拒否');
assert(parseSuspensionBody({ suspended: true, reason: 'ok', extra: true }) === null, '余分な項目は拒否');
assert(parseSuspensionBody({ suspended: false, reason: 'x' }) === null, '解除に理由は付けない');
const once = parseSuspensionBody({ suspended: false });
const twice = parseSuspensionBody({ suspended: false });
assert(JSON.stringify(once) === JSON.stringify(twice), '13. 同じ入力は同じ結果');

const okSuspend = decideAdminSuspension({ ...base, body: { suspended: true, reason: '規約違反' } });
assert(okSuspend.ok && okSuspend.suspended === true, '停止を受け付ける');
const okLift = decideAdminSuspension({ ...base, body: { suspended: false } });
assert(okLift.ok && okLift.suspended === false, '解除を受け付ける');

const lifted = suspensionFieldUpdate({ suspended: false });
assert(JSON.stringify(lifted) === JSON.stringify({ 'moderation.suspended': false }), '12. 解除は停止フラグだけ');
const suspendedFields = suspensionFieldUpdate({ suspended: true, reason: '規約違反', actorUid: 'admin-self' });
assert(suspendedFields['moderation.suspended'] === true, '停止フラグを書く');
assert(suspendedFields['moderation.suspensionReason'] === '規約違反', '理由を書く');
assert(suspendedFields['moderation.suspendedBy'] === 'admin-self', '操作者を書く');
assert(!Object.keys(suspendedFields).join(' ').includes('spotlightOff'), '12. TOP掲載は更新項目に入らない');
assert(!Object.keys(lifted).join(' ').includes('isPublic'), '公開設定は更新項目に入らない');

const publicOn = {
  moderation: { spotlightOff: true, suspended: false },
  profile: { isPublic: true, onboardingStatus: 'complete' },
};
assert(isPublicListingEligible(publicOn), '11. 解除後、公開条件を満たせば掲載できる');
assert(readUserSpotlightOff(publicOn) === true, '12. TOP掲載OFFは残る');
assert(
  !isPublicListingEligible({ ...publicOn, moderation: { spotlightOff: true, suspended: true } }),
  '10. 停止中は公開フラグが true でも掲載しない'
);
assert(
  !isPublicListingEligible({ deletionPending: true, moderation: { suspended: false }, profile: { isPublic: true } }),
  '14. 退会中は掲載しない'
);
assert(
  !isPublicListingEligible({ deletionPending: true, moderation: { suspended: true }, profile: { isPublic: true } }),
  '14. 停止と退会が重なっても掲載しない'
);
assert(blocksSuspensionChange({ deletionPending: true }), '14. 退会中は停止操作を受けない');
assert(!isPublicListingEligible({ profile: { isPublic: false } }), '非公開の通常ユーザーは掲載しない');
assert(
  !isPublicListingEligible({
    moderation: { suspended: false },
    profile: { isPublic: true, onboardingStatus: 'required' },
  }),
  '解除後も初期設定未完了なら掲載しない'
);
const staleCards = [
  { uid: 'gone', name: '停止', title: '肩書き', photoUrl: '' },
  { uid: 'live', name: '公開', title: '肩書き', photoUrl: '' },
];
assert(
  retainListedCards(staleCards, new Set(['live'])).map((card) => card.uid).join(',') === 'live',
  '公開プロフィールが消えたカードは一覧応答から外す'
);
assert(safeLoginRedirect('user-1', '/account/suspended') === '/account/suspended', '停止中のログイン先だけを許可する');
assert(safeLoginRedirect('user-1', 'https://evil.example') === '/user/user-1', 'ログイン先の外部URLは捨てる');
assert(safeLoginRedirect('user-1', '/profile/setup') === '/profile/setup', '通常の初期設定への遷移は残す');

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

const guarded = [
  'app/api/photos/route.ts',
  'app/api/uploadPhotos/route.ts',
  'app/api/deletePhotos/route.ts',
  'app/api/upload-banner/route.ts',
  'app/api/users/[uid]/route.ts',
  'app/api/favorites/[target]/route.ts',
  'app/api/favorites/users/route.ts',
  'app/account/update/route.ts',
];
for (const rel of guarded) {
  assert(read(rel).includes('rejectIfSuspended'), `4-6. ${rel} は停止を拒否する`);
}
assert(read('app/api/user/[uid]/route.ts').includes('readUserSuspended'), '4. プロフィール保存は停止を拒否する');
assert(read('app/api/banner-links/route.ts').includes('readUserSuspended'), '9. バナー取得と保存は停止を見る');
assert(read('app/lib/onboardingSetupServer.ts').includes('readUserSuspended'), '初期設定は停止を拒否する');
assert(read('app/lib/oshiDaily.ts').includes('AccountSuspendedError'), '6. 停止中の本人は推しを押せない');
assert(read('app/lib/oshiDaily.ts').includes('readUserSuspended'), '6. 停止中のユーザーは推しの対象にならない');
assert(!read('app/api/account/delete/route.ts').includes('rejectIfSuspended'), '7. 退会 API は停止判定で塞がない');
assert(read('app/user/[uid]/page.tsx').includes('isSuspendedProfile'), '8. プロフィールページは停止を隠す');
assert(read('app/lib/getProfile.ts').includes('accountSuspended'), '8. 本文用の読み取りはプロフィールを返さない');
assert(!read('app/account/suspended/page.tsx').includes('suspensionReason'), '停止理由を専用画面に出さない');
assert(!read('app/api/user/[uid]/route.ts').includes('suspensionReason'), '9. 公開APIは停止理由を返さない');
assert(read('app/lib/listing/firestoreListing.ts').includes('isPublicListingEligible'), '10. 掲載同期が停止を見る');
assert(read('app/lib/listing/legacyDirectory.ts').includes('readUserSuspended'), '10. 旧一覧が停止を見る');
assert(read('scripts/listing-migrate.ts').includes('isPublicListingEligible'), '10. 移行スクリプトが停止を見る');
assert(read('app/api/admin/users/[uid]/suspension/route.ts').includes('enqueueUserListing'), '掲載同期を再利用する');
assert(read('app/api/admin/users/[uid]/suspension/route.ts').includes('skippedLock'), 'ロック中は掲載ワーカーを奪わない');
assert(
  read('app/api/admin/users/[uid]/suspension/route.ts').includes("error: 'sync-failed'") &&
    read('app/api/admin/users/[uid]/suspension/route.ts').includes('listingPending: true'),
  '同期失敗は停止保存と掲載未反映を区別する'
);
assert(read('app/users/page.tsx').includes('omitCardsWithoutProfile'), '固定ページの古いカードは公開応答から外す');
assert(read('app/admin/users/page.tsx').includes('停止済み・掲載反映待ち'), '管理画面は掲載反映待ちを表示する');
assert(read('app/api/admin/users/route.ts').includes('listingOutbox'), '反映待ちは対象ユーザーのoutboxだけを見る');
assert(!read('app/api/admin/users/[uid]/suspension/route.ts').includes('spotlightOff'), '停止APIはTOP掲載を書かない');
assert(read('app/api/session/login/route.ts').includes('ACCOUNT_SUSPENDED_PATH'), 'ログイン後に停止画面へ誘導する');
assert(read('app/api/admin/users/[uid]/route.ts').includes('parseSpotlightPatch') || read('app/api/admin/users/[uid]/route.ts').includes('decideAdminSpotlightPatch'), 'Spotlight用PATCHは残る');

console.log('account-suspension-check: ok');
