/** Firestore photos[].position（縦方向 0=上 100=下）→ object-position: center Y% */

export function clampPhotoPositionY(p: unknown): number {
  if (typeof p === 'number' && !Number.isNaN(p)) {
    return Math.min(100, Math.max(0, p));
  }
  return 50;
}

export function cssObjectPositionFromPhotoY(position?: unknown): { objectPosition: string } {
  return { objectPosition: `center ${clampPhotoPositionY(position)}%` };
}
