'use client';

import UserPageNavHeader from '@/components/UserPageNavHeader';
import UserPageTopGallery from '@/components/UserPageTopGallery';
import UserPhotoSliderClient from '@/components/UserPhotoSliderClient';
import ProfileActivityTabs from '@/components/ProfileActivityTabs';
import type { Photo } from '@/components/PhotoSliderBlock';

type HeaderloginProps = {
  /** SSR から渡す写真（上部ギャラリー用・最大5枚） */
  topGalleryPhotos?: Photo[];
  /** ログイン本人のみ true（写真編集 UI をギャラリー直下に出す） */
  showPhotoEditor?: boolean;
  photoEditorUid?: string;
  /** 編集用の初期写真（ギャラリーと同じ整形データ） */
  photoEditorPhotos?: Photo[];
  /** 本人の公開プロフィールだけ。カルーセル直下の切り替え */
  showProfileActivityTabs?: boolean;
  /** 一般訪問者向け。公開中だけカルーセル直下に出す */
  visitorActivityHref?: string;
};

export default function Headerlogin({
  topGalleryPhotos,
  showPhotoEditor,
  photoEditorUid,
  photoEditorPhotos,
  showProfileActivityTabs = false,
  visitorActivityHref,
}: HeaderloginProps = {}) {
  return (
    <>
      <UserPageNavHeader />
      {showPhotoEditor && photoEditorUid && photoEditorPhotos ? (
        <UserPhotoSliderClient
          uid={photoEditorUid}
          initialPhotos={photoEditorPhotos}
          showPhotoCarousel={false}
          showProfileActivityTabs={showProfileActivityTabs}
        />
      ) : (
        <>
          <UserPageTopGallery photos={topGalleryPhotos ?? []} />
          {visitorActivityHref && photoEditorUid ? (
            <ProfileActivityTabs
              current="profile"
              profileUid={photoEditorUid}
              activityHref={visitorActivityHref}
            />
          ) : null}
        </>
      )}
    </>
  );
}
