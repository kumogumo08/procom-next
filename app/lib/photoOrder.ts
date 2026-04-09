/** PhotoSliderBlock と同形（url + 縦位置）。並び替えでも position は要素に紐づいて移動する */
export type PhotoOrderItem = { url: string; position?: number };

/** 指定インデックスの写真を先頭（メイン）へ。position は各要素に付いたまま移動する */
export function movePhotoToFront(photos: PhotoOrderItem[], index: number): PhotoOrderItem[] {
  if (index < 0 || index >= photos.length || index === 0) return photos;
  const item = photos[index];
  return [item, ...photos.slice(0, index), ...photos.slice(index + 1)];
}

/**
 * メインへ移動後の「編集中インデックス」
 * 先頭に持ってきた枚を見ていた → 0。それ以外はずれた分だけ追従。
 */
export function currentIndexAfterMoveToFront(fromIndex: number, oldCurrent: number): number {
  if (oldCurrent === fromIndex) return 0;
  if (oldCurrent < fromIndex) return oldCurrent + 1;
  return oldCurrent;
}

/** 隣接 i と i+1 を入れ替え */
export function swapPhotoWithNext(photos: PhotoOrderItem[], index: number): PhotoOrderItem[] {
  const j = index + 1;
  if (index < 0 || j >= photos.length) return photos;
  const next = [...photos];
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

/** 隣接 i-1 と i を入れ替え */
export function swapPhotoWithPrev(photos: PhotoOrderItem[], index: number): PhotoOrderItem[] {
  const j = index - 1;
  if (j < 0 || index >= photos.length) return photos;
  const next = [...photos];
  [next[j], next[index]] = [next[index], next[j]];
  return next;
}

export function currentIndexAfterSwap(i: number, j: number, oldCurrent: number): number {
  if (oldCurrent === i) return j;
  if (oldCurrent === j) return i;
  return oldCurrent;
}
