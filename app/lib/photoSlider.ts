// lib/photoSlider.ts

import { clampPhotoPositionY } from '@/lib/photoPosition';

type Photo = { url: string; position?: number };
type UpdatePhotoSliderFn = (photos: Photo[], _isOwnPage: boolean) => void;

export const updatePhotoSlider: UpdatePhotoSliderFn = (photos, _isOwnPage) => {
  const container = document.getElementById('photoSlider');
  if (!container) return;

  container.innerHTML = '';

  photos.forEach((photo, i) => {
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = `写真${i + 1}`;
    img.style.objectFit = 'cover';
    img.style.objectPosition = `center ${clampPhotoPositionY(photo.position)}%`;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    container.appendChild(img);
  });
};
