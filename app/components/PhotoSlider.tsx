'use client';

import React from "react";

type Photo = {
  url: string;
  position?: string;
};

type Props = {
  photos: Photo[];
  current: number;
  onPrev: () => void;
  onNext: () => void;
  onPositionChange: (index: number, value: string) => void;
};

export default function PhotoSlider({
  photos,
  current,
  onPrev,
  onNext,
  onPositionChange,
}: Props) {
  if (!photos || photos.length === 0) {
    return <div style={{ padding: 32, textAlign: "center" }}>写真がありません</div>;
  }

  return (
    <div className="carousel-wrapper" style={{ position: "relative", margin: "0 auto", maxWidth: 600 }}>
      <div className="carousel">
        {photos.map((photo, i) => (
          <div
            className={`slide${i === current ? ' active' : ''}`}
            style={{
              ...( { "--i": i - current } as React.CSSProperties ),
              position: "absolute",
              opacity: i === current ? 1 : 0.6,
              zIndex: i === current ? 2 : 1
            }}
            key={i}
          >
            <img
              src={photo.url}
              className="carousel-image"
              style={{
                objectPosition: `center ${photo.position || "50"}%`,
                width: "100%",
                borderRadius: 18,
                boxShadow: "0 8px 32px rgba(0,0,0,0.10)"
              }}
              alt={`写真${i + 1}`}
            />
            {i === current && (
              <input
                type="range"
                min="0"
                max="100"
                value={photo.position || "50"}
                className="position-slider"
                style={{
                  position: "absolute",
                  bottom: 12, left: "10%", width: "80%", zIndex: 2
                }}
                onChange={e => onPositionChange(i, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
      <button onClick={onPrev} style={arrowStyle}>‹</button>
      <button onClick={onNext} style={arrowStyleRight}>›</button>
      <div style={{ textAlign: "center", marginTop: 30, fontWeight: 600 }}>
        写真を登録(最大5枚)
      </div>
    </div>
  );
}

const arrowStyle = {
  position: "absolute" as const,
  left: -16,
  top: "50%",
  transform: "translateY(-50%)",
  background: "#4f7cf7",
  color: "#fff",
  border: "none",
  borderRadius: "50%",
  width: 44,
  height: 44,
  fontSize: 24,
  cursor: "pointer",
  zIndex: 5,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
};
const arrowStyleRight = { ...arrowStyle, left: "auto", right: -16 };
