/**
 * STORES商品の純関数検査。Firestore には接続しない。
 * 実行: npx tsx scripts/stores-products-check.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  BLOCK_LABELS,
  DEFAULT_SECTION_ORDER,
  editBlockPlacement,
  resolveSectionOrder,
} from '@/lib/blockLayout';
import { meaningfulProfileChanged } from '@/lib/profileContent';
import {
  addStoresProduct,
  coerceStoresProducts,
  coerceStoresProductsSettings,
  isStoresButtonMobileViewport,
  moveStoresProduct,
  parseStoresButtonCode,
  readStoresShopCandidate,
  removeStoresProduct,
  replaceStoresProduct,
  sanitizeStoresProducts,
  sanitizeStoresProductsSettings,
  STORES_BUTTON_SCRIPT_URL,
  storesButtonSize,
  storesProductIndexAfterAdd,
  storesProductIndexAfterDelete,
  storesProductIndexAfterMove,
  storesProductPageUrl,
  storesShopSectionVisible,
  type StoresProduct,
} from '@/lib/storesProducts';

const root = process.cwd();
const item = '60e965b0228d2621fce4e59d';
const variation = '60e965b0228d2621fce4e59e';
const loader =
  '(function(d,s,id){var st=d.getElementsByTagName(s)[0];if(d.getElementById(id)){return;}var nst=d.createElement(s);nst.id=id;nst.src="//btn.stores.jp/button.js";nst.charset="UTF-8";st.parentNode.insertBefore(nst,st);})(document, "script", "storesjp-button");';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function same(actual: unknown, expected: unknown, message: string): void {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}\n${JSON.stringify(actual)}`);
}

function code(options?: {
  item?: string;
  variation?: string;
  name?: string;
  layout?: string;
  lang?: string;
  image?: string;
  extraAttr?: string;
  loaderSrc?: string;
  tail?: string;
}): string {
  const image = options?.image ? ` data-storesjp-image="${options.image}"` : '';
  const extra = options?.extraAttr ?? '';
  const src = options?.loaderSrc ?? '//btn.stores.jp/button.js';
  const body = loader.replace('//btn.stores.jp/button.js', src);
  const tail = options?.tail ?? `<script>${body}</script>`;
  return `<div class="storesjp-button" data-storesjp-item="${options?.item ?? item}" data-storesjp-variation="${options?.variation ?? variation}" data-storesjp-name="${options?.name ?? 'ShopName'}" data-storesjp-layout="${options?.layout ?? 'layout_c'}" data-storesjp-lang="${options?.lang ?? 'ja'}"${image}${extra}></div>${tail}`;
}

const parsed = parseStoresButtonCode(`  ${code()}  `);
assert(parsed.ok, '公式の貼り付けコードを受理する');
if (parsed.ok) {
  same(
    parsed.product,
    { name: 'shopname', item, variation, layout: 'layout_c', lang: 'ja' },
    '6属性のうち必要なものだけを小文字で残す'
  );
  same(Object.keys(parsed.product), ['name', 'item', 'variation', 'layout', 'lang'], 'HTMLやスクリプトは保存しない');
}

const httpsLoader = parseStoresButtonCode(code({ loaderSrc: 'https://btn.stores.jp/button.js', tail: undefined }));
assert(httpsLoader.ok, 'httpsの公式ローダーも受理する');

const divOnly = parseStoresButtonCode(code({ tail: '' }));
assert(divOnly.ok, 'ローダーが無くてもdivの属性は受理する');

const imageCode = parseStoresButtonCode(code({ image: 'button_340x60.png' }));
assert(imageCode.ok, '寸法つきの画像トークンを受理する');
if (imageCode.ok) same(imageCode.product.image, 'button_340x60.png', '画像トークンを残す');

for (const bad of [
  '',
  '   ',
  code({ extraAttr: ' onclick="alert(1)"' }),
  code({ tail: '<script>alert(1)</script>' }),
  code({ name: 'shop.evil.example' }),
  code({ item: 'not-an-id' }),
  code({ variation: 'short' }),
  code({ layout: 'large' }),
  code({ lang: 'fr' }),
  code({ image: 'https://evil.example/a_20x20.png' }),
  code({ image: 'a_20x20.png?x=1' }),
  code({ image: '../a_20x20.png' }),
  `${code()}<script src="https://evil.example/a.js"></script>`,
  `<div class="storesjp-button"></div>${code()}`,
]) {
  assert(!parseStoresButtonCode(bad).ok, `不正な貼り付けコードを拒否する: ${bad.slice(0, 80)}`);
}

const product = (id: string, variationId = variation, layout = 'layout_c'): StoresProduct => ({
  name: 'shopname',
  item: id,
  variation: variationId,
  layout,
  lang: 'ja',
});

const first = product(item);
const second = product('60e965b0228d2621fce4e59f', '60e965b0228d2621fce4e5a0', 'layout_b');
const saved = sanitizeStoresProducts([first]);
assert(saved.ok, '属性オブジェクトを受理する');
if (saved.ok) same(saved.products, [first], '検証済みの属性をそのまま保存する');

assert(!sanitizeStoresProducts([code()]).ok, '貼り付けコード文字列の配列は保存しない');
assert(!sanitizeStoresProducts({ item }).ok, '配列以外は拒否する');
assert(sanitizeStoresProducts(null).ok, '未設定は空配列として扱う');
assert(sanitizeStoresProducts([]).ok, '空配列は保存できる');
assert(!sanitizeStoresProducts([first, { ...first, layout: 'layout_b' }]).ok, '同じ商品とバリエーションは拒否する');
assert(sanitizeStoresProducts([first, second]).ok, 'バリエーションが違えば登録できる');
assert(!sanitizeStoresProducts([first, { ...first, html: '<script>' }]).ok, '未知のフィールドは拒否する');
assert(!sanitizeStoresProducts([{ ...first, name: 'https://evil.example' }]).ok, 'ショップ名にURLは入れられない');

const five = [1, 2, 3, 4, 5].map((n) => product(`60e965b0228d2621fce4e5a${n}`));
assert(sanitizeStoresProducts(five).ok, '5件まで保存できる');
assert(!sanitizeStoresProducts([...five, product('60e965b0228d2621fce4e5b0')]).ok, '6件目は拒否する');

const coerced = coerceStoresProducts([
  first,
  { ...first },
  { name: 'bad name', item, variation, layout: 'layout_c', lang: 'ja' },
  second,
  '<script>alert(1)</script>',
  null,
]);
same(coerced, [first, second], '表示時は壊れた値と重複を落とす');
same(coerceStoresProducts('nope'), [], '配列でない値は表示しない');

const added = addStoresProduct([first], code({ item: second.item, variation: second.variation, layout: 'layout_b' }));
assert(added.ok, '貼り付けコードを追加できる');
if (added.ok) same(added.products, [first, second], '追加は末尾に並ぶ');
assert(!addStoresProduct(five, code({ item: '60e965b0228d2621fce4e5b1', variation: '60e965b0228d2621fce4e5b2' })).ok, '5件から追加できない');

const replaced = replaceStoresProduct([first], 0, code({ item: second.item, variation: second.variation, layout: 'layout_b' }));
assert(replaced.ok, '貼り付けコードで差し替えできる');
if (replaced.ok) same(replaced.products, [second], '差し替え後の属性を保存する');

const moved = moveStoresProduct([first, second], 1, -1);
assert(moved.ok, '順番を変えられる');
if (moved.ok) same(moved.products, [second, first], '後ろの商品を前へ動かす');

const removed = removeStoresProduct([first, second], 0);
assert(removed.ok, '削除できる');
if (removed.ok) same(removed.products, [second], '削除しても残りの順番を維持する');

same(storesProductIndexAfterAdd(0), 0, '最初の商品は商品1を選択する');
same(storesProductIndexAfterAdd(2), 2, '追加した商品のタブを選択する');
same(storesProductIndexAfterMove(2, -1, 5), 1, '前へ移動した商品のタブへ移る');
same(storesProductIndexAfterMove(0, -1, 5), 0, '先頭は前へ移動しない');
same(storesProductIndexAfterDelete(1, 3), 1, '途中を削除したあとは同じ位置を選択する');
same(storesProductIndexAfterDelete(2, 3), 1, '末尾を削除したあとは直前を選択する');
same(storesProductIndexAfterDelete(0, 1), null, '最後の1件を削除したあとは追加フォーム');

if (parsed.ok) same(storesProductPageUrl(parsed.product), `https://shopname.stores.jp/items/${item}`, '商品ページURLは検証済みの値から作る');
same(storesButtonSize(first, false), { width: 200, height: 44 }, 'layout_c は小さいボタン');
same(storesButtonSize(second, false), { width: 340, height: 60 }, 'layout_b は大きいボタン');
same(storesButtonSize(second, true), { width: 200, height: 44 }, '携帯の幅500未満は小さいボタン');
same(storesButtonSize({ ...second, image: 'button_340x60.png' }, true), { width: 340, height: 60 }, '画像サイズをカード幅に使う');
assert(isStoresButtonMobileViewport('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 390), 'iPhoneの狭い画面を携帯とみなす');
assert(!isStoresButtonMobileViewport('Mozilla/5.0 (Windows NT 10.0)', 390), '狭いデスクトップ窓は携帯とみなさない');
assert(!isStoresButtonMobileViewport('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 500), '幅500以上は携帯の縮小対象にしない');

const officialShop = 'https://shopname.stores.jp/';
same(readStoresShopCandidate(' HTTPS://ShopName.stores.jp/?ref=1#top '), officialShop, '公式ショップURLを正規化する');
assert(readStoresShopCandidate('https://shopname.stores.jp/items/1') === null, '商品URLはショップURLにしない');
assert(readStoresShopCandidate('http://shopname.stores.jp/') === null, 'httpのショップURLは拒否する');
assert(readStoresShopCandidate('https://user:pass@shopname.stores.jp/') === null, 'ユーザー情報付きURLは拒否する');
assert(readStoresShopCandidate('https://shop.example/') === null, '独自ドメインのショップURLは拒否する');
assert(readStoresShopCandidate('javascript:alert(1)') === null, 'javascript URLは拒否する');

const description300 = 'あ'.repeat(300);
assert(sanitizeStoresProductsSettings({ description: description300, shopUrl: '' }).ok, '300文字の紹介文を受理する');
assert(!sanitizeStoresProductsSettings({ description: `${description300}う`, shopUrl: '' }).ok, '301文字の紹介文を拒否する');
const htmlText = sanitizeStoresProductsSettings({ description: '<b>紹介</b>', shopUrl: officialShop });
assert(htmlText.ok, '紹介文の記号は実行せず文字として保存する');
if (htmlText.ok) same(htmlText.settings.description, '<b>紹介</b>', '紹介文のHTMLは解釈しない');
assert(coerceStoresProductsSettings(undefined) === undefined, '未設定のショップ設定は無いものとして扱う');
same(
  coerceStoresProductsSettings({ description: '  一行\r\n二行  ', shopUrl: 'https://SHOPNAME.stores.jp/items/1' }),
  { description: '一行\n二行', shopUrl: '' },
  '壊れたショップURLは空にし、紹介文は残す'
);
assert(
  storesShopSectionVisible({ productCount: 0, description: '', shopLink: null }) === false,
  '中身が無ければ公開しない'
);
assert(
  storesShopSectionVisible({ productCount: 1, description: '', shopLink: null }),
  '商品があれば公開する'
);

const before = { name: '花' };
assert(meaningfulProfileChanged(before, { ...before, storesProducts: [first] }), 'STORES商品の追加は更新になる');
assert(
  meaningfulProfileChanged({ ...before, storesProducts: [first] }, { ...before, storesProducts: [] }),
  'STORES商品の削除は更新になる'
);
assert(
  !meaningfulProfileChanged(before, { ...before, storesProducts: [] }),
  '空のSTORES商品は未設定と同じ'
);
assert(
  meaningfulProfileChanged(
    { ...before, storesProductsSettings: { description: '紹介', shopUrl: '' } },
    { ...before, storesProductsSettings: { description: '紹介', shopUrl: officialShop } }
  ),
  'ショップURLの追加は更新になる'
);

assert(!DEFAULT_SECTION_ORDER.includes('StoresProducts'), '既定の並びには入れない');
assert(!resolveSectionOrder(undefined, undefined).includes('StoresProducts'), '旧形式の表示順には出ない');
same(BLOCK_LABELS.StoresProducts, 'STORES商品', '追加画面のラベルはSTORES商品');
const placed = editBlockPlacement(
  { blockLayoutVersion: 1, sectionOrder: ['YouTube'] },
  { op: 'add', block: 'StoresProducts' }
);
same(placed?.sectionOrder, ['YouTube', 'StoresProducts'], 'SHOPのSTORES商品を追加できる');

const component = readFileSync(join(root, 'app/components/StoresProductsBlock.tsx'), 'utf8');
const runtime = readFileSync(join(root, 'app/lib/storesButtonRuntime.ts'), 'utf8');
const css = readFileSync(join(root, 'app/components/StoresProductsBlock.module.css'), 'utf8');
const userRoute = readFileSync(join(root, 'app/api/user/[uid]/route.ts'), 'utf8');
const baseComponent = readFileSync(join(root, 'app/components/BaseProductsBlock.tsx'), 'utf8');
assert(component.includes('<ShopDescription'), '公開紹介文は共通コンポーネント');
assert(component.includes('SHOP_DESCRIPTION_HINT'), '編集画面は300文字とmoreを案内する');
assert(component.includes('>STORES SHOP<'), '公開見出しはSTORES SHOP');
assert(component.includes('ショップを見る'), 'ショップURLのボタンを出す');
assert(!component.includes('dangerouslySetInnerHTML'), '貼り付けHTMLを直接描画しない');
assert(!component.includes('innerHTML'), 'innerHTMLでボタンを作らない');
assert(!component.includes('<iframe'), '公式スクリプト以外のiframeを置かない');
assert(!runtime.includes('dangerouslySetInnerHTML') && !runtime.includes('innerHTML'), 'ランタイムもHTML文字列を描画しない');
assert(runtime.includes('script.src = STORES_BUTTON_SCRIPT_URL'), 'スクリプトURLは定数だけを使う');
assert(!runtime.includes('script.src = "') && !runtime.includes("script.src = '"), 'スクリプトURLを文字列で直書きしない');
assert(STORES_BUTTON_SCRIPT_URL === 'https://btn.stores.jp/button.js', 'スクリプトURLは公式のbutton.js');
assert(css.includes('overflow-x: auto'), '枠の中だけ横にスクロールする');
assert(css.includes('scroll-snap-type: x mandatory'), '横スクロールはスナップする');
assert(css.includes('justify-content: center'), '1件は中央に置く');
assert(css.includes('display: none') && css.includes('display: grid'), '前後ボタンはPC幅だけで出す');
assert(css.includes('background: #2563eb'), 'ショップボタンはBASEと同じ青');
assert(userRoute.includes('sanitizeStoresProducts'), '保存APIでSTORES商品を検証する');
assert(userRoute.includes('storesProducts: storesProductsForSave'), '空配列も含めてstoresProductsを保存する');
assert(!baseComponent.includes('storesProducts') && !baseComponent.includes('btn.stores.jp'), 'BASE商品ブロックは変えない');

console.log('stores-products-check ok');
