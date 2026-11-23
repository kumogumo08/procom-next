/**
 * 応援履歴の判定。Firestore には接続しない。
 * 実行: npx tsx scripts/oshi-history-check.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyIsolatedEnv } from './onboarding-emulator/isolate';

applyIsolatedEnv();

const {
  SUPPORT_EVENT_RETENTION_MS,
  SUPPORT_EVENT_TYPE,
  nextSupportCount,
  supportEventExpiresAt,
  supportLinkDocId,
  supportRecordPlan,
} = await import('@/lib/oshiDaily');

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const fan = 'fanUser123';
const creator = 'creator123';

assert(supportRecordPlan(null, creator) === 'anonymous', '匿名は個人履歴にしない');
assert(supportRecordPlan(fan, creator) === 'record', 'ログイン済みは履歴にする');
assert(supportRecordPlan(creator, fan) === 'record', 'クリエイターも他者を応援できる');
assert(supportRecordPlan(fan, fan) === 'self', '自分自身は記録しない');
assert(supportRecordPlan('bad uid', creator) === 'anonymous', '不正なUIDは履歴にしない');
assert(supportLinkDocId(fan, creator) === `${fan}_${creator}`, '同じ組み合わせは同じ文書');
assert(supportLinkDocId(creator, fan) !== supportLinkDocId(fan, creator), '方向は分けて保存する');
let selfId = false;
try {
  supportLinkDocId(fan, fan);
} catch {
  selfId = true;
}
assert(selfId, '自分自身のリンクIDは作らない');
assert(nextSupportCount(undefined) === 1, '初回は1');
assert(nextSupportCount(4) === 5, '既存の累計に1を足す');
assert(nextSupportCount(-3) === 1, '不正な累計は0から足す');
assert(nextSupportCount(1.9) === 2, '小数の累計は切り捨ててから足す');
const now = new Date('2026-01-01T00:00:00.000Z');
assert(
  supportEventExpiresAt(now).getTime() - now.getTime() === SUPPORT_EVENT_RETENTION_MS,
  'イベントだけ期限を持たせる'
);
assert(SUPPORT_EVENT_TYPE === 'oshi', '種別はoshi');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const oshi = readFileSync(join(root, 'app/lib/oshiDaily.ts'), 'utf8');
const route = readFileSync(join(root, 'app/api/oshi/[uid]/route.ts'), 'utf8');
const deletion = readFileSync(join(root, 'app/lib/accountDeletion.ts'), 'utf8');
const commit = oshi.slice(oshi.indexOf('export async function commitOshi'));
const tx = commit.slice(commit.indexOf('runTransaction'), commit.indexOf('catch (error'));
assert(tx.indexOf('tx.get(userRef)') < tx.indexOf('tx.get(dailyRef)'), '対象と日次を先に読む');
assert(tx.indexOf('tx.get(linkRef)') < tx.indexOf('tx.set('), 'リンクを書いてから読まない');
assert(tx.indexOf('tx.update(userRef, { oshiCount: nextTotal })') < tx.indexOf('SUPPORT_EVENTS_COLLECTION'), '回数と履歴は同じトランザクション');
assert(tx.includes('fanUid: actor.uid'), '応援者はセッションUID');
assert(!route.includes('req.json'), '応援APIは本文のUIDを受け取らない');
assert(route.includes('commitOshi(uid, actor)'), '履歴のUIDは解決済みのセッションだけ');
assert(route.includes("reason === 'self'"), '自分自身は400にする');
assert(oshi.includes('uid: sessionUid'), 'ログインUIDはセッションから入れる');
assert(oshi.includes('uid: null'), '匿名にはUIDを付けない');
assert(deletion.includes('await deleteSupportHistory(uid)'), '退会で履歴を消す');
assert(
  deletion.indexOf('await deleteSupportHistory(uid)') < deletion.indexOf("collection('users').doc(uid).delete()"),
  'ユーザー文書より先に履歴を消す'
);
assert(!deletion.includes('oshiCount'), '退会は既存の推し数を書き換えない');

console.log('oshi-history-check ok');
