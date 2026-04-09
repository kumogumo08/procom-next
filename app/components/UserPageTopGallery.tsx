'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Photo } from '@/components/PhotoSliderBlock';
import { clampPhotoPositionY, cssObjectPositionFromPhotoY } from '@/lib/photoPosition';
import styles from './UserPageTopGallery.module.css';

type Props = {
  photos: Photo[];
  /** 指定時は表示インデックスを親と同期（編集 UI 用） */
  activeIndex?: number;
  onActiveIndexChange?: (i: number) => void;
  /** メイン画像をドラッグして縦位置を調整 */
  enableDragPosition?: boolean;
  onDragPositionY?: (y: number) => void;
};

const MAX = 5;

export default function UserPageTopGallery({
  photos,
  activeIndex: activeIndexProp,
  onActiveIndexChange,
  enableDragPosition,
  onDragPositionY,
}: Props) {
  const list = useMemo(() => photos.slice(0, MAX).filter((p) => p?.url), [photos]);
  const n = list.length;
  const [internalIndex, setInternalIndex] = useState(0);

  const controlled =
    typeof activeIndexProp === 'number' && typeof onActiveIndexChange === 'function';
  const index = controlled ? activeIndexProp! : internalIndex;

  const dragRef = useRef<{ startY: number; startPos: number; height: number } | null>(null);

  const setIndexTo = useCallback(
    (i: number) => {
      if (controlled) onActiveIndexChange!(i);
      else setInternalIndex(i);
    },
    [controlled, onActiveIndexChange]
  );

  useEffect(() => {
    if (!controlled || n === 0) return;
    if (activeIndexProp! < 0 || activeIndexProp! >= n) {
      onActiveIndexChange!(Math.max(0, n - 1));
    }
  }, [controlled, n, activeIndexProp, onActiveIndexChange]);

  const goPrev = useCallback(() => {
    if (n <= 1) return;
    setIndexTo((index - 1 + n) % n);
  }, [n, index, setIndexTo]);

  const goNext = useCallback(() => {
    if (n <= 1) return;
    setIndexTo((index + 1) % n);
  }, [n, index, setIndexTo]);

  const {
    farPrevIdx,
    prevIdx,
    nextIdx,
    farNextIdx,
    showFarPrev,
    showFarNext,
    showPrev,
    showNext,
  } = useMemo(() => {
    if (n <= 1) {
      return {
        farPrevIdx: -1,
        prevIdx: -1,
        nextIdx: -1,
        farNextIdx: -1,
        showFarPrev: false,
        showFarNext: false,
        showPrev: false,
        showNext: false,
      };
    }
    const farPrevIdx = (index - 2 + n) % n;
    const prevIdx = (index - 1 + n) % n;
    const nextIdx = (index + 1) % n;
    const farNextIdx = (index + 2) % n;
    /*
     * 重複インデックスのスロットは出さない
     * - n=2: prev===next → 片側のみ
     * - n=3: farPrev===next, farNext===prev → 内側3枚のみ
     * - n=4: farPrev===farNext → 外側は左右どちらか一方（左に farPrev のみ）
     * - n=5: 5枚とも別インデックス
     */
    const showFarPrev = n >= 4 && farPrevIdx !== nextIdx;
    const showFarNext =
      n >= 5 && farNextIdx !== farPrevIdx && farNextIdx !== prevIdx;
    const showPrev = n >= 2;
    const showNext = n >= 2 && nextIdx !== prevIdx;

    return {
      farPrevIdx,
      prevIdx,
      nextIdx,
      farNextIdx,
      showFarPrev,
      showFarNext,
      showPrev,
      showNext,
    };
  }, [n, index]);

  const goFarPrev = useCallback(() => {
    if (farPrevIdx < 0) return;
    setIndexTo(farPrevIdx);
  }, [farPrevIdx, setIndexTo]);

  const goFarNext = useCallback(() => {
    if (farNextIdx < 0) return;
    setIndexTo(farNextIdx);
  }, [farNextIdx, setIndexTo]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!enableDragPosition || !onDragPositionY) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const main = list[index];
    dragRef.current = {
      startY: e.clientY,
      startPos: clampPhotoPositionY(main?.position),
      height: Math.max(rect.height, 1),
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!enableDragPosition || !onDragPositionY || !dragRef.current) return;
    const dy = e.clientY - dragRef.current.startY;
    const deltaPct = (-dy / dragRef.current.height) * 100;
    onDragPositionY(clampPhotoPositionY(dragRef.current.startPos + deltaPct));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragRef.current = null;
  };

  if (n === 0) {
    return (
      <section className={styles.root} aria-label="プロフィール写真">
        <div className={styles.empty}>
          <p className={styles.emptyText}>画像がまだ登録されていません</p>
        </div>
      </section>
    );
  }

  const dragHandlers =
    enableDragPosition && onDragPositionY
      ? {
          onPointerDown: handlePointerDown,
          onPointerMove: handlePointerMove,
          onPointerUp: handlePointerUp,
          onPointerCancel: handlePointerUp,
        }
      : {};

  return (
    <section className={styles.root} aria-label="プロフィール写真">
      <div className={styles.viewport}>
        {n > 1 ? (
          <button
            type="button"
            className={styles.arrow}
            onClick={goPrev}
            aria-label="前の写真"
          >
            ‹
          </button>
        ) : (
          <span className={styles.arrowSpacer} aria-hidden />
        )}

        <div className={styles.stage}>
          {n === 1 ? (
            <div
              className={`${styles.singleWrap} ${enableDragPosition ? styles.dragArea : ''}`}
              {...dragHandlers}
            >
              <img
                src={list[0].url}
                alt=""
                className={styles.singleImg}
                style={cssObjectPositionFromPhotoY(list[0].position)}
                draggable={false}
              />
            </div>
          ) : (
            <div
              className={styles.track}
              role="group"
              aria-roledescription="carousel"
              data-slot-count={
                1 +
                (showFarPrev ? 1 : 0) +
                (showPrev ? 1 : 0) +
                1 +
                (showNext ? 1 : 0) +
                (showFarNext ? 1 : 0)
              }
            >
              {showFarPrev ? (
                <button
                  type="button"
                  className={`${styles.slide} ${styles.slideFarPrev}`}
                  onClick={goFarPrev}
                  aria-label="2枚前の写真を表示"
                >
                  <img
                    src={list[farPrevIdx].url}
                    alt=""
                    className={styles.slideImg}
                    style={cssObjectPositionFromPhotoY(list[farPrevIdx].position)}
                    draggable={false}
                  />
                </button>
              ) : null}

              {showPrev ? (
                <button
                  type="button"
                  className={`${styles.slide} ${styles.slidePrev}`}
                  onClick={goPrev}
                  aria-label="前の写真を表示"
                >
                  <img
                    src={list[prevIdx].url}
                    alt=""
                    className={styles.slideImg}
                    style={cssObjectPositionFromPhotoY(list[prevIdx].position)}
                    draggable={false}
                  />
                </button>
              ) : null}

              <div
                className={`${styles.slide} ${styles.slideActive} ${enableDragPosition ? styles.dragArea : ''}`}
                {...dragHandlers}
              >
                <img
                  src={list[index].url}
                  alt=""
                  className={styles.slideImg}
                  style={cssObjectPositionFromPhotoY(list[index].position)}
                  draggable={false}
                />
              </div>

              {showNext ? (
                <button
                  type="button"
                  className={`${styles.slide} ${styles.slideNext}`}
                  onClick={goNext}
                  aria-label="次の写真を表示"
                >
                  <img
                    src={list[nextIdx].url}
                    alt=""
                    className={styles.slideImg}
                    style={cssObjectPositionFromPhotoY(list[nextIdx].position)}
                    draggable={false}
                  />
                </button>
              ) : null}

              {showFarNext ? (
                <button
                  type="button"
                  className={`${styles.slide} ${styles.slideFarNext}`}
                  onClick={goFarNext}
                  aria-label="2枚先の写真を表示"
                >
                  <img
                    src={list[farNextIdx].url}
                    alt=""
                    className={styles.slideImg}
                    style={cssObjectPositionFromPhotoY(list[farNextIdx].position)}
                    draggable={false}
                  />
                </button>
              ) : null}
            </div>
          )}
        </div>

        {n > 1 ? (
          <button
            type="button"
            className={styles.arrow}
            onClick={goNext}
            aria-label="次の写真"
          >
            ›
          </button>
        ) : (
          <span className={styles.arrowSpacer} aria-hidden />
        )}
      </div>

      {n > 1 ? (
        <div className={styles.dots} role="tablist" aria-label="写真の切り替え">
          {list.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={i === index ? styles.dotActive : styles.dot}
              onClick={() => setIndexTo(i)}
              aria-label={`写真 ${i + 1}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
