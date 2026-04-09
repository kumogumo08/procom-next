'use client';

import React from 'react';
import { cssObjectPositionFromPhotoY } from '@/lib/photoPosition';
import styles from './PhotoSlider.module.css';

type Photo = {
  url: string;
  position?: number;
};

type Props = {
  photos: Photo[];
  current: number;
  onPrev: () => void;
  onNext: () => void;
};

export default function PhotoSlider({
  photos,
  current,
  onPrev,
  onNext,
}: Props) {
  if (!photos || photos.length === 0) {
    return <div style={{ padding: 32, textAlign: 'center' }}>写真がありません</div>;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.track}>
        {photos.map((photo, i) => (
          <div
            className={`${styles.slide} ${i === current ? styles.slideActive : ''}`}
            style={
              {
                '--i': i - current,
              } as React.CSSProperties
            }
            key={i}
          >
            <div className={styles.frame}>
              <img
                src={photo.url}
                className={styles.img}
                alt={`写真${i + 1}`}
                style={cssObjectPositionFromPhotoY(photo.position)}
              />
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={onPrev} style={arrowStyle}>
        ‹
      </button>
      <button type="button" onClick={onNext} style={arrowStyleRight}>
        ›
      </button>
    </div>
  );
}

const arrowStyle = {
  position: 'absolute' as const,
  left: -16,
  top: '50%',
  transform: 'translateY(-50%)',
  background: '#4f7cf7',
  color: '#fff',
  border: 'none',
  borderRadius: '50%',
  width: 44,
  height: 44,
  fontSize: 24,
  cursor: 'pointer',
  zIndex: 5,
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
};
const arrowStyleRight = { ...arrowStyle, left: 'auto', right: -16 };
