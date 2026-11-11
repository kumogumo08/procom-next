'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import { shopDescriptionOverflows } from '@/lib/productGallery';
import styles from './ShopDescription.module.css';

type Props = {
  text: string;
};

/** 公開中のショップ紹介文。幅を測って3行を超えるときだけ more / close を出す。 */
export default function ShopDescription({ text }: Props) {
  const textId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const measure = measureRef.current;
    if (!body || !measure) return;
    let cancelled = false;

    const update = () => {
      if (cancelled) return;
      const lineHeight = Number.parseFloat(getComputedStyle(measure).lineHeight);
      const over = shopDescriptionOverflows(measure.scrollHeight, lineHeight);
      setOverflowing((current) => (current === over ? current : over));
      if (!over) setExpanded(false);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(body);
    const fonts = document.fonts;
    if (fonts?.ready) void fonts.ready.then(update);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [text]);

  return (
    <div className={styles.description}>
      <div ref={bodyRef} className={styles.body}>
        <p id={textId} className={expanded ? styles.text : styles.textClamped}>
          {text}
        </p>
        <p ref={measureRef} className={styles.measure} aria-hidden="true">
          {text}
        </p>
      </div>
      {overflowing ? (
        <button
          type="button"
          className={styles.more}
          aria-expanded={expanded}
          aria-controls={textId}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'close' : 'more'}
        </button>
      ) : null}
    </div>
  );
}
