'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PhotoSliderBlock, { Photo } from './PhotoSliderBlock';

type Props = {
  uid: string;
  initialPhotos: Photo[];
  /** false: 下部カルーセル非表示（上部ギャラリー直下の編集 UI のみ） */
  showPhotoCarousel?: boolean;
};

export default function UserPhotoSliderClient({
  uid,
  initialPhotos,
  showPhotoCarousel = true,
}: Props) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const router = useRouter();

  useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  return (
    <PhotoSliderBlock
      uid={uid}
      photos={photos}
      setPhotos={setPhotos}
      onSavedPhotos={(next) => {
        setPhotos(next);
        router.refresh();
      }}
      showPhotoCarousel={showPhotoCarousel}
    />
  );
}
