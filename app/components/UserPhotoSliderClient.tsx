'use client';

import React, { useState } from 'react';
import PhotoSliderBlock, { Photo } from './PhotoSliderBlock';

type Props = {
  uid: string;
  initialPhotos: Photo[];
};

export default function UserPhotoSliderClient({ uid, initialPhotos }: Props) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);

  return (
    <PhotoSliderBlock uid={uid} photos={photos} setPhotos={setPhotos} />
  );
}
