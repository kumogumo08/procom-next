/**
 * BASE商品の純関数検査。Firestore には接続しない。
 * 実行: npx tsx scripts/base-products-check.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  addBaseProduct,
  baseProductIndexAfterAdd,
  baseProductIndexAfterDelete,
  baseProductIndexAfterMove,
  baseProductPageUrl,
  baseWidgetUrl,
  coerceBaseProducts,
  moveBaseProduct,
  removeBaseProduct,
  replaceBaseProduct,
  baseShopSectionVisible,
  coerceBaseProductsSettings,
  readBaseShopCandidate,
  sanitizeBaseProducts,
  sanitizeBaseProductsSettings,
  shopDescriptionLength,
  shopDescriptionOverflows,
  trustedBaseShopUrl,
  trustedWidgetUrl,
} from '@/lib/baseProducts';
import {
  BASE_DNS_FAIL_CACHE_MS,
  BASE_DNS_MAX_IN_FLIGHT,
  BASE_DNS_OK_CACHE_MS,
  clearBaseProductDnsCache,
  cnameTargetMatchesBase,
  confirmBaseProductsForSave,
  confirmBaseShopUrlForSave,
  resolveVerifiedBaseProducts,
  resolveVerifiedBaseShopUrl,
  verifyBaseCustomHost,
} from '@/lib/baseProductDns';
import {
  BLOCK_LABELS,
  DEFAULT_SECTION_ORDER,
  editBlockPlacement,
  resolveSectionOrder,
} from '@/lib/blockLayout';
import { meaningfulProfileChanged } from '@/lib/profileContent';

const root = process.cwd();
const productUrl = 'https://shopname.thebase.in/items/12345678';
const widgetUrl = 'https://shopname.thebase.in/items/12345678/widget';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function same(actual: unknown, expected: unknown, message: string): void {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}\n${JSON.stringify(actual)}`);
}

const saved = sanitizeBaseProducts([productUrl]);
assert(saved.ok, '商品URLを受理する');
if (saved.ok) same(saved.urls, [productUrl], '商品URLを正規化して保存する');

const fromWidget = sanitizeBaseProducts([widgetUrl]);
assert(fromWidget.ok, '/widget形式を受理する');
if (fromWidget.ok) same(fromWidget.urls, [productUrl], 'ウィジェットURLは商品ページURLとして保存する');

const normalized = sanitizeBaseProducts(['  HTTPS://ShopName.thebase.in/items/12345678/?ref=1#top  ']);
assert(normalized.ok, '大文字ホスト、クエリ、フラグメント、末尾スラッシュを受理する');
if (normalized.ok) {
  same(normalized.urls, [productUrl], 'ホストを小文字にし、クエリと末尾スラッシュを除く');
}

const port443 = sanitizeBaseProducts(['https://shopname.thebase.in:443/items/12345678/widget/']);
assert(port443.ok, '443番は受理する');
if (port443.ok) same(port443.urls, [productUrl], '443番は保存URLから除く');

for (const url of [
  'http://shopname.thebase.in/items/12345678',
  'javascript:alert(1)',
  'data:text/html,hi',
  'https://user:pass@shopname.thebase.in/items/12345678',
  'https://shopname.thebase.in:8443/items/12345678',
  'https://localhost/items/12345678',
  'https://127.0.0.1/items/12345678',
  'https://[::1]/items/12345678',
  'https://thebase.in/items/12345678',
  'https://a.b.thebase.in/items/12345678',
  'https://shop.localhost/items/12345678',
  'https://printer.local/items/12345678',
  'https://shop/items/12345678',
  'https://10.1.2.3/items/12345678',
  'https://shopname.thebase.in/items/abc',
  'https://shopname.thebase.in/items/12345678/extra',
  'https://shopname.thebase.in/items/12345678/widget/extra',
  'https://shopname.thebase.in/ITEMS/12345678',
]) {
  const rejected = sanitizeBaseProducts([url]);
  assert(!rejected.ok, `許可しないURLを拒否する: ${url}`);
}

const cleared = sanitizeBaseProducts([]);
assert(cleared.ok && cleared.urls.length === 0, '空配列を保存できる');
const blanks = sanitizeBaseProducts(['', '   ', null]);
assert(blanks.ok && blanks.urls.length === 0, '空欄だけでは空配列になる');
assert(sanitizeBaseProducts(null).ok, '未設定は空配列として扱う');
assert(!sanitizeBaseProducts({ url: productUrl }).ok, '配列以外は拒否する');
assert(!sanitizeBaseProducts([productUrl, widgetUrl]).ok, '正規化後の重複URLを拒否する');
assert(!sanitizeBaseProducts([1]).ok, '文字列以外は拒否する');
const five = [1, 2, 3, 4, 5].map((id) => `https://shopname.thebase.in/items/${id}`);
const fiveSaved = sanitizeBaseProducts(five);
assert(fiveSaved.ok, '5件まで保存できる');
if (fiveSaved.ok) same(fiveSaved.urls, five, '5件の順番を維持する');
assert(!sanitizeBaseProducts([...five, 'https://shopname.thebase.in/items/6']).ok, '6件以上は拒否する');

const coerced = coerceBaseProducts([
  'javascript:alert(1)',
  'https://shopname.thebase.in/items/12345678/widget?x=1',
  productUrl.replace('12345678', '99'),
]);
same(
  coerced,
  [productUrl, productUrl.replace('12345678', '99')],
  '表示時は壊れた値を飛ばし、有効な順番を残す'
);
same(coerceBaseProducts('https://shopname.thebase.in/items/1'), [], '配列でない値は表示しない');

const registered = addBaseProduct([], productUrl);
assert(registered.ok, '登録できる');
if (!registered.ok) throw new Error('登録できる');
const second = addBaseProduct(registered.urls, 'https://other.thebase.in/items/99/widget');
assert(second.ok, '2件目を追加できる');
if (second.ok) {
  same(second.urls, [productUrl, 'https://other.thebase.in/items/99'], '追加は末尾に並ぶ');
}
const changed = replaceBaseProduct(registered.urls, 0, 'https://other.thebase.in/items/99/widget');
assert(changed.ok, '変更できる');
if (changed.ok) same(changed.urls, ['https://other.thebase.in/items/99'], '変更後の商品URLを保存する');
const moved = moveBaseProduct(
  [productUrl, 'https://other.thebase.in/items/99'],
  1,
  -1
);
assert(moved.ok, '並べ替えできる');
if (moved.ok) {
  same(moved.urls, ['https://other.thebase.in/items/99', productUrl], '後ろの商品を前へ動かす');
}
const edge = moveBaseProduct([productUrl], 0, -1);
assert(edge.ok && edge.urls[0] === productUrl, '端の並べ替えは順番を変えない');
const removed = removeBaseProduct([productUrl, 'https://other.thebase.in/items/99'], 0);
assert(removed.ok, '個別に削除できる');
if (removed.ok) same(removed.urls, ['https://other.thebase.in/items/99'], '削除しても残りの順番を維持する');
assert(!addBaseProduct([], '   ').ok, '空入力は登録しない');
assert(!addBaseProduct(five, 'https://shopname.thebase.in/items/6').ok, '5件の状態から追加できない');
same(baseProductIndexAfterAdd(0), 0, '最初の商品は商品1を選択する');
same(baseProductIndexAfterAdd(2), 2, '追加した商品のタブを選択する');
same(baseProductIndexAfterMove(2, -1, 5), 1, '前へ移動した商品のタブへ移る');
same(baseProductIndexAfterMove(0, -1, 5), 0, '先頭は前へ移動しない');
same(baseProductIndexAfterMove(4, 1, 5), 4, '末尾は後ろへ移動しない');
same(baseProductIndexAfterDelete(1, 3), 1, '途中を削除したあとは同じ位置を選択する');
same(baseProductIndexAfterDelete(2, 3), 1, '末尾を削除したあとは直前を選択する');
same(baseProductIndexAfterDelete(0, 1), null, '最後の1件を削除したあとは追加フォーム');

const customInput = '  HTTPS://Shop.Example/items/165548212/widget?ref=1#top  ';
const customUrl = 'https://shop.example/items/165548212';
const customSaved = sanitizeBaseProducts([customInput]);
assert(customSaved.ok, '独自ドメインの形式は受理する');
if (customSaved.ok) same(customSaved.urls, [customUrl], '独自ドメインも商品ページURLとして保存する');
same(coerceBaseProducts([customInput]), [customUrl], '構造検証は独自ドメインを残す');
assert(baseWidgetUrl(customUrl) === null, 'DNS前の独自ドメインからはウィジェットを作らない');
for (const lookalike of [
  'https://evil.thebase.in.example.com/items/12345678',
  'https://shopname.thebase.in.evil.example/items/12345678',
]) {
  const parsed = sanitizeBaseProducts([lookalike]);
  assert(parsed.ok, `thebase.in を含んでも公式ホストでなければ形式だけは通す: ${lookalike}`);
  assert(baseWidgetUrl(lookalike) === null, `公式ウィジェットにはしない: ${lookalike}`);
}
same(baseProductPageUrl(customUrl), customUrl, '独自ドメインの商品ページURLは形式から作る');

same(baseProductPageUrl(registered.urls[0]), productUrl, '商品ページURLを生成する');
same(baseWidgetUrl(registered.urls[0]), widgetUrl, 'ウィジェットURLを生成する');
assert(baseWidgetUrl('https://evil.example/items/1') === null, '未検証URLからはウィジェットを作らない');
assert(trustedWidgetUrl(customUrl, null) === null, 'サーバー確認のない独自ドメインはiframeにしない');
assert(
  trustedWidgetUrl(customUrl, {
    productUrl: customUrl,
    widgetUrl: 'https://evil.example/items/165548212/widget',
  }) === null,
  '別ホストのウィジェットURLは受け付けない'
);
same(
  trustedWidgetUrl(customUrl, { productUrl: customUrl, widgetUrl: `${customUrl}/widget` }),
  `${customUrl}/widget`,
  'サーバーが返した独自ドメインの組だけiframeにする'
);
same(trustedWidgetUrl(productUrl, null), widgetUrl, '公式ショップは確認オブジェクトなしで表示する');
assert(baseProductPageUrl(widgetUrl) === productUrl, 'ウィジェットURLから商品ページURLを戻せる');

const officialShop = 'https://shopname.thebase.in/';
const customShop = 'https://shop.example/';
same(readBaseShopCandidate(' HTTPS://ShopName.thebase.in/?ref=1#top ')?.shopUrl, officialShop, '公式ショップURLのホストを正規化する');
same(readBaseShopCandidate('https://shop.riyadvintage.tokyo/')?.shopUrl, 'https://shop.riyadvintage.tokyo/', '独自ドメインのショップURLを受理する');
assert(readBaseShopCandidate('https://shopname.thebase.in/items/12345678') === null, '商品URLはショップURLにしない');
assert(readBaseShopCandidate('https://shop.example/about') === null, 'トップページ以外のパスは拒否する');
assert(readBaseShopCandidate('http://shopname.thebase.in/') === null, 'httpのショップURLは拒否する');
assert(readBaseShopCandidate('javascript:alert(1)') === null, '危険なスキームは拒否する');
assert(readBaseShopCandidate('https://user:pass@shopname.thebase.in/') === null, 'ユーザー情報付きURLは拒否する');
assert(readBaseShopCandidate('https://127.0.0.1/') === null, 'IPアドレスは拒否する');
assert(readBaseShopCandidate('https://localhost/') === null, 'localhostは拒否する');
assert(readBaseShopCandidate(productUrl) === null, '商品ページはショップURLとして拒否する');

const description150 = `${'あ'.repeat(148)}\nい`;
const withinLegacy = sanitizeBaseProductsSettings({ description: description150, shopUrl: '' });
assert(withinLegacy.ok, '既存の150文字紹介文は保存できる');
if (withinLegacy.ok) same(withinLegacy.settings.description, description150, '改行を含めて150文字を保持する');
const description300 = `${'あ'.repeat(298)}\n😀`;
assert(shopDescriptionLength(description300) === 300, '日本語、改行、絵文字を合わせて300文字');
const withinLimit = sanitizeBaseProductsSettings({ description: description300, shopUrl: '' });
assert(withinLimit.ok, '300文字の紹介文を保存できる');
if (withinLimit.ok) same(withinLimit.settings.description, description300, '300文字をそのまま保存する');
const tooLong = sanitizeBaseProductsSettings({ description: `${description300}う`, shopUrl: '' });
assert(!tooLong.ok, '301文字以上の紹介文は拒否する');
assert(shopDescriptionLength('') === 0, '空の紹介文は0文字');
const lineHeight = 26.25;
assert(!shopDescriptionOverflows(lineHeight * 3, lineHeight), 'BASEでも3行ちょうどは more を出さない');
assert(shopDescriptionOverflows(lineHeight * 4, lineHeight), 'BASEでも4行は more を出す');
same(shopDescriptionLength('😀'), 1, '絵文字は1文字として数える');
same(shopDescriptionLength('a\nb'), 3, '改行は1文字として数える');
const crlf = sanitizeBaseProductsSettings({ description: 'a\r\nb', shopUrl: '' });
assert(crlf.ok, 'CRLFの紹介文を受理する');
if (crlf.ok) same(crlf.settings.description, 'a\nb', 'CRLFは改行1文字に揃える');
const htmlText = sanitizeBaseProductsSettings({ description: '<b>紹介</b>', shopUrl: officialShop });
assert(htmlText.ok, 'HTMLに見える紹介文も文字列として受理する');
if (htmlText.ok) same(htmlText.settings.description, '<b>紹介</b>', '紹介文のタグは文字列のまま保存する');
const clearedShop = sanitizeBaseProductsSettings({ description: '', shopUrl: '' });
assert(clearedShop.ok && clearedShop.settings.description === '' && clearedShop.settings.shopUrl === '', '空のショップ設定も明示して残す');
assert(coerceBaseProductsSettings(undefined) === undefined, '未設定の旧プロフィールはショップ設定なし');
same(
  coerceBaseProductsSettings({ description: '  一行\r\n二行  ', shopUrl: 'https://SHOPNAME.thebase.in/items/1' }),
  { description: '一行\n二行', shopUrl: '' },
  '壊れたショップURLは空にし、紹介文は表示用に整える'
);
assert(trustedBaseShopUrl(officialShop, null) === officialShop, '公式ショップURLは確認なしでリンクにする');
assert(trustedBaseShopUrl(customShop, null) === null, '未確認の独自ドメインはリンクにしない');
assert(trustedBaseShopUrl(customShop, 'https://evil.example/') === null, '別の確認結果ではリンクにしない');
same(trustedBaseShopUrl(customShop, customShop), customShop, '確認済みの独自ドメインだけリンクにする');
assert(!baseShopSectionVisible({ productCount: 0, description: '  ', shopLink: null }), '商品も紹介文もショップURLも空なら公開しない');
assert(baseShopSectionVisible({ productCount: 0, description: '紹介', shopLink: null }), '商品0件でも紹介文があれば公開する');
assert(
  baseShopSectionVisible({ productCount: 0, description: '', shopLink: officialShop }),
  '商品0件でも安全なショップURLがあれば公開する'
);
assert(baseShopSectionVisible({ productCount: 5, description: '', shopLink: null }), '商品5件は公開する');

const before = { name: '花', productGallery: [{ name: '紅茶', productUrl: 'https://shop.example/tea' }] };
assert(
  meaningfulProfileChanged(before, { ...before, baseProducts: [productUrl] }),
  'BASE商品の追加は更新になる'
);
assert(
  meaningfulProfileChanged({ ...before, baseProducts: [productUrl] }, { ...before, baseProducts: [] }),
  'BASE商品の削除は更新になる'
);
assert(
  !meaningfulProfileChanged(before, { ...before, baseProducts: [] }),
  '空のBASE商品だけでは更新にしない'
);
assert(
  meaningfulProfileChanged(before, {
    ...before,
    baseProductsSettings: { description: '紹介', shopUrl: '' },
  }),
  'ショップ紹介文だけの変更は更新になる'
);
assert(
  meaningfulProfileChanged(
    { ...before, baseProductsSettings: { description: '紹介', shopUrl: '' } },
    { ...before, baseProductsSettings: { description: '紹介', shopUrl: officialShop } }
  ),
  'ショップURLだけの変更は更新になる'
);
assert(
  !meaningfulProfileChanged(before, {
    ...before,
    baseProductsSettings: { description: '', shopUrl: '' },
  }),
  '空のショップ設定だけでは更新にしない'
);
assert(
  !meaningfulProfileChanged(
    { baseProductsSettings: { description: '紹介', shopUrl: 'https://SHOPNAME.thebase.in/' } },
    { baseProductsSettings: { description: '紹介', shopUrl: officialShop } }
  ),
  '同じショップURLの表記ゆれは更新にしない'
);
assert(
  !meaningfulProfileChanged(
    { baseProducts: [productUrl] },
    { baseProducts: ['https://SHOPNAME.thebase.in/items/12345678/'] }
  ),
  '同じ商品の表記ゆれは更新にしない'
);
assert(
  meaningfulProfileChanged(
    { ...before, baseProducts: [productUrl] },
    {
      ...before,
      productGallery: [],
      baseProducts: [productUrl],
    }
  ),
  '手動SHOPの変更はBASE商品と別に検出する'
);

const placed = editBlockPlacement(
  { blockLayoutVersion: 1, sectionOrder: ['YouTube', 'ProductGallery'] },
  { op: 'add', block: 'BaseProducts' }
);
same(placed?.sectionOrder, ['YouTube', 'ProductGallery', 'BaseProducts'], '手動SHOPと同時に配置できる');
const detached = editBlockPlacement(placed ?? undefined, { op: 'remove', block: 'BaseProducts' });
same(detached?.sectionOrder, ['YouTube', 'ProductGallery'], 'BASE商品を外しても手動SHOPは残る');
assert(!DEFAULT_SECTION_ORDER.includes('BaseProducts'), '既定の並びには入れない');
assert(!resolveSectionOrder(undefined, undefined).includes('BaseProducts'), '旧形式の表示順には出ない');
same(BLOCK_LABELS.BaseProducts, 'BASE商品', '追加画面のラベルはBASE商品');

const kept = {
  name: '花',
  productGallery: [{ name: '紅茶' }],
  baseProducts: [] as string[],
};
const explicitEmpty = Object.fromEntries(Object.entries(kept).filter(([, value]) => value !== undefined));
same(explicitEmpty.baseProducts, [], '空配列は保存オブジェクトに残る');
same(explicitEmpty.productGallery, [{ name: '紅茶' }], '空のBASE商品を書いても手動SHOPは残る');
const emptyList: string[] | undefined = [];
const response = {
  ...(emptyList ? { baseProducts: emptyList } : {}),
};
same(response, { baseProducts: [] }, '空配列は保存レスポンスに残る');

const component = readFileSync(join(root, 'app/components/BaseProductsBlock.tsx'), 'utf8');
const css = readFileSync(join(root, 'app/components/BaseProductsBlock.module.css'), 'utf8');
const gallery = readFileSync(join(root, 'app/components/ProductGalleryBlock.tsx'), 'utf8');
const galleryCss = readFileSync(join(root, 'app/components/ProductGalleryBlock.module.css'), 'utf8');
const userRoute = readFileSync(join(root, 'app/api/user/[uid]/route.ts'), 'utf8');
const blockLayout = readFileSync(join(root, 'app/lib/blockLayout.ts'), 'utf8');

assert(component.includes('>BASE SHOP<'), '公開見出しはBASE SHOP');
assert(component.includes('src={widgetUrl}'), 'iframeのsrcは検証済みウィジェットURL');
assert(component.includes('title="BASEの商品"'), 'iframeにtitleを付ける');
assert(component.includes('loading="lazy"'), 'iframeは遅延読み込み');
assert(component.includes('width={220}'), '幅は220');
assert(component.includes('height={380}'), '高さは380');
assert(component.includes('商品ページを見る'), '商品ページへのリンクを出す');
assert(component.includes('target="_blank"'), '商品ページは新しいタブで開く');
assert(component.includes('rel="noopener noreferrer"'), '商品ページリンクにnoopenerを付ける');
assert(component.includes('if (!isEditable && !baseShopVisible) return null'), '商品もショップ情報も無い公開画面は出さない');
assert(component.includes('baseShopSectionVisible'), '紹介文かショップURLだけでも公開判定する');
assert(component.includes('ショップ紹介文'), 'ショップ紹介文を編集できる');
assert(component.includes('ショップURL'), 'ショップURLを編集できる');
assert(component.includes('ショップを見る'), 'ショップへのリンクを出す');
assert(component.includes('/base-shop'), 'ショップURLの独自ドメインは検証APIで確認する');
assert(!component.includes('dangerouslySetInnerHTML'), '紹介文をHTMLとして解釈しない');
assert(!component.includes('sandbox='), '動作未確認のsandbox属性は付けない');
assert(component.includes('/base-product'), '独自ドメインは検証APIで確認する');
assert(component.includes('接続先を確認しています'), '確認中を表示する');
assert(component.includes('確認中'), '確認中のボタンを表示する');
assert(component.includes('接続先を確認しました'), '確認成功を表示する');
assert(component.includes('変更を保存するまで'), '成功しても保存前だと分かる');
assert(component.includes('body: JSON.stringify({ url: raw })'), '検証APIにはURLだけを送る');
assert(component.includes('順番を前に'), '前へ並べ替えできる');
assert(component.includes('順番を後ろに'), '後ろへ並べ替えできる');
assert(component.includes('role="tab"'), '商品をタブで切り替える');
assert(component.includes('＋ 商品を追加'), '5件未満は追加ボタンを出す');
assert(component.includes('キャンセル'), '追加をキャンセルできる');
assert(component.includes('baseProductIndexAfterMove'), '並べ替え後も同じ商品を選択する');
assert(component.includes('itemIndex === selectedIndex'), '未確定のURLは選択中の商品だけ更新する');
assert(component.includes('最大5件'), '5件で追加を止める');
assert(!component.includes('profile:'), '登録操作ではプロフィールを送らない');
assert(!component.includes('node:dns'), 'ブラウザではDNSを引かない');
assert(!component.includes('resolveCname'), 'ブラウザではCNAMEを引かない');
assert(!component.includes('firestore'), '登録操作だけではFirestoreを触らない');
assert(css.includes('width: 220px'), 'iframeの幅は220pxで固定する');
assert(css.includes('height: 380px'), 'iframeの高さは380pxで固定する');
assert(css.includes('gap: 12px'), '商品の間隔は12px');
assert(css.includes('overflow-x: auto'), '枠の中だけ横にスクロールする');
assert(css.includes('scroll-snap-type: x mandatory'), '横スクロールはスナップする');
assert(css.includes('justify-content: center'), '1件は中央に置く');
assert(!css.includes('width: min(220px, 100%)'), 'iframeを親の幅に合わせて縮めない');
assert(!css.includes('video-container'), 'YouTubeのクラスを使わない');
assert(!css.includes('tiktok'), 'TikTokのクラスを使わない');
assert(component.includes('<ShopDescription'), 'BASEの公開紹介文は共通コンポーネント');
assert(component.includes('SHOP_DESCRIPTION_HINT'), 'BASEの編集説明も300文字とmoreに合わせる');
const shopDescription = readFileSync(join(root, 'app/components/ShopDescription.tsx'), 'utf8');
assert(shopDescription.includes('shopDescriptionOverflows'), '行数は表示領域の高さで判定する');
assert(shopDescription.includes("expanded ? 'close' : 'more'"), 'BASEでも more と close で開閉する');
const productLinkCss = css.slice(css.indexOf('.productLink {'), css.indexOf('.productLink:focus-visible'));
assert(productLinkCss.includes('width: 100%'), '商品リンクはカードと同じ幅にする');
assert(css.includes('background: #2563eb'), 'ショップボタンは青いボタンにする');
assert(css.includes('.shopButton') && css.includes('width: 100%'), 'ショップ紹介文とショップボタンの幅を揃える');
assert(!gallery.includes('baseProducts') && !gallery.includes('BaseProducts'), '手動SHOPのコンポーネントは変えない');
assert(!galleryCss.includes('base-product') && !galleryCss.includes('thebase'), '手動SHOPのCSSは変えない');
assert(userRoute.includes('sanitizeBaseProducts'), 'POSTでBASE商品URLを検証する');
assert(userRoute.includes('confirmBaseProductsForSave'), '保存時に独自ドメインを再確認する');
assert(userRoute.includes('cache: false'), '保存時の再確認は直前のキャッシュを使わない');
assert(userRoute.includes('existingProfile.baseProducts'), '保存時はFirestoreの既存URLと見比べる');
assert(userRoute.includes('baseProducts: baseProductsForSave'), '空配列も含めてbaseProductsを保存する');
assert(userRoute.includes('confirmBaseShopUrlForSave'), '保存時にショップURLを再確認する');
assert(userRoute.includes('existingProfile.baseProductsSettings'), '未変更のショップURLはFirestoreの値と見比べる');
assert(userRoute.includes('baseProductsSettings: baseProductsSettingsForSave'), '空のショップ設定も保存する');
assert(!blockLayout.includes('baseProducts'), 'ブロックの並べ替えはBASE商品のURLを消さない');
assert(!blockLayout.includes('baseProductsSettings'), 'ブロックの並べ替えはショップ設定を消さない');

const verifyRoute = readFileSync(join(root, 'app/api/user/[uid]/base-product/route.ts'), 'utf8');
const userPage = readFileSync(join(root, 'app/user/[uid]/page.tsx'), 'utf8');
const dnsSource = readFileSync(join(root, 'app/lib/baseProductDns.ts'), 'utf8');
assert(verifyRoute.includes('resolveSessionUid'), '検証APIは本人のセッションを見る');
assert(verifyRoute.includes('allowRequest'), '検証APIは回数を制限する');
assert(verifyRoute.includes('MAX_BODY_CHARS'), '検証APIは本文の長さを制限する');
assert(verifyRoute.includes('verifyBaseCustomHost'), '検証APIはサーバーでCNAMEを見る');
assert(!verifyRoute.includes('fetch('), '検証APIは商品ページを取りにいかない');
assert(!verifyRoute.includes('.verified'), '検証APIは確認済みフラグを信用しない');
assert(userPage.includes('resolveVerifiedBaseProduct'), '公開ページは表示前にサーバーで確認する');
assert(userPage.includes('resolveVerifiedBaseShopUrl'), '公開ページはショップURLもサーバーで確認する');
assert(userPage.includes('Promise.all'), '商品とショップの確認を重ねて行う');
const shopRoute = readFileSync(join(root, 'app/api/user/[uid]/base-shop/route.ts'), 'utf8');
assert(shopRoute.includes('resolveSessionUid'), 'ショップ確認APIは本人のセッションを見る');
assert(shopRoute.includes('allowRequest'), 'ショップ確認APIは回数を制限する');
assert(shopRoute.includes('readBaseShopCandidate'), 'ショップ確認APIはトップページURLだけを見る');
assert(shopRoute.includes('verifyBaseCustomHost'), 'ショップ確認APIはサーバーでCNAMEを見る');
assert(!shopRoute.includes('fetch('), 'ショップ確認APIはページを取りにいかない');
assert(!shopRoute.includes('.verified'), 'ショップ確認APIは確認済みフラグを信用しない');
assert(shopRoute.includes('shopUrl: candidate.shopUrl'), 'ショップ確認APIは正規化したURLだけを返す');
assert(dnsSource.includes('resolveCname'), 'CNAMEの解決を使う');
assert(!dnsSource.includes('fetch('), 'DNS確認はHTTPアクセスをしない');
assert(!dnsSource.includes('https.request'), 'DNS確認はHTTPS接続をしない');
assert(dnsSource.includes('=== BASE_CNAME_TARGET'), 'CNAMEは完全一致で比べる');

function dnsError(code: string): Error {
  const error = new Error(code) as NodeJS.ErrnoException;
  error.code = code;
  return error;
}

async function checkDns(): Promise<void> {
  clearBaseProductDnsCache();
  assert(cnameTargetMatchesBase(['cname.thebase.in']), '正常なCNAMEを許可する');
  assert(cnameTargetMatchesBase(['CNAME.THEBASE.IN.']), '大文字と末尾ドットを正規化する');
  assert(!cnameTargetMatchesBase(['cname.thebase.in.evil.example']), '後方への部分一致は拒否する');
  assert(!cnameTargetMatchesBase(['notcname.thebase.in']), '前方への部分一致は拒否する');
  assert(!cnameTargetMatchesBase(['cname.thebase.in.cdn.cloudflare.net']), 'CDNの末端名は許可しない');
  assert(!cnameTargetMatchesBase(['other.example', 'cname.thebase.in']), '先頭以外の一致は許可しない');
  assert(!cnameTargetMatchesBase([]), '空の応答は拒否する');

  const noDns = async () => {
    throw new Error('公式ショップでDNSを引いた');
  };
  const officialSaved = await confirmBaseProductsForSave([productUrl], [], { lookup: noDns, cache: false });
  assert(officialSaved.ok, '公式ショップの保存にDNSは不要');
  const officialEmbed = await resolveVerifiedBaseProducts([productUrl], { lookup: noDns, cache: false });
  same(officialEmbed, [{ productUrl, widgetUrl }], '公式ショップは公開時もDNSなしで表示する');

  let calls = 0;
  const okLookup = async () => {
    calls += 1;
    return ['cname.thebase.in'] as const;
  };
  clearBaseProductDnsCache();
  assert(await verifyBaseCustomHost('shop.example', { lookup: okLookup, cache: false }), '一致するCNAMEを許可する');
  assert(
    await verifyBaseCustomHost('Shop.Example', {
      lookup: async () => ['CNAME.THEBASE.IN.'],
      cache: false,
    }),
    '照会結果の大文字と末尾ドットを許可する'
  );
  assert(
    !(await verifyBaseCustomHost('bad.example', {
      lookup: async () => {
        throw dnsError('ENODATA');
      },
      cache: false,
    })),
    'ENODATAは拒否する'
  );
  assert(
    !(await verifyBaseCustomHost('mismatch.example', {
      lookup: async () => ['cname.thebase.in.cdn.cloudflare.net'],
      cache: false,
    })),
    '不一致のCNAMEは拒否する'
  );
  assert(
    !(await verifyBaseCustomHost('slow.example', {
      lookup: () => new Promise<readonly string[]>(() => undefined),
      timeoutMs: 30,
      cache: false,
    })),
    'タイムアウトは拒否する'
  );
  assert(
    !(await verifyBaseCustomHost('shopname.thebase.in', { lookup: noDns, cache: false })),
    '公式ホストは独自ドメイン確認の対象外'
  );

  calls = 0;
  clearBaseProductDnsCache();
  const cachedLookup = async () => {
    calls += 1;
    return ['CNAME.THEBASE.IN.'] as const;
  };
  assert(
    await verifyBaseCustomHost('cache.example', { lookup: cachedLookup, cache: true, now: 1_000 }),
    'キャッシュ前の一致を許可する'
  );
  assert(
    await verifyBaseCustomHost('cache.example', { lookup: cachedLookup, cache: true, now: 1_000 }),
    'キャッシュ中の一致を許可する'
  );
  assert(calls === 1, '成功のキャッシュ中は再照会しない');
  assert(
    await verifyBaseCustomHost('cache.example', {
      lookup: cachedLookup,
      cache: true,
      now: 1_000 + BASE_DNS_OK_CACHE_MS,
    }),
    '成功キャッシュの期限後は再確認できる'
  );
  assert(calls === 2, '成功キャッシュの期限後は再照会する');

  calls = 0;
  clearBaseProductDnsCache();
  const failLookup = async () => {
    calls += 1;
    throw dnsError('ENODATA');
  };
  assert(!(await verifyBaseCustomHost('fail.example', { lookup: failLookup, cache: true, now: 5_000 })), '失敗を拒否する');
  assert(
    !(await verifyBaseCustomHost('fail.example', { lookup: failLookup, cache: true, now: 5_000 })),
    '失敗キャッシュ中も拒否する'
  );
  assert(calls === 1, '失敗のキャッシュ中は再照会しない');
  assert(
    !(await verifyBaseCustomHost('fail.example', {
      lookup: failLookup,
      cache: true,
      now: 5_000 + BASE_DNS_FAIL_CACHE_MS,
    })),
    '失敗キャッシュの期限後も不一致なら拒否する'
  );
  assert(calls === 2, '失敗キャッシュの期限後は再照会する');

  const accepted = await confirmBaseProductsForSave([customUrl], [], {
    lookup: async () => ['cname.thebase.in'],
    cache: false,
  });
  assert(accepted.ok, 'CNAMEが一致する独自ドメインを保存できる');
  if (accepted.ok) same(accepted.urls, [customUrl], '保存値は商品ページURLのまま');
  const rejectedSave = await confirmBaseProductsForSave([customUrl], [], {
    lookup: async () => {
      throw dnsError('ENODATA');
    },
    cache: false,
  });
  assert(!rejectedSave.ok, 'CNAMEを確認できない独自ドメインは保存しない');
  const kept = await confirmBaseProductsForSave([customUrl, productUrl], [customUrl], {
    lookup: async () => {
      throw new Error('既存URLでDNSを引いた');
    },
    cache: false,
  });
  assert(kept.ok, '既存の独自ドメインを変えない保存はDNS失敗の影響を受けない');
  if (kept.ok) same(kept.urls, [customUrl, productUrl], '既存URLの順番変更と公式URLの追加を保存できる');
  let hostCalls = 0;
  const mixed = await confirmBaseProductsForSave(
    [productUrl, customUrl, 'https://shop.example/items/2'],
    [productUrl],
    {
      lookup: async () => {
        hostCalls += 1;
        return ['cname.thebase.in'] as const;
      },
      cache: false,
    }
  );
  assert(mixed.ok, '同じホストの新規商品はまとめて確認できる');
  assert(hostCalls === 1, '同じホストのDNS照会は1回');
  const blocked = await confirmBaseProductsForSave([productUrl, customUrl], [productUrl], {
    lookup: async () => {
      throw dnsError('ENODATA');
    },
    cache: false,
  });
  assert(!blocked.ok, '新規URLの確認失敗では配列全体を保存しない');
  const emptied = await confirmBaseProductsForSave([], [customUrl], {
    lookup: async () => {
      throw new Error('空配列でDNSを引いた');
    },
    cache: false,
  });
  assert(emptied.ok && emptied.urls.length === 0, '削除の空配列はDNSを見ない');

  const hidden = await resolveVerifiedBaseProducts([customUrl], {
    lookup: async () => {
      throw dnsError('ENODATA');
    },
    cache: false,
  });
  same(hidden, [], '公開時に確認できない独自ドメインは出さない');
  same(coerceBaseProducts([customUrl]), [customUrl], '公開時の失敗でも構造上のURLは残る');
  const shown = await resolveVerifiedBaseProducts([`${customUrl}/widget`], {
    lookup: async () => ['cname.thebase.in'],
    cache: false,
  });
  same(shown, [{ productUrl: customUrl, widgetUrl: `${customUrl}/widget` }], '公開時に確認できた独自ドメインを表示する');
  const partial = await resolveVerifiedBaseProducts([productUrl, customUrl, 'https://other.example/items/9'], {
    lookup: async (hostname) => (hostname === 'shop.example' ? ['cname.thebase.in'] : ['nope.example']),
    cache: false,
  });
  same(
    partial,
    [
      { productUrl, widgetUrl },
      { productUrl: customUrl, widgetUrl: `${customUrl}/widget` },
    ],
    '公開時は失敗した商品だけを隠す'
  );

  const officialShopSaved = await confirmBaseShopUrlForSave(officialShop, null, { lookup: noDns, cache: false });
  assert(officialShopSaved.ok && officialShopSaved.shopUrl === officialShop, '公式ショップURLの保存にDNSは不要');
  same(
    await resolveVerifiedBaseShopUrl({ description: '', shopUrl: officialShop }, { lookup: noDns, cache: false }),
    officialShop,
    '公式ショップURLは公開時もDNSなしで表示する'
  );
  const emptyShopSaved = await confirmBaseShopUrlForSave('', { description: '紹介', shopUrl: customShop }, {
    lookup: noDns,
    cache: false,
  });
  assert(emptyShopSaved.ok && emptyShopSaved.shopUrl === '', '空のショップURLはDNSなしで消せる');

  let shopCalls = 0;
  const shopLookup = async () => {
    shopCalls += 1;
    return ['cname.thebase.in'] as const;
  };
  clearBaseProductDnsCache();
  const newShop = await confirmBaseShopUrlForSave('https://fresh.example/', { description: '', shopUrl: '' }, {
    lookup: shopLookup,
    cache: false,
  });
  assert(newShop.ok && newShop.shopUrl === 'https://fresh.example/', 'DNS成功の独自ドメインショップURLを保存できる');
  assert(shopCalls === 1, '新規ショップURLはDNSを1回確認する');
  const skippedShop = await confirmBaseShopUrlForSave(customShop, { description: '', shopUrl: customShop }, {
    lookup: async () => {
      throw new Error('未変更のショップURLでDNSを引いた');
    },
    cache: false,
  });
  assert(skippedShop.ok && skippedShop.shopUrl === customShop, '未変更のショップURLはDNSを再確認しない');
  const rejectedShop = await confirmBaseShopUrlForSave('https://other.example/', { description: '', shopUrl: '' }, {
    lookup: async () => {
      throw dnsError('ENODATA');
    },
    cache: false,
  });
  assert(!rejectedShop.ok, 'DNS不一致のショップURLは保存できない');
  const timedOutShop = await confirmBaseShopUrlForSave('https://slow.example/', { description: '', shopUrl: '' }, {
    lookup: async () => {
      throw dnsError('ETIMEOUT');
    },
    cache: false,
  });
  assert(!timedOutShop.ok, 'DNSタイムアウトのショップURLは保存できない');
  const hiddenShop = { description: '残す', shopUrl: customShop };
  same(
    await resolveVerifiedBaseShopUrl(hiddenShop, {
      lookup: async () => {
        throw dnsError('ENODATA');
      },
      cache: false,
    }),
    null,
    '公開時のDNS失敗ではショップリンクを出さない'
  );
  same(hiddenShop.shopUrl, customShop, '公開時のDNS失敗でも保存値は残す');

  let sharedCalls = 0;
  const sharedLookup = async () => {
    sharedCalls += 1;
    return ['cname.thebase.in'] as const;
  };
  clearBaseProductDnsCache();
  const [sharedProducts, sharedShop] = await Promise.all([
    confirmBaseProductsForSave(['https://shared.example/items/1'], [], { lookup: sharedLookup, cache: false }),
    confirmBaseShopUrlForSave('https://shared.example/', { description: '', shopUrl: '' }, {
      lookup: sharedLookup,
      cache: false,
    }),
  ]);
  assert(sharedProducts.ok && sharedShop.ok, '同じホストの商品とショップを保存できる');
  assert(sharedCalls === 1, '同じホストのDNS確認は1回にまとめる');

  const resolvers: Array<(value: readonly string[]) => void> = [];
  let started = 0;
  const gated = () => {
    started += 1;
    return new Promise<readonly string[]>((resolve) => {
      resolvers.push(resolve);
    });
  };
  const hosts = Array.from({ length: BASE_DNS_MAX_IN_FLIGHT + 2 }, (_, index) => `slot${index}.example`);
  const jobs = hosts.map((host) =>
    verifyBaseCustomHost(host, { lookup: gated, cache: false, timeoutMs: 2_000 })
  );
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert(started === BASE_DNS_MAX_IN_FLIGHT, `同時のDNS照会は4件まで: ${started}`);
  resolvers.splice(0, BASE_DNS_MAX_IN_FLIGHT).forEach((resolve) => resolve(['cname.thebase.in']));
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert(started === hosts.length, `空いた枠で待ち分を照会する: ${started}`);
  resolvers.splice(0).forEach((resolve) => resolve(['cname.thebase.in']));
  const slotted = await Promise.all(jobs);
  assert(slotted.every(Boolean), '枠内の照会結果を返す');
}

checkDns()
  .then(() => {
    console.log('base-products-check: ok');
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
