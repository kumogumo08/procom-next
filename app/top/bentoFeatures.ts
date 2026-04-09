/**
 * トップ「できること」セクションの機能一覧（表示順＝配列順で固定）
 * 画像差し替え: imageSrc を差し替えるか、public/images/top/bento/0N-feature.png を置き換える
 */
export type BentoFeatureItem = {
  title: string;
  description: string;
  /** public 配下のパス。null / 空なら画像ブロックを出さない（ビルドエラーにしない） */
  imageSrc: string | null;
};

export const BENTO_FEATURES: readonly BentoFeatureItem[] = [
  {
    title: 'SNSも実績も、1ページで伝わる',
    description: 'リンクが増えても、公式の入口はこれひとつ。見せたい順に並べられます。',
    imageSrc: '/images/top/bento/01-feature.png',
  },
  {
    title: '動画や写真で、活動を見せられる',
    description: '埋め込みやスライドで、静止画だけでは足りない魅力も補います。',
    imageSrc: '/images/top/bento/02-feature.png',
  },
  {
    title: '検索から、新しい出会いが生まれる',
    description: '名前や肩書きで見つけてもらい、ファンやクライアントにつながります。',
    imageSrc: '/images/top/bento/03-feature.png',
  },
  {
    title: 'スマホでも、読みやすいプロフィール',
    description: '発信に追いつく表示設計。外出先からも更新しやすい体験です。',
    imageSrc: '/images/top/bento/04-feature.png',
  },
];
