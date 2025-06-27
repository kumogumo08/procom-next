// lib/photoSlider.ts

type Photo = { url: string; position?: string };
type UpdatePhotoSliderFn = (photos: Photo[], isOwnPage: boolean) => void;

export const updatePhotoSlider: UpdatePhotoSliderFn = (photos, isOwnPage) => {
  const container = document.getElementById('photoSlider');
  if (!container) return;

  container.innerHTML = ''; // スライダーを初期化

  photos.forEach((photo, i) => {
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = `写真${i + 1}`;
    img.style.objectPosition = `50% ${photo.position || '50'}`;
    container.appendChild(img);
  });

  // 表示切り替えや編集機能は必要に応じて追加
};
