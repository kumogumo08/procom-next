/**
 * 商品ギャラリーの純関数検査。Firestore には接続しない。
 * 実行: npx tsx scripts/product-gallery-check.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { BLOCK_ADD_CATEGORIES } from '@/lib/blockAddCategories';
import {
  BLOCK_LAYOUT_VERSION,
  DEFAULT_SECTION_ORDER,
  editBlockPlacement,
  resolveSectionOrder,
} from '@/lib/blockLayout';
import { meaningfulProfileChanged } from '@/lib/profileContent';
import {
  coerceProductGallery,
  inspectProductImage,
  isSafeProductGalleryObject,
  isSafeProductUrl,
  MAX_PRODUCT_GALLERY_ITEMS,
  moveProductGalleryItem,
  PRODUCT_IMAGE_MAX_BYTES,
  productScrollIndicator,
  productTabAfterDelete,
  removedProductImagePaths,
  sanitizeProductGallery,
  sanitizeProductGallerySettings,
  shopDescriptionLength,
  shopDescriptionOverflows,
  shopIntroVisible,
  SHOP_DESCRIPTION_HINT,
  isSafeShopUrl,
  type ProductGalleryItem,
} from '@/lib/productGallery';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function same(actual: unknown, expected: unknown, message: string): void {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

const UID = 'owner_uid';
const OTHER = 'other_uid';
const BUCKET = 'procom-fea80.firebasestorage.app';
const FILE_A = '11111111-1111-4111-8111-111111111111';
const FILE_B = '22222222-2222-4222-8222-222222222222';
const TOKEN = '33333333-3333-4333-8333-333333333333';

function imageUrl(uid: string, file = FILE_A, bucket = BUCKET): string {
  const objectPath = `product-gallery/${uid}/${file}.jpg`;
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media&token=${TOKEN}`;
}

function item(patch: Partial<ProductGalleryItem> & { name: string }): ProductGalleryItem {
  return {
    id: patch.id ?? 'item_1',
    name: patch.name,
    productUrl: patch.productUrl ?? 'https://shop.example/item',
    imageUrl: patch.imageUrl ?? imageUrl(UID),
    displayOrder: patch.displayOrder ?? 0,
    ...(patch.price ? { price: patch.price } : {}),
  };
}

const saved = sanitizeProductGallery([item({ name: '紅茶' })], UID, BUCKET);
assert(saved.ok, '1件を保存できる');
if (!saved.ok) throw new Error('unreachable');
same(saved.items[0]?.name, '紅茶', '商品名を残す');
same(saved.items[0]?.price, undefined, '空の価格は保存しない');
assert(saved.items[0]?.productUrl === 'https://shop.example/item', 'https URLを残す');

const edited = sanitizeProductGallery(
  [{ ...saved.items[0], name: '紅茶セット', price: '1200円' }],
  UID,
  BUCKET
);
assert(edited.ok && edited.items[0]?.name === '紅茶セット' && edited.items[0]?.price === '1200円', '商品名と価格を更新できる');

const priced = item({ id: 'keep', name: 'マグカップ', price: '800' });
const second = item({
  id: 'next',
  name: 'コースター',
  imageUrl: imageUrl(UID, FILE_B),
  productUrl: 'https://shop.example/coaster',
});
const added = sanitizeProductGallery([priced, second], UID, BUCKET);
assert(added.ok && added.items.length === 2, '商品を追加できる');
if (!added.ok) throw new Error('unreachable');
const moved = moveProductGalleryItem(added.items, 'keep', 1);
same(moved.map((entry) => entry.id), ['next', 'keep'], '順序を後ろへ動かせる');
same(moved.map((entry) => entry.displayOrder), [0, 1], '移動後の表示順を振り直す');

const removed = sanitizeProductGallery(
  added.items.filter((entry) => entry.id !== 'next'),
  UID,
  BUCKET
);
assert(removed.ok && removed.items.length === 1, '商品を削除できる');
same(
  removedProductImagePaths(added.items, removed.ok ? removed.items : [], UID, BUCKET),
  [`product-gallery/${UID}/${FILE_B}.jpg`],
  '外した本人の商品画像だけを削除対象にする'
);
same(
  removedProductImagePaths(added.items, added.items, UID, BUCKET),
  [],
  '参照中の画像は削除しない'
);

const foreign = [
  item({ name: '他人の商品', imageUrl: imageUrl(OTHER) }),
  { name: 'プロフィール写真', productUrl: 'https://shop.example/x', imageUrl: `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(`photos/${UID}/${FILE_A}.jpg`)}?alt=media&token=${TOKEN}` },
  { name: '公開バナー', productUrl: 'https://shop.example/x', imageUrl: `https://storage.googleapis.com/${BUCKET}/banners/${UID}/${FILE_A}.jpg` },
];
same(removedProductImagePaths(foreign, [], UID, BUCKET), [], '他人の領域と他フォルダは削除しない');
assert(!isSafeProductGalleryObject(UID, `photos/${UID}/${FILE_A}.jpg`), 'プロフィール写真のパスは商品画像にしない');
assert(!isSafeProductGalleryObject(UID, `product-gallery/${OTHER}/${FILE_A}.jpg`), '他人の商品画像パスを拒否する');
assert(
  !isSafeProductGalleryObject(UID, `product-gallery/${UID}/../photos/${FILE_A}.jpg`),
  '親ディレクトリへの移動を拒否する'
);

const six = Array.from({ length: MAX_PRODUCT_GALLERY_ITEMS + 1 }, (_, index) =>
  item({ id: `item_${index}`, name: `商品${index}`, imageUrl: imageUrl(UID, FILE_A) })
);
const tooMany = sanitizeProductGallery(six, UID, BUCKET);
assert(!tooMany.ok && tooMany.error === '商品は最大5件までです', '6件目は保存しない');

const five = sanitizeProductGallery(six.slice(0, 5), UID, BUCKET);
assert(five.ok && five.items.length === 5, '5件まで保存できる');

for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'http://shop.example/item', 'https://user:pass@shop.example/item']) {
  assert(!isSafeProductUrl(url), `危険または非httpsのURLを拒否する: ${url}`);
  const rejected = sanitizeProductGallery([item({ name: '商品', productUrl: url })], UID, BUCKET);
  assert(!rejected.ok, `サーバー検証でURLを拒否する: ${url}`);
}
assert(isSafeProductUrl('https://shop.example/item'), 'httpsの商品URLは通す');

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
assert(inspectProductImage('image/jpeg', jpeg).ok, 'JPEGを通す');
assert(inspectProductImage('image/png', png).ok, 'PNGを通す');
assert(!inspectProductImage('image/jpeg', png).ok, '拡張子と中身の不一致を拒否する');
assert(!inspectProductImage('image/gif', jpeg).ok, 'GIFを拒否する');
assert(!inspectProductImage('image/jpeg', new Uint8Array(PRODUCT_IMAGE_MAX_BYTES + 1)).ok, '3MBを超える画像を拒否する');
assert(!inspectProductImage('image/jpeg', new Uint8Array()).ok, '空のファイルを拒否する');

const shop = BLOCK_ADD_CATEGORIES.find((category) => category.id === 'shop');
same(shop?.label, 'SHOP', 'カテゴリ名はSHOP');
same(shop?.description, '商品の紹介と購入', 'カテゴリ説明を保持する');
same(
  [...(shop?.blocks ?? [])],
  ['ProductGallery', 'BaseProducts'],
  'SHOPは商品ギャラリーとBASE商品。STORESとShopifyは出さない'
);
assert(BLOCK_LAYOUT_VERSION === 1, 'blockLayoutVersionは1のまま');
assert(!DEFAULT_SECTION_ORDER.includes('ProductGallery'), '既存の既定順に商品ギャラリーを足さない');
assert(!resolveSectionOrder(undefined, undefined).includes('ProductGallery'), '旧形式の表示順は変わらない');
const placed = editBlockPlacement(
  { blockLayoutVersion: 1, sectionOrder: ['YouTube'] },
  { op: 'add', block: 'ProductGallery' }
);
assert(placed?.blockLayoutVersion === 1, '追加してもversion 1');
same(placed?.sectionOrder, ['YouTube', 'ProductGallery'], '既存ブロックの後ろへ追加できる');
same(
  editBlockPlacement(placed ?? undefined, { op: 'add', block: 'ProductGallery' })?.sectionOrder,
  ['YouTube', 'ProductGallery'],
  '商品ギャラリーは1個まで'
);

const before = { name: '花', productGallery: [{ name: '紅茶', productUrl: 'https://shop.example/tea' }] };
assert(meaningfulProfileChanged(before, { ...before, productGallery: [] }), '商品の削除は更新になる');
assert(
  meaningfulProfileChanged(before, {
    ...before,
    productGallery: [{ name: '紅茶', productUrl: 'https://shop.example/tea', price: '500' }],
  }),
  '価格の追加は更新になる'
);
assert(
  !meaningfulProfileChanged(before, {
    ...before,
    settings: { sectionOrder: ['ProductGallery'], blockLayoutVersion: 1 },
  }),
  '並びだけの変更は商品更新にしない'
);

const coerced = coerceProductGallery(
  [item({ name: '有効' }), { name: '無効', productUrl: 'javascript:alert(1)', imageUrl: imageUrl(UID) }],
  UID,
  BUCKET
);
same(coerced.map((entry) => entry.name), ['有効'], '表示時は危険なURLの商品を出さない');

const root = process.cwd();
const component = readFileSync(join(root, 'app/components/ProductGalleryBlock.tsx'), 'utf8');
const css = readFileSync(join(root, 'app/components/ProductGalleryBlock.module.css'), 'utf8');
const route = readFileSync(join(root, 'app/api/product-gallery/image/route.ts'), 'utf8');
const userRoute = readFileSync(join(root, 'app/api/user/[uid]/route.ts'), 'utf8');
const deletion = readFileSync(join(root, 'app/lib/accountDeletion.ts'), 'utf8');
assert(component.includes('他社の商品画像を無断で登録しないでください'), '第三者画像の注意を出す');
assert(component.includes('>SHOP<'), '公開見出しはSHOP');
assert(component.includes('ショップを見る'), 'ショップURLのボタンを出す');
const descriptionAt = component.indexOf('styles.description');
const fieldsAt = component.indexOf('styles.shopFields');
const sliderAt = component.indexOf('styles.preview');
const editorAt = component.indexOf('styles.editor');
const buttonAt = component.indexOf('styles.shopButton');
assert(descriptionAt > 0 && fieldsAt > descriptionAt && fieldsAt < sliderAt, '紹介文の編集欄は商品スライダーより上');
assert(sliderAt < editorAt && editorAt < buttonAt, '商品管理のあとでショップボタンを出す');
assert(component.includes('!isEditable && trimmedDescription'), '編集中は公開文と入力欄を重ねない');
const descriptionCss = css.slice(css.indexOf('.description {'), css.indexOf('.shopButtonWrap'));
assert(descriptionCss.includes('grid-column: 2'), '紹介文は商品列に置く');
const shopDescriptionCss = readFileSync(join(root, 'app/components/ShopDescription.module.css'), 'utf8');
const shopDescription = readFileSync(join(root, 'app/components/ShopDescription.tsx'), 'utf8');
assert(
  shopDescriptionCss.includes('font-size: 15px') &&
    shopDescriptionCss.includes('font-weight: 400') &&
    shopDescriptionCss.includes('line-height: 1.75') &&
    shopDescriptionCss.includes('background: #f8fafc') &&
    shopDescriptionCss.includes('border-radius: 12px') &&
    shopDescriptionCss.includes('padding: 16px') &&
    shopDescriptionCss.includes('text-align: left') &&
    shopDescriptionCss.includes('margin: 0 0 16px') &&
    shopDescriptionCss.includes('border: none') &&
    shopDescriptionCss.includes('box-shadow: none') &&
    shopDescriptionCss.includes('color: #0f172a') &&
    shopDescriptionCss.includes('max-height: calc(1.75em * 3)') &&
    shopDescriptionCss.includes('overflow: hidden') &&
    shopDescriptionCss.includes('white-space: pre-wrap') &&
    !shopDescriptionCss.includes('-webkit-line-clamp'),
  '紹介文は淡い背景のカードで、15px、太さ400、行間1.75、初期は3行'
);
assert(component.includes('SHOP_DESCRIPTION_HINT'), '編集画面の説明を共通の文面にする');
assert(SHOP_DESCRIPTION_HINT.includes('最大300文字'), '編集画面は300文字とmoreを案内する');
assert(component.includes('<ShopDescription'), '公開紹介文は共通コンポーネント');
assert(shopDescription.includes("expanded ? 'close' : 'more'"), '開閉の表示は more と close');
assert(shopDescription.includes('aria-expanded={expanded}'), '開閉状態を伝える');
assert(shopDescription.includes('type="button"'), 'more は button');
assert(shopDescription.includes('ResizeObserver'), '幅が変わったら行数を測り直す');
assert(shopDescription.includes('useLayoutEffect'), '初回描画の前に行数を測る');
assert(shopDescription.includes('styles.textClamped'), '閉じている間は3行に収める');
assert(!shopDescription.includes('dangerouslySetInnerHTML'), '紹介文をHTMLとして解釈しない');
assert(component.includes('shopIntroVisible'), '商品0件でも紹介があれば表示を判断する');
assert(userRoute.includes('sanitizeProductGallerySettings'), '紹介文とショップURLをサーバーで検証する');
assert(
  userRoute.includes("sanitizedSettings.settings ?? { description: '', shopUrl: '' }"),
  '空の紹介文を保存すると古い紹介文を残さない'
);
assert(!component.includes('dangerouslySetInnerHTML'), '商品データからHTMLを実行しない');
assert(component.includes('aria-label="前の商品"') && component.includes('aria-label="次の商品"'), '矢印で移動できる');
assert(css.includes('overflow-x: auto') && css.includes('scroll-snap-type: x mandatory'), '横スライドとスワイプ用のスクロールを持つ');
assert(component.includes('順番を前に') && component.includes('順番を後ろに'), '順序ボタンの文言');
assert(component.includes('＋商品を追加'), '商品追加ボタン');
assert(component.includes('画像を選択'), '画像選択ボタン');
assert(component.includes('role="tablist"') && component.includes('role="tab"'), '商品をタブで選ぶ');
assert(component.includes('番目 /'), '表示順を出す');
assert(!component.includes('styles.dots'), 'ドット型インジケーターを出さない');
assert(component.includes('visuallyHidden'), 'ファイル選択を画面に出さない');
assert(css.includes('border: 2px dashed #cbd5e1'), '点線の画像枠を持つ');
assert(
  !css.includes('.scrollTrack') &&
    !css.includes('scrollbar-width: none') &&
    css.includes('scrollbar-width: thin') &&
    css.includes('.scroller::-webkit-scrollbar'),
  '横スクロールは操作できるバーにする'
);
const shopButtonCss = css.slice(css.indexOf('.shopButton {'), css.indexOf('.shopFields'));
assert(
  css.includes('grid-column: 2') &&
    shopButtonCss.includes('width: 100%') &&
    shopButtonCss.includes('box-sizing: border-box') &&
    !shopButtonCss.includes('240px'),
  'ショップボタンは商品一覧の表示幅にそろえる'
);
same(productTabAfterDelete(['a', 'b', 'c'], 'b', 'b'), 'c', '削除した位置の次の商品を選ぶ');
same(productTabAfterDelete(['a', 'b', 'c'], 'c', 'c'), 'b', '末尾の削除では1つ前を選ぶ');
same(productTabAfterDelete(['a', 'b', 'c'], 'b', 'a'), 'a', '見ていない商品を消しても選択を維持する');
same(productTabAfterDelete(['a'], 'a', 'a'), null, '最後の1件を削除したら選択を外す');
const scrollStart = productScrollIndicator(0, 1000, 250);
assert(scrollStart?.offset === 0 && scrollStart.width === 25, '先頭ではバーが左端');
const scrollEnd = productScrollIndicator(750, 1000, 250);
assert(scrollEnd !== null && Math.abs(scrollEnd.offset + scrollEnd.width - 100) < 0.001, '末尾ではバーが右端');
assert(productScrollIndicator(0, 200, 200) === null, 'スクロール不要ならバーを出さない');

const intro = '一行目\n二行目';
const introSaved = sanitizeProductGallerySettings({ description: intro, shopUrl: '' });
assert(introSaved.ok && introSaved.settings?.description === intro, '紹介文の改行を残す');
assert(sanitizeProductGallerySettings({ description: '', shopUrl: 'https://shop.example/item' }).ok, '紹介文0文字でもURLがあれば保存できる');
assert(sanitizeProductGallerySettings({ description: 'あ'.repeat(150), shopUrl: '' }).ok, '既存の150文字紹介文は保存できる');
const maxIntro = `${'あ'.repeat(298)}\n😀`;
assert(shopDescriptionLength(maxIntro) === 300, '日本語、改行、絵文字を合わせて300文字');
assert(sanitizeProductGallerySettings({ description: maxIntro, shopUrl: '' }).ok, '紹介文300文字は保存できる');
const overIntro = sanitizeProductGallerySettings({ description: `${maxIntro}あ`, shopUrl: '' });
assert(!overIntro.ok, '紹介文301文字は拒否する');
const lineHeight = 26.25;
assert(!shopDescriptionOverflows(lineHeight * 3, lineHeight), '実測が3行ちょうどなら more を出さない');
assert(shopDescriptionOverflows(lineHeight * 4, lineHeight), '実測が4行なら more を出す');
assert(!shopDescriptionOverflows(lineHeight * 2, lineHeight), '広い画面で2行なら more を出さない');
assert(shopDescriptionOverflows(lineHeight * 5, lineHeight), '狭い画面で5行なら more を出す');
assert(!shopDescriptionOverflows(lineHeight * 3, Number.NaN), '行の高さが測れないときは more を出さない');
const missingSettings = sanitizeProductGallerySettings(null);
assert(missingSettings.ok && missingSettings.settings === undefined, '未設定のショップ紹介はフィールドを作らない');
const blankSettings = sanitizeProductGallerySettings({ description: '  ', shopUrl: '   ' });
assert(blankSettings.ok && blankSettings.settings === undefined, '空の紹介文とURLは保存しない');
assert(isSafeShopUrl('https://shop.example/item'), 'ショップURLはhttpsを許可する');
assert(isSafeShopUrl('https://shop.example:443/item'), 'ショップURLの443番は許可する');
assert(!isSafeShopUrl('http://shop.example/item'), 'ショップURLのhttpを拒否する');
assert(!isSafeShopUrl('javascript:alert(1)'), 'ショップURLのjavascriptを拒否する');
assert(!isSafeShopUrl('data:text/html,hi'), 'ショップURLのdataを拒否する');
assert(!isSafeShopUrl('https://user:pass@shop.example/item'), 'ショップURLのユーザー情報を拒否する');
assert(!isSafeShopUrl('https://shop.example:8443/item'), 'ショップURLの不正なポートを拒否する');
const withShop = sanitizeProductGallerySettings({ description: '紅茶店', shopUrl: 'https://shop.example/item' });
assert(withShop.ok && withShop.settings?.shopUrl === 'https://shop.example/item', 'ショップURLを保存できる');
assert(!sanitizeProductGallerySettings({ description: '', shopUrl: 'javascript:alert(1)' }).ok, '危険なショップURLは保存しない');
assert(!shopIntroVisible(undefined), '紹介もURLも無いときはショップ紹介を出さない');
assert(shopIntroVisible({ description: '紅茶店', shopUrl: '' }), '商品が無くても紹介文があれば出す');
assert(shopIntroVisible({ description: '', shopUrl: 'https://shop.example/item' }), '商品が無くてもショップURLがあれば出す');
assert(!shopIntroVisible({ description: '', shopUrl: 'javascript:alert(1)' }), '危険なURLだけではショップ紹介を出さない');
assert(
  meaningfulProfileChanged(before, { ...before, productGallerySettings: { description: '紅茶店', shopUrl: '' } }),
  '紹介文の追加は更新になる'
);
assert(
  meaningfulProfileChanged(
    { ...before, productGallerySettings: { description: '紅茶店', shopUrl: '' } },
    { ...before, productGallerySettings: { description: '紅茶店', shopUrl: 'https://shop.example/item' } }
  ),
  'ショップURLの変更は更新になる'
);
assert(
  meaningfulProfileChanged(
    { ...before, productGallerySettings: { description: '一行', shopUrl: '' } },
    { ...before, productGallerySettings: { description: '一行\n二行', shopUrl: '' } }
  ),
  '紹介文の改行は更新になる'
);
assert(
  !meaningfulProfileChanged(before, { ...before, productGallerySettings: { description: '', shopUrl: '' } }),
  '空のショップ設定は未設定と同じ'
);
assert(
  !meaningfulProfileChanged(
    { ...before, productGallerySettings: { description: '紅茶店', shopUrl: 'https://shop.example/item' } },
    {
      ...before,
      productGallerySettings: { description: '紅茶店', shopUrl: 'https://shop.example/item' },
      settings: { sectionOrder: ['ProductGallery'], blockLayoutVersion: 1 },
    }
  ),
  '並びだけの変更はショップ紹介の更新にしない'
);
assert(route.includes('inspectProductImage'), 'アップロード時に形式を検証する');
assert(route.includes('PRODUCT_IMAGE_MAX_BYTES'), 'アップロード時に容量を検証する');
assert(!route.includes('public: true'), '商品画像を無条件で公開配信しない');
assert(deletion.includes("'product-gallery'"), '退会時に商品画像も削除する');

console.log('product-gallery-check: ok');
