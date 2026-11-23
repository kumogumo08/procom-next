/**
 * 共通マイページの表示判定。Firestore には接続しない。
 * 実行: npx tsx scripts/mypage-check.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mypageView } from '@/lib/accountKind';
import {
  formatTokyoDate,
  readOwnSupportLink,
  selectOwnTargetIds,
  sumSupportCounts,
  visibleCreatorCard,
} from '@/lib/mypageActivity';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const fan = mypageView('fan', { name: '公開名' }, ' ファン名 ');
assert(fan.role === 'fan' && fan.roleLabel === 'ファン' && fan.displayName === 'ファン名', 'ファンは表示名を出す');
const creator = mypageView('creator', { name: ' 公開名 ' }, 'ファン名');
assert(
  creator.role === 'creator' && creator.roleLabel === 'クリエイター' && creator.displayName === '公開名',
  'クリエイターは公開名を出す'
);
const legacy = mypageView(undefined, { name: '既存' }, undefined);
assert(legacy.role === 'creator' && legacy.displayName === '既存', '種別が無い既存会員は公開名のまま');
assert(mypageView('fan', { name: '' }, '   ').displayName === 'ユーザー', '空の表示名はユーザー');
assert(mypageView('creator', { name: '' }, '表示名').displayName === 'ユーザー', '空の公開名は表示名へ戻さない');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(root, 'app/mypage/page.tsx'), 'utf8');
assert(page.includes("robots: { index: false, follow: false }"), 'マイページは検索対象にしない');
assert(!page.includes('クリエイターとしてプロフィールを作成する'), 'マイページ本文に作成ボタンを出さない');
assert(!page.includes('className={styles.primaryButton}'), 'マイページ本文の作成ボタンを出さない');
const header = readFileSync(join(root, 'app/components/UserPageNavHeader.tsx'), 'utf8');
assert(header.includes('ファン活動（マイページ）') && header.includes('href="/mypage"'), 'ファン活動はマイページのまま');
assert(header.includes('クリエイターとして登録') && header.includes('href="/profile/setup"'), 'ファンの作成導線はメニューへ置く');
assert(header.includes('公開プロフィールを編集') && header.includes('`/user/${uid}`'), 'クリエイターは公開プロフィールを編集する');
assert(header.includes('href="/mypage/fans"'), 'クリエイターはファン管理へ進める');
assert(header.includes('FAN_ACCOUNT_KIND'), 'メニューは会員種別で分ける');
assert(header.indexOf('href="/mypage/fans"') > header.indexOf('=== FAN_ACCOUNT_KIND'), 'ファンにはファン管理を出さない');
assert(header.includes('アカウント設定') && header.includes('href="/account"') && header.includes('ログアウト'), '設定とログアウトを残す');
assert(!header.includes('公開プロフィールを見る'), '公開プロフィールを見るは出さない');
assert(!page.includes('mypage-profile') && !page.includes('公開プロフィールを見る'), 'マイページ本文のプロフィールカードを出さない');
assert(page.includes('<FanActivityVisibility'), '応援履歴の公開設定は本文に残す');
assert(page.includes('お気に入りはまだありません') && page.includes('応援履歴はまだありません'), 'データが無いときの空状態がある');
assert(page.includes('loadMypageActivity(uid'), '取得UIDはログインセッションだけ');
assert(!page.includes('searchParams') && !page.includes('oshiCount'), 'クライアント指定と公開合計は使わない');
const activity = readFileSync(join(root, 'app/lib/mypageActivity.ts'), 'utf8');
const loader = readFileSync(join(root, 'app/lib/mypageActivityServer.ts'), 'utf8');
assert(activity.includes('input.count'), '回数はリンクのcountだけ');
assert(!activity.includes('oshiCount') && !loader.includes('oshiCount') && !page.includes('oshiCount'), 'oshiCountは個人履歴に使わない');
assert(loader.includes(".where('fanUid', '==', ownerUid)"), '応援履歴は本人のfanUidだけ');
assert(loader.includes('MYPAGE_LIST_LIMIT'), '取得件数に上限がある');
const ids = selectOwnTargetIds('owner1234', ['owner1234', 'creator1', 'bad uid', 'creator1', 'creator2']);
assert(ids.ids.join() === 'creator1,creator2' && ids.truncated === false, '自分と不正なUIDと重複を除く');
assert(selectOwnTargetIds('owner1234', Array.from({ length: 51 }, (_, i) => `creator${i}A`)).truncated, '51件目で上限');
assert(readOwnSupportLink('owner1234', { fanUid: 'other1234', creatorUid: 'creator1', count: 2 }) === null, '他人の履歴は捨てる');
assert(readOwnSupportLink('owner1234', { fanUid: 'owner1234', creatorUid: 'owner1234', count: 2 }) === null, '自分自身の履歴は捨てる');
const own = readOwnSupportLink('owner1234', { fanUid: 'owner1234', creatorUid: 'creator1', count: 2.9 });
assert(own?.count === 2, '累計はsupportLinksのcountを切り捨てる');
const hidden = { deletionPending: true, profile: { name: '秘密', isPublic: true, onboardingStatus: 'complete' } };
assert(visibleCreatorCard('creator1', hidden) === null, '退会中の名前は出さない');
const suspended = { moderation: { suspended: true }, profile: { name: '停止', isPublic: true, onboardingStatus: 'complete' } };
assert(visibleCreatorCard('creator1', suspended) === null, '停止中の名前は出さない');
const closed = { profile: { name: '非公開', isPublic: false, onboardingStatus: 'complete' } };
assert(visibleCreatorCard('creator1', closed) === null, '非公開の名前は出さない');
const shown = visibleCreatorCard('creator1', {
  profile: { name: '公開', isPublic: true, onboardingStatus: 'complete', photos: [{ url: 'https://example.com/a.jpg' }] },
});
assert(shown?.name === '公開' && shown.photoUrl.startsWith('https://'), '公開中だけ名前と画像を出す');
assert(sumSupportCounts([{ count: 2 }, { count: 3 }]) === 5, '表示中の累計を合計する');
assert(formatTokyoDate(new Date('2026-11-22T15:30:00.000Z')) === '2026/11/23', '最終応援日は日本時間');
assert(readFileSync(join(root, 'app/components/Header.tsx'), 'utf8').includes('href="/mypage"'), 'ヘッダーからマイページへ進める');
assert(page.includes('current="activity"'), 'マイページではファン活動を選択');
assert(page.includes("view.role === 'fan' ? undefined : uid"), 'ファンには公開プロフィールタブを出さない');
const userPage = readFileSync(join(root, 'app/user/[uid]/page.tsx'), 'utf8');
const userPageBody = userPage.slice(userPage.indexOf('export default async function UserPage'));
assert(!userPage.slice(0, userPage.indexOf('export default async function UserPage')).includes('showProfileActivityTabs'), '公開メタデータにはタブを足さない');
assert(userPageBody.includes('isEditable && (await getAccountKindFromFirestore(uid)) !== FAN_ACCOUNT_KIND'), 'タブは本人かつファン以外');
assert((userPageBody.match(/showProfileActivityTabs=\{showProfileActivityTabs\}/g) || []).length === 1, '公開できた本人ページだけタブを渡す');
const photoBlock = readFileSync(join(root, 'app/components/PhotoSliderBlock.tsx'), 'utf8');
assert(
  photoBlock.indexOf('<UserPageTopGallery') < photoBlock.indexOf('<ProfileActivityTabs'),
  'タブはメイン画像の後'
);
assert(!readFileSync(join(root, 'app/sitemap.ts'), 'utf8').includes('/mypage'), 'サイトマップにマイページを足さない');

console.log('mypage-check ok');
