/**
 * ブロック追加画面のカテゴリ。表示専用で、sectionOrder や Firestore には書かない。
 * 分類を増やすときはこの配列に1件足す。ブロックキーは blockLayout の BlockType を使う。
 */
import { BLOCK_TYPES, type BlockType } from '@/lib/blockLayout';

export const BLOCK_ADD_CATEGORIES = [
  {
    id: 'sns',
    label: 'SNS',
    description: '動画やSNSの投稿を表示',
    blocks: ['YouTube', 'X', 'Instagram', 'TikTok', 'Facebook'],
  },
  {
    id: 'links',
    label: 'リンク・紹介',
    description: 'バナー、アプリ、SNSボタン',
    blocks: ['BannerLinks', 'AppProjects', 'SNSButtons'],
  },
  {
    id: 'events',
    label: 'イベント',
    description: '配信やイベントの予定',
    blocks: ['Calendar'],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  description: string;
  blocks: readonly BlockType[];
}[];

export type BlockAddCategory = (typeof BLOCK_ADD_CATEGORIES)[number];
export type BlockAddCategoryId = BlockAddCategory['id'];

type ListedBlock = BlockAddCategory['blocks'][number];
type Assert<T extends true> = T;
type _EveryBlockHasCategory = Assert<[BlockType] extends [ListedBlock] ? true : false>;

/** カテゴリ定義順のうち、まだ置いていないブロックだけを返す。 */
export function availableBlocksInCategory(
  blocks: readonly BlockType[],
  available: readonly BlockType[]
): BlockType[] {
  const remaining = new Set<BlockType>(available);
  return blocks.filter((block) => remaining.has(block));
}

/** 未分類と、複数カテゴリに入っているブロック。追加画面の定義チェック用。 */
export function blockAddCategoryCoverage(): { missing: BlockType[]; duplicate: BlockType[] } {
  const counts = new Map<BlockType, number>();
  for (const category of BLOCK_ADD_CATEGORIES) {
    for (const block of category.blocks) {
      counts.set(block, (counts.get(block) ?? 0) + 1);
    }
  }
  return {
    missing: BLOCK_TYPES.filter((block) => !counts.has(block)),
    duplicate: BLOCK_TYPES.filter((block) => (counts.get(block) ?? 0) > 1),
  };
}
