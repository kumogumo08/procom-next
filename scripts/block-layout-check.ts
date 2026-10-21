/**
 * ブロック配置の純関数検査。Firestore には接続しない。
 * 実行: npx tsx scripts/block-layout-check.ts
 */
import {
  activateBlockLayout,
  addBlock,
  availableBlocks,
  blockLayoutMode,
  comparableLayoutFields,
  DEFAULT_SECTION_ORDER,
  isBlockPlaced,
  layoutFieldsForSave,
  mergeProfileSettings,
  moveBlock,
  removeBlock,
  resolveSectionOrder,
  sectionOrderDraftFromReorder,
} from '@/lib/blockLayout';
import { meaningfulProfileChanged, nextContentStamp } from '@/lib/profileContent';
import { buildProfileDocumentTitle, isProfilePublic } from '@/lib/userSeo';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function same(actual: unknown, expected: unknown, message: string): void {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

const HISTORICAL_DEFAULT = [
  'YouTube',
  'X',
  'Instagram',
  'TikTok',
  'Facebook',
  'BannerLinks',
  'AppProjects',
  'SNSButtons',
];

const content = {
  manualYouTubeUrls: ['https://youtu.be/abcdefghijk'],
  tiktokUrls: ['https://www.tiktok.com/@name/video/1'],
  xUsername: 'name',
};
const contentBefore = JSON.stringify(content);

same([...DEFAULT_SECTION_ORDER], HISTORICAL_DEFAULT, '既定順は従来の8セクション');

assert(blockLayoutMode(undefined) === 'legacy', 'version 未設定は旧形式');
assert(blockLayoutMode(1) === 'v1', 'version 1 は新形式');
assert(blockLayoutMode(null) === 'unsupported', 'null は未設定と区別する');
assert(blockLayoutMode('1') === 'unsupported', '文字列の 1 は新形式にしない');
assert(blockLayoutMode(2) === 'unsupported', '未知バージョンは変換しない');

same(resolveSectionOrder(undefined, undefined), HISTORICAL_DEFAULT, '旧形式で sectionOrder 未設定は既定順');
same(resolveSectionOrder([], undefined), HISTORICAL_DEFAULT, '旧形式の空配列は未設定と同じ既定順');
same(
  resolveSectionOrder(['SNSButtons', 'YouTube', 'AppProjects'], undefined),
  ['SNSButtons', 'YouTube', 'AppProjects'],
  '旧形式で AppProjects がある並びはそのまま'
);
same(
  resolveSectionOrder(
    ['YouTube', 'X', 'Instagram', 'TikTok', 'Facebook', 'BannerLinks', 'SNSButtons'],
    undefined
  ),
  HISTORICAL_DEFAULT,
  '旧形式で AppProjects が無いときは SNSButtons の直前'
);
same(resolveSectionOrder(['YouTube', 'X'], undefined), ['YouTube', 'X', 'AppProjects'], 'SNSButtons が無ければ末尾に補完');
same(
  resolveSectionOrder(['YouTube', 'YouTube', 'X'], undefined),
  ['YouTube', 'YouTube', 'X', 'AppProjects'],
  '旧形式は重複キーを残す'
);

same(resolveSectionOrder(HISTORICAL_DEFAULT, 1), HISTORICAL_DEFAULT, '新形式の全8セクション');
const three = ['TikTok', 'BannerLinks', 'X'];
same(resolveSectionOrder(three, 1), three, '新形式は指定した3件だけ');
same(resolveSectionOrder([], 1), [], '新形式の空配列は全削除');
same(resolveSectionOrder(undefined, 1), [], '新形式で sectionOrder が無くても既定順を足さない');
same(
  resolveSectionOrder(['YouTube', 'SNSButtons'], 1),
  ['YouTube', 'SNSButtons'],
  '新形式は削除済み AppProjects を補完しない'
);
same(
  resolveSectionOrder(['YouTube', 'YouTube', 'X', 'Nope'], 1),
  ['YouTube', 'X'],
  '新形式は重複と不明キーを落とす'
);

same(resolveSectionOrder(['YouTube', 'Foo', 'SNSButtons'], 2), ['YouTube', 'SNSButtons'], '未対応バージョンは既知キーだけを表示する');
same(resolveSectionOrder([], 2), [], '未対応バージョンの空配列を既定順に戻さない');
same(resolveSectionOrder(undefined, 2), [], '未対応バージョンに既定順を補完しない');
assert(activateBlockLayout(['YouTube'], 2) === null, '未対応バージョンは新形式へ変換しない');
assert(sectionOrderDraftFromReorder(['X', 'YouTube'], 2) === null, '未対応バージョンの並び替えは保存しない');

const legacyVisible = resolveSectionOrder(['YouTube', 'SNSButtons'], undefined);
const activated = activateBlockLayout(['YouTube', 'SNSButtons'], undefined);
assert(activated?.blockLayoutVersion === 1, '明示的な有効化だけが version 1 を作る');
same(activated?.sectionOrder, legacyVisible, '有効化しても旧形式の表示順は変わらない');
same(resolveSectionOrder(activated?.sectionOrder, 1), legacyVisible, '有効化後も同じ順で読める');
assert(
  JSON.stringify(resolveSectionOrder(['YouTube', 'SNSButtons'], undefined)) !==
    JSON.stringify(resolveSectionOrder(['YouTube', 'SNSButtons'], 1)),
  '読み取り時に version を足すと旧表示が変わる'
);

const removed = removeBlock(['YouTube', 'X', 'TikTok'], 'YouTube');
same(removed, ['X', 'TikTok'], 'YouTube を配置から外す');
assert(JSON.stringify(content) === contentBefore, '削除しても動画 URL などのデータ関数は内容を受け取らない');
const restored = addBlock(removed, 'YouTube', 0);
same(restored, ['YouTube', 'X', 'TikTok'], '再追加で同じ種類を戻せる');
same(addBlock(restored, 'YouTube'), restored, '同じブロックは重複追加しない');
same(addBlock(['X'], 'Twitch'), ['X'], '不明なキーは追加しない');
same(addBlock(['X'], 'YouTube', 0), ['YouTube', 'X'], '追加位置を指定できる');
same(addBlock(['X'], 'YouTube', 99), ['X', 'YouTube'], '範囲外の追加位置は末尾');

same(moveBlock(['YouTube', 'X', 'Instagram'], 'YouTube', 2), ['X', 'Instagram', 'YouTube'], '指定位置へ移動する');
same(moveBlock(['YouTube', 'X'], 'YouTube', 99), ['X', 'YouTube'], '範囲外の移動は端に収める');
same(moveBlock(['YouTube', 'X'], 'YouTube', -5), ['YouTube', 'X'], '負の位置で先頭にあるキーは動かさない');
same(moveBlock(['YouTube', 'X'], 'YouTube', Number.NaN), ['YouTube', 'X'], '不正な位置では動かさない');
same(moveBlock(['YouTube'], 'Nope', 0), ['YouTube'], '不明なキーは移動しない');
same(moveBlock(['YouTube', 'X'], 'TikTok', 0), ['YouTube', 'X'], '未配置のキーは挿入しない');

assert(isBlockPlaced(['YouTube', 'X'], 'YouTube'), '配置済みを判定できる');
assert(!isBlockPlaced(['YouTube'], 'X'), '未配置を判定できる');
assert(!isBlockPlaced(['YouTube', 'Foo'], 'Foo'), '不明なキーは配置済みにしない');
same(
  availableBlocks(['YouTube', 'X']),
  ['Instagram', 'TikTok', 'Facebook', 'BannerLinks', 'AppProjects', 'SNSButtons'],
  '未配置の種類だけを返す'
);
same(availableBlocks(HISTORICAL_DEFAULT), [], '8件すべて配置済みなら追加候補は空');

const settings = {
  showYouTube: false,
  showX: true,
  blockLayoutVersion: 1,
  sectionOrder: ['YouTube', 'X'],
};
const withoutYouTube = { ...settings, sectionOrder: removeBlock(settings.sectionOrder, 'YouTube') };
assert(withoutYouTube.showYouTube === false, '削除しても showYouTube は残る');
assert(withoutYouTube.showX === true, '削除しても他の表示フラグは残る');
assert(withoutYouTube.blockLayoutVersion === 1, '削除しても version は残る');
assert(JSON.stringify(content) === contentBefore, '追加と削除のあとでもコンテンツオブジェクトは同じ');

const legacySave = layoutFieldsForSave(
  { sectionOrder: ['X', 'YouTube'], showYouTube: false },
  HISTORICAL_DEFAULT
);
assert(!('blockLayoutVersion' in legacySave), '旧形式の保存で version を足さない');
same(legacySave.sectionOrder, ['X', 'YouTube'], '旧形式の保存は渡された並びを維持する');
const legacyMerged = mergeProfileSettings(
  { showYouTube: false, showX: true },
  { showYouTube: false, showX: true, ...legacySave }
);
assert(!('blockLayoutVersion' in legacyMerged), 'マージ後も旧形式のまま');
assert(legacyMerged.showYouTube === false && legacyMerged.showX === true, '通常保存で表示フラグを消さない');

const emptySave = layoutFieldsForSave({ sectionOrder: [], blockLayoutVersion: 1 }, HISTORICAL_DEFAULT);
same(emptySave.sectionOrder, [], '空配列を有効な保存値にする');
assert(emptySave.blockLayoutVersion === 1, 'version 1 を保存できる');
const emptyMerged = mergeProfileSettings(
  { sectionOrder: HISTORICAL_DEFAULT, showYouTube: false, blockLayoutVersion: 1 },
  emptySave
);
same(emptyMerged.sectionOrder, [], '再マージ後も空配列');
assert(emptyMerged.showYouTube === false, '空配列の保存で表示フラグは残る');
same(resolveSectionOrder(emptyMerged.sectionOrder, emptyMerged.blockLayoutVersion), [], '再取得後も全削除のまま');

const movedSettings = mergeProfileSettings(settings, {
  ...layoutFieldsForSave(
    { ...settings, sectionOrder: moveBlock(settings.sectionOrder, 'YouTube', 1) },
    HISTORICAL_DEFAULT
  ),
  showYouTube: false,
  showX: true,
});
same(movedSettings.sectionOrder, ['X', 'YouTube'], '保存と再マージのあとでも移動後の順');
assert(movedSettings.blockLayoutVersion === 1, '再マージ後も version 1');

const photoSave = mergeProfileSettings(
  { blockLayoutVersion: 1, sectionOrder: [], showYouTube: false },
  undefined
);
assert(photoSave.blockLayoutVersion === 1, 'settings を送らない保存でも version は残る');
same(photoSave.sectionOrder, [], 'settings を送らない保存でも空の配置は残る');
assert(photoSave.showYouTube === false, 'settings を送らない保存でも表示フラグは残る');

const rejected = mergeProfileSettings(
  { showYouTube: false, sectionOrder: ['X'] },
  { showYouTube: false, sectionOrder: ['X'], blockLayoutVersion: '1' }
);
assert(!('blockLayoutVersion' in rejected), '不正な version では新形式にしない');
const keptVersion = mergeProfileSettings(
  { blockLayoutVersion: 1, sectionOrder: ['X'], showYouTube: false },
  { blockLayoutVersion: null, sectionOrder: ['X'] }
);
assert(keptVersion.blockLayoutVersion === 1, '不正な version で既存の 1 を消さない');
assert(!('isPublic' in mergeProfileSettings({ showX: true }, { sectionOrder: ['X'] })), 'settings マージは isPublic を作らない');

function layoutKey(value: object | undefined, fallback: readonly string[]) {
  return JSON.stringify(comparableLayoutFields(layoutFieldsForSave(value, fallback)));
}

assert(
  layoutKey({ sectionOrder: ['YouTube'] }, HISTORICAL_DEFAULT) !==
    layoutKey({ sectionOrder: ['X'] }, HISTORICAL_DEFAULT),
  '並びの変更は未保存になる'
);
assert(
  layoutKey({ sectionOrder: ['YouTube'], blockLayoutVersion: 1 }, HISTORICAL_DEFAULT) !==
    layoutKey({ sectionOrder: ['YouTube'] }, HISTORICAL_DEFAULT),
  'version の違いも未保存になる'
);
assert(
  layoutKey({ sectionOrder: ['YouTube'], showYouTube: false }, HISTORICAL_DEFAULT) ===
    layoutKey({ sectionOrder: ['YouTube'], showYouTube: true }, HISTORICAL_DEFAULT),
  'レイアウト比較は表示フラグでは汚れない'
);
assert(
  layoutKey({ sectionOrder: ['YouTube'] }, HISTORICAL_DEFAULT) ===
    layoutKey({ sectionOrder: ['YouTube'] }, HISTORICAL_DEFAULT),
  '同じ並びは未保存にしない'
);

const profile = {
  name: '花',
  title: '歌手',
  bio: '紹介',
  isPublic: true,
  photos: [{ url: 'https://example.com/a.jpg' }],
  manualYouTubeUrls: content.manualYouTubeUrls,
  tiktokUrls: content.tiktokUrls,
  settings: { showYouTube: false, sectionOrder: ['YouTube', 'TikTok'] },
};
const layoutOnly = {
  ...profile,
  settings: { showYouTube: false, sectionOrder: [] as string[], blockLayoutVersion: 1 },
};
assert(!meaningfulProfileChanged(profile, layoutOnly), '配置だけの変更は内容の指紋を変えない');
assert(nextContentStamp(profile, layoutOnly, 1_700_000_000_000) === undefined, '配置だけでは更新時刻を進めない');
assert(
  meaningfulProfileChanged(profile, { ...profile, manualYouTubeUrls: [] }),
  '動画 URL を消した場合は内容の変更になる'
);
assert(
  buildProfileDocumentTitle(profile.name, profile.title) === buildProfileDocumentTitle(layoutOnly.name, layoutOnly.title),
  '配置を変えても title 用の名前と肩書きは同じ'
);
assert(isProfilePublic(profile) === isProfilePublic(layoutOnly), '配置を変えても公開判定は同じ');

same(
  sectionOrderDraftFromReorder(['SNSButtons', 'YouTube'], undefined),
  ['AppProjects', 'SNSButtons', 'YouTube'],
  '旧形式の並び替え結果には従来どおり SNSButtons の直前へ AppProjects を補完する'
);
same(
  sectionOrderDraftFromReorder(['SNSButtons', 'YouTube'], 1),
  ['SNSButtons', 'YouTube'],
  '新形式の並び替え結果は補完しない'
);

console.log('block-layout-check ok');
