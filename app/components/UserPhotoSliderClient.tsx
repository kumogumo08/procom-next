'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PhotoSliderBlock, { Photo } from './PhotoSliderBlock';

type Props = {
  uid: string;
  initialPhotos: Photo[];
  /** false: 下部カルーセル非表示（上部ギャラリー直下の編集 UI のみ） */
  showPhotoCarousel?: boolean;
  /** 本人の公開プロフィールだけ。カルーセル直下の切り替え */
  showProfileActivityTabs?: boolean;
};

export default function UserPhotoSliderClient({
  uid,
  initialPhotos,
  showPhotoCarousel = true,
  showProfileActivityTabs = false,
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
      showProfileActivityTabs={showProfileActivityTabs}
    />
  );
}
