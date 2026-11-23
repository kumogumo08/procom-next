/**
 * 応援履歴の公開設定。Firestore には接続しない。
 * 実行: npx tsx scripts/fan-activity-visibility-check.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canShowPublicFanActivity, isFanActivityPublic, parseFanActivityVisibility } from '@/lib/fanActivityVisibility';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(isFanActivityPublic('creator', true) === true, 'クリエイターのtrueだけ公開');
assert(isFanActivityPublic(undefined, true) === true, '種別が無い会員のtrueは公開');
assert(isFanActivityPublic('creator', false) === false, 'falseは非公開');
assert(isFanActivityPublic('creator', undefined) === false, '未設定は非公開');
assert(isFanActivityPublic('creator', 'true') === false, '文字列のtrueは非公開');
assert(isFanActivityPublic('fan', true) === false, 'ファンはtrueでも非公開');
assert(parseFanActivityVisibility({ public: false }).ok === true, '非公開の保存値を受ける');
assert(parseFanActivityVisibility({ public: true }).ok === true, '公開の保存値を受ける');
assert(parseFanActivityVisibility({ public: 'true' }).ok === false, '文字列は拒否する');
assert(parseFanActivityVisibility({ uid: 'other', public: true }).ok === true, '本文のUIDは公開値に使わない');
assert(parseFanActivityVisibility({}).ok === false, '項目が無い入力は拒否する');

const profile = { name: '公開', isPublic: true, onboardingStatus: 'complete' as const };
const creator = { accountKind: 'creator', profile };
assert(canShowPublicFanActivity({ ...creator, fanActivityPublic: true }) === true, '公開設定と公開プロフィールが揃ったときだけ公開');
assert(canShowPublicFanActivity(creator) === false, '未設定は公開ページに出さない');
assert(canShowPublicFanActivity({ ...creator, fanActivityPublic: false }) === false, 'falseは公開ページに出さない');
assert(canShowPublicFanActivity({ accountKind: 'fan', fanActivityPublic: true, profile }) === false, 'ファン会員は公開ページに出さない');
assert(canShowPublicFanActivity({ ...creator, fanActivityPublic: true, deletionPending: true }) === false, '退会中は公開ページに出さない');
assert(
  canShowPublicFanActivity({ ...creator, fanActivityPublic: true, moderation: { suspended: true } }) === false,
  '停止中は公開ページに出さない'
);
assert(
  canShowPublicFanActivity({
    accountKind: 'creator',
    fanActivityPublic: true,
    profile: { ...profile, onboardingStatus: 'required' },
  }) === false,
  '未完成プロフィールは公開ページに出さない'
);
assert(
  canShowPublicFanActivity({
    accountKind: 'creator',
    fanActivityPublic: true,
    profile: { ...profile, isPublic: false },
  }) === false,
  '非公開プロフィールは公開ページに出さない'
);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const route = readFileSync(join(root, 'app/api/fan-activity-visibility/route.ts'), 'utf8');
const page = readFileSync(join(root, 'app/mypage/page.tsx'), 'utf8');
assert(route.includes('resolveVerifiedSession'), 'セッションのUIDだけを使う');
assert(route.includes('FAN_ACTIVITY_PUBLIC_FIELD') && !route.includes('profile:'), '公開設定の項目だけを保存する');
assert(route.includes("=== FAN_ACCOUNT_KIND"), 'ファンは保存できない');
assert(!route.includes('searchParams') && !route.includes('body.uid') && !route.includes('body?.uid'), '他人のUIDは受け取らない');
const marker = page.indexOf('<FanActivityVisibility');
const fanBranch = page.indexOf("view.role === 'fan' ? (");
assert(marker > page.indexOf(') : (', fanBranch), '公開設定はクリエイターのアカウント情報に置く');
assert(!page.includes('ファン活動を見る'), '公開ページへのリンクはまだ出さない');
const activityPage = readFileSync(join(root, 'app/user/[uid]/activity/page.tsx'), 'utf8');
const loader = readFileSync(join(root, 'app/lib/publicFanActivityServer.ts'), 'utf8');
const userPage = readFileSync(join(root, 'app/user/[uid]/page.tsx'), 'utf8');
const tabs = readFileSync(join(root, 'app/components/ProfileActivityTabs.tsx'), 'utf8');
assert(activityPage.includes("robots: { index: false, follow: false }"), '公開ページは検索に残さない');
assert(activityPage.indexOf('if (!activity)') < activityPage.indexOf('creator.name'), '非公開のときは履歴を描画しない');
assert(loader.indexOf('canShowPublicFanActivity') < loader.indexOf(".where('fanUid'"), '公開判定の前に応援履歴を読まない');
assert(!loader.includes('email') && !activityPage.includes('email'), 'メールアドレスは読まない');
assert(loader.includes('visibleCreatorCard') && loader.includes('fieldMask'), '非公開の応援先は除外する');
assert(userPage.includes('!isEditable && (await isPublicFanActivityPage(uid))'), '一般訪問者には公開中だけタブを出す');
assert(tabs.includes("activityHref = '/mypage'"), '本人のファン活動タブはマイページのまま');
assert(readFileSync(join(root, 'middleware.ts'), 'utf8').includes("path.startsWith('/user/')"), 'プロフィール配下はキャッシュしない');
assert(!readFileSync(join(root, 'app/sitemap.ts'), 'utf8').includes('/activity'), 'サイトマップにファン活動ページを足さない');

console.log('fan-activity-visibility-check ok');
