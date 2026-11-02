/**
 * 管理画面の TOP 掲載一括保存。Firestore には接続しない。
 * 実行: npx tsx scripts/admin-spotlight-draft-check.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  applySpotlightToggle,
  canStartSave,
  commitSpotlightSaves,
  dirtySpotlightRows,
  discardSpotlightDraft,
} from '@/lib/adminSpotlightDraft';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

type Row = { uid: string; spotlightOff: boolean };

const saved: Record<string, boolean> = { a: false, b: false, c: true };
let rows: Row[] = [
  { uid: 'a', spotlightOff: false },
  { uid: 'b', spotlightOff: false },
  { uid: 'c', spotlightOff: true },
];

rows = applySpotlightToggle(rows, 'a', false);
assert(dirtySpotlightRows(rows, saved).map((row) => row.uid).join(',') === 'a', '1. チェック変更は下書きだけ');
assert(saved.a === false, '1. 保存済みの値は変わらない');

rows = applySpotlightToggle(rows, 'b', false);
const dirty = dirtySpotlightRows(rows, saved);
assert(dirty.map((row) => row.uid).join(',') === 'a,b', '2. 変更分だけが保存対象');
assert(dirty.every((row) => row.uid !== 'c'), '2. 変更のないユーザーは対象外');

rows = applySpotlightToggle(rows, 'c', true);
assert(dirtySpotlightRows(rows, saved).map((row) => row.uid).join(',') === 'a,b,c', '3. 複数ユーザーを変更できる');

const afterDiscard = discardSpotlightDraft(rows, saved);
assert(
  afterDiscard.every((row) => row.spotlightOff === saved[row.uid]),
  '4. 破棄すると保存済みの状態に戻る'
);
assert(dirtySpotlightRows(afterDiscard, saved).length === 0, '4. 破棄後は未保存が無い');

const partial = commitSpotlightSaves(saved, rows, ['a', 'c']);
assert(partial.a === true && partial.c === false && partial.b === false, '5. 成功分だけ保存済みになる');
assert(dirtySpotlightRows(rows, partial).map((row) => row.uid).join(',') === 'b', '5. 失敗分は未保存のまま');

assert(canStartSave(false, 2) === true, '6. 未保存があれば保存を開始できる');
assert(canStartSave(true, 2) === false, '6. 保存中は二重送信できない');
assert(canStartSave(false, 0) === false, '6. 変更が無ければ保存しない');

const page = readFileSync(join(process.cwd(), 'app/admin/users/page.tsx'), 'utf8');
assert(!page.includes('この登録者のTOP掲載をOFFにしますか'), '1. チェック時の確認ダイアログは無い');
assert(page.includes('変更を保存') && page.includes('変更を破棄'), '2. 保存と破棄がある');
assert(page.includes('canStartSave'), '6. 画面は二重送信の判定を使う');
assert(page.includes('href="/admin/news"') && page.includes('NEWS管理へ'), '管理ページ間のリンクは残る');
const usersTop = page.match(/<Link\s+href="\/"\s+onClick=\{confirmLeave\}[\s\S]*?>\s*TOPへ戻る\s*<\/Link>/);
assert(Boolean(usersTop) && !usersTop![0].includes('target='), '未保存時はTOPへ戻るでも離脱確認する');
const news = readFileSync(join(process.cwd(), 'app/admin/news/page.tsx'), 'utf8');
const newsTop = news.match(/<Link\s+href="\/"[\s\S]*?>\s*TOPへ戻る\s*<\/Link>/);
assert(Boolean(newsTop) && !newsTop![0].includes('target=') && !news.includes('beforeunload'), 'NEWS管理から同じタブでTOPへ戻れる');
const spotlight = readFileSync(join(process.cwd(), 'app/lib/listing/spotlight.ts'), 'utf8');
assert(!spotlight.includes('adminSpotlightDraft'), '7. 抽選処理は下書きを知らない');

console.log('admin-spotlight-draft-check: ok');
