/**
 * クリエイター向けファン管理の表示判定。Firestore には接続しない。
 * 実行: npx tsx scripts/fan-management-check.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SUPPORTER_FIELDS,
  buildSupporterCard,
  readCreatorSupportLink,
  supporterDisplayName,
} from '@/lib/fanManagement';
import { sumSupportCounts } from '@/lib/mypageActivity';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const owner = 'creator1';
const fan = {
  accountKind: 'fan',
  fanName: 'ファン名',
  email: 'fan@example.com',
  profile: { name: '公開名', isPublic: false, photos: [{ url: 'https://example.com/secret.jpg' }] },
};
assert(supporterDisplayName(fan) === 'ファン名', '公開プロフィールのないファンは表示名');
const creator = {
  accountKind: 'creator',
  fanName: '別の名前',
  profile: { name: '応援クリエイター', isPublic: false },
};
assert(supporterDisplayName(creator) === '応援クリエイター', 'クリエイターは公開名');
assert(supporterDisplayName({ profile: { name: '既存' } }) === '既存', '種別が無い会員は公開名');
assert(
  supporterDisplayName({ deletionPending: true, fanName: '退会', accountKind: 'fan' }) === null,
  '退会中は出さない'
);
assert(
  supporterDisplayName({ moderation: { suspended: true }, fanName: '停止', accountKind: 'fan' }) === null,
  '停止中は出さない'
);
assert(supporterDisplayName(null) === null, '文書が無い会員は出さない');
assert(readCreatorSupportLink(owner, { fanUid: 'fan12345', creatorUid: 'other1234', count: 2 }) === null, '他人宛ては捨てる');
assert(readCreatorSupportLink(owner, { fanUid: owner, creatorUid: owner, count: 2 }) === null, '自分自身は捨てる');
assert(readCreatorSupportLink(owner, { fanUid: '', creatorUid: owner, count: 2 }) === null, '匿名や空のUIDは捨てる');
const link = readCreatorSupportLink(owner, { fanUid: 'fan12345', creatorUid: owner, count: 2.9 });
assert(link?.count === 2, '累計はsupportLinksのcountを切り捨てる');
const card = buildSupporterCard(
  owner,
  { fanUid: 'fan12345', creatorUid: owner, count: 2 },
  fan,
  { firstAt: new Date('2026-11-01T00:00:00.000Z'), lastAt: new Date('2026-11-22T15:30:00.000Z') }
);
assert(card?.name === 'ファン名' && card.count === 2 && card.firstAt instanceof Date, 'ファンのカードは表示名と回数');
assert(!Object.prototype.hasOwnProperty.call(card, 'email') && !Object.prototype.hasOwnProperty.call(card, 'uid'), 'メールとUIDはカードに載せない');
assert(
  buildSupporterCard(owner, { fanUid: 'fan12345', creatorUid: owner, count: 2 }, { deletionPending: true, fanName: '退会' }, {
    firstAt: null,
    lastAt: null,
  }) === null,
  '退会済みのカードは作らない'
);
assert(sumSupportCounts([{ count: 2 }, { count: 3 }]) === 5, '表示中の累計を合計する');
assert(!SUPPORTER_FIELDS.some((field) => field.includes('email') || field.includes('photo')), '取得項目にメールと画像は無い');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(root, 'app/mypage/fans/page.tsx'), 'utf8');
const menu = readFileSync(join(root, 'app/components/UserPageNavHeader.tsx'), 'utf8');
const loader = readFileSync(join(root, 'app/lib/fanManagementServer.ts'), 'utf8');
const logic = readFileSync(join(root, 'app/lib/fanManagement.ts'), 'utf8');
assert(page.includes("robots: { index: false, follow: false }"), 'ファン管理は検索対象にしない');
assert(page.includes('応援してくれた会員数') && !page.includes('登録ファン数'), '登録ファン数とは書かない');
assert(page.includes('応援してくれた会員はまだいません'), 'データが無いときの空状態がある');
assert(page.includes('初回応援日') && page.includes('最終応援日'), '初回と最終の応援日を出す');
assert(page.includes('loadFanManagement(uid)') && !page.includes('searchParams'), '取得UIDはログインセッションだけ');
assert(page.includes("view.role !== 'creator'"), 'ファンは一覧を見ない');
assert(page.indexOf("view.role !== 'creator'") < page.indexOf('loadFanManagement(uid)'), 'クリエイター確認の後に取得する');
assert(!page.includes('oshiCount') && !logic.includes('oshiCount') && !loader.includes('oshiCount'), 'oshiCountは使わない');
assert(!page.includes('email') && !page.includes('/user/'), 'メールとプロフィールURLは出さない');
assert(menu.includes('href="/mypage/fans"'), 'メニューからファン管理へ進める');
assert(menu.indexOf('href="/mypage/fans"') > menu.indexOf('=== FAN_ACCOUNT_KIND'), 'ファンの導線には置かない');
assert(loader.includes(".where('creatorUid', '==', ownerUid)"), '応援は本人が受け取った分だけ');
assert(loader.includes('FAN_MANAGEMENT_LIMIT') && loader.includes('fieldMask'), '件数と取得項目を制限する');
assert(!readFileSync(join(root, 'app/sitemap.ts'), 'utf8').includes('/mypage'), 'サイトマップにファン管理を足さない');

console.log('fan-management-check ok');
