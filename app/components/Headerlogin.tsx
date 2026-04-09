'use client';

import UserPageNavHeader from '@/components/UserPageNavHeader';
import UserPageTopGallery from '@/components/UserPageTopGallery';
import UserPhotoSliderClient from '@/components/UserPhotoSliderClient';
import type { Photo } from '@/components/PhotoSliderBlock';

type HeaderloginProps = {
  /** SSR から渡す写真（上部ギャラリー用・最大5枚） */
  topGalleryPhotos?: Photo[];
  /** ログイン本人のみ true（写真編集 UI をギャラリー直下に出す） */
  showPhotoEditor?: boolean;
  photoEditorUid?: string;
  /** 編集用の初期写真（ギャラリーと同じ整形データ） */
  photoEditorPhotos?: Photo[];
};

export default function Headerlogin({
  topGalleryPhotos,
  showPhotoEditor,
  photoEditorUid,
  photoEditorPhotos,
}: HeaderloginProps = {}) {
  return (
    <>
      <UserPageNavHeader />
      {showPhotoEditor && photoEditorUid && photoEditorPhotos ? (
        <UserPhotoSliderClient
          uid={photoEditorUid}
          initialPhotos={photoEditorPhotos}
          showPhotoCarousel={false}
        />
      ) : (
        <UserPageTopGallery photos={topGalleryPhotos ?? []} />
      )}
    </>
  );
}
