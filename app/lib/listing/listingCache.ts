import { revalidatePath, revalidateTag } from 'next/cache';

import { isListingDirectoryReady } from './readiness';

/** users と publicProfiles を読む一覧。固定ページには付けない。 */
export const LISTING_CACHE_TAG = 'listing';

/** directoryPages とページ数。掲載ワーカーが書き終えるまで無効化しない。 */
export const LISTING_PAGES_CACHE_TAG = 'listing-pages';

function reportInvalidationFailure(err: unknown): void {
  console.error('掲載キャッシュの無効化に失敗:', err instanceof Error ? err.name : 'error');
}

/**
 * 公開停止が users / publicProfiles に反映されたあと。
 * 新方式の /users は directoryPages を読むため、ここでは無効化しない。
 * 失敗しても呼び出し元の退会は止めない。
 */
export function invalidateListingAfterUnpublish(): void {
  try {
    revalidateTag(LISTING_CACHE_TAG);
    revalidatePath('/top');
    if (!isListingDirectoryReady()) {
      revalidatePath('/users');
    }
  } catch (err: unknown) {
    reportInvalidationFailure(err);
  }
}

/** 掲載ワーカーが directoryPages を更新し終えたあと。失敗しても退会は止めない。 */
export function invalidateListingPages(): void {
  try {
    revalidateTag(LISTING_PAGES_CACHE_TAG);
    revalidatePath('/users');
  } catch (err: unknown) {
    reportInvalidationFailure(err);
  }
}
