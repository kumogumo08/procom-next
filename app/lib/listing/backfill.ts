import { compareDirectoryOrder, type DirectoryOrderKey } from '@/lib/publicUserDirectory';

import { pageNoForSeq } from './engine';

export type BackfillRow = DirectoryOrderKey & {
  isPublic: boolean;
};

/** 読み取り専用。users は変更しない。公開だけを現在の並びで seq 1 から置く。 */
export function planBackfill<T extends BackfillRow>(rows: readonly T[]): Array<T & { seq: number; pageNo: number }> {
  const listed = rows.filter((row) => row.isPublic);
  listed.sort((a, b) => compareDirectoryOrder(a, b));
  return listed.map((row, index) => {
    const seq = index + 1;
    return { ...row, seq, pageNo: pageNoForSeq(seq) };
  });
}
