'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import PhotoSlider from '@/components/PhotoSlider';
import UserPageTopGallery from '@/components/UserPageTopGallery';
import { clampPhotoPositionY } from '@/lib/photoPosition';
import {
  currentIndexAfterMoveToFront,
  currentIndexAfterSwap,
  movePhotoToFront,
  swapPhotoWithNext,
  swapPhotoWithPrev,
} from '@/lib/photoOrder';
import styles from './PhotoEditCard.module.css';

export type Photo = {
  url: string;
  /** 縦方向のトリミング位置 0=上 100=下（object-position: center Y%） */
  position?: number;
};

type Props = {
  uid: string;
  photos: Photo[];
  setPhotos?: React.Dispatch<React.SetStateAction<Photo[]>>; // optional に変更
  onSavedPhotos?: (photos: Photo[]) => void;
  /** false のとき下部カルーセル非表示（上部ギャラリーと併用時） */
  showPhotoCarousel?: boolean;
};

function resizeImage(file: File, maxWidth = 800): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      const scale = maxWidth / img.width;
      const canvas = document.createElement('canvas');
      canvas.width = maxWidth;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, 'image/jpeg', 0.8);
    };

    reader.readAsDataURL(file);
  });
}

export default function PhotoSliderBlock({
  uid,
  photos,
  setPhotos,
  onSavedPhotos,
  showPhotoCarousel = true,
}: Props) {
  const [current, setCurrent] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [pickedNames, setPickedNames] = useState<string[]>([]);
  const [isSavingPhotos, setIsSavingPhotos] = useState(false);
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    setCurrent((c) => (photos.length === 0 ? 0 : Math.min(c, photos.length - 1)));
  }, [photos.length]);

  const setPositionY = useCallback(
    (y: number) => {
      if (!setPhotos) return;
      const nextY = clampPhotoPositionY(y);
      setPhotos((prev) =>
        prev.map((p, i) => (i === current ? { ...p, position: nextY } : p))
      );
    },
    [setPhotos, current]
  );

  const setMainPhoto = useCallback(
    (photoIndex: number) => {
      if (!setPhotos) return;
      setPhotos((prev) => movePhotoToFront(prev, photoIndex));
      setCurrent((c) => currentIndexAfterMoveToFront(photoIndex, c));
    },
    [setPhotos]
  );

  const movePhotoLeft = useCallback(
    (photoIndex: number) => {
      if (!setPhotos || photoIndex <= 0) return;
      const i = photoIndex;
      const j = i - 1;
      setPhotos((prev) => swapPhotoWithPrev(prev, i));
      setCurrent((c) => currentIndexAfterSwap(j, i, c));
    },
    [setPhotos]
  );

  const movePhotoRight = useCallback(
    (photoIndex: number) => {
      if (!setPhotos) return;
      const i = photoIndex;
      const j = i + 1;
      setPhotos((prev) => swapPhotoWithNext(prev, i));
      setCurrent((c) => currentIndexAfterSwap(i, j, c));
    },
    [setPhotos]
  );

  const currentY = clampPhotoPositionY(photos[current]?.position);

  const processFileList = useCallback(
    async (files: FileList | null) => {
      if (!files || !setPhotos) return;
      const fileArr = Array.from(files).slice(0, 5);
      if (fileArr.length === 0) return;

      setPickedNames(fileArr.map((f) => f.name));

      const arr: Photo[] = [];
      for (const file of fileArr) {
        const resizedBlob = await resizeImage(file);
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.onerror = () => reject(new Error('read failed'));
          reader.readAsDataURL(resizedBlob);
        });
        arr.push({ url: dataUrl, position: 50 });
      }
      setPhotos([...arr]);
      setCurrent(0);
    },
    [setPhotos]
  );

  const handlePhotoInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    void processFileList(e.target.files);
    e.target.value = '';
  };

  const savePhotos = async () => {
    if (!setPhotos) return;
    if (photos.length === 0) {
      alert('❌ 写真がありません');
      return;
    }
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setIsSavingPhotos(true);
    try {
      const base64Images = photos
        .filter((p) => p.url.startsWith('data:image/')) // base64だけ抽出
        .map((p) => p.url);

      let uploaded: Photo[] = [];

      if (base64Images.length > 0) {
        // base64画像があればアップロード処理を行う
        const uploadRes = await fetch('/api/uploadPhotos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ base64Images }),
        });

        if (!uploadRes.ok) {
          const errorText = await uploadRes.text();
          console.error('❌ uploadPhotos API error:', errorText);
          alert('❌ 写真の保存に失敗しました\n' + errorText);
          throw new Error('アップロード失敗');
        }

        const data = await uploadRes.json();
        if (!Array.isArray(data.urls) || data.urls.length === 0) {
          throw new Error('画像アップロード結果が不正です');
        }

        uploaded = data.urls.map((url: string, i: number) => ({
          url,
          position: clampPhotoPositionY(photos[i]?.position),
        }));
      } else {
        // アップロードなし。既存URLのまま保存
        uploaded = photos.map((p) => ({
          url: p.url,
          position: clampPhotoPositionY(p.position),
        }));
      }

      // Firestoreに保存（共通処理）
      const res = await fetch(`/api/user/${uid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: { photos: uploaded } }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('❌ Firestore保存失敗:', errText);
        throw new Error('Firestore保存失敗');
      }

      setPickedNames([]);
      alert('✅ 写真が保存されました');
      onSavedPhotos?.(uploaded);
    } catch (e) {
      console.error('❌ 保存エラー:', e);
      alert('❌ 写真の保存に失敗しました\n' + (e as Error).message);
    } finally {
      saveInFlightRef.current = false;
      setIsSavingPhotos(false);
    }
  };

  const hasPendingPreview = photos.some((p) => p.url.startsWith('data:image/'));

  const statusLine = (() => {
    if (pickedNames.length > 0) {
      return (
        <>
          <span className={styles.statusStrong}>選択済み</span>
          ：{pickedNames.join('、')}
        </>
      );
    }
    if (hasPendingPreview) {
      return (
        <span className={styles.statusOk}>
          新しい画像をプレビュー中です。「写真を保存」でアップロード・反映されます。
        </span>
      );
    }
    if (photos.length > 0) {
      return <>登録中の写真 {photos.length} 枚。変更した場合は「写真を保存」で確定してください。</>;
    }
    return <>まだ写真がありません。下のエリアから画像を追加してください。</>;
  })();

  return (
    <>
      {showPhotoCarousel ? (
        <PhotoSlider
          photos={photos}
          current={current}
          onPrev={() => setCurrent((c) => (c === 0 ? photos.length - 1 : c - 1))}
          onNext={() => setCurrent((c) => (c === photos.length - 1 ? 0 : c + 1))}
        />
      ) : null}

      {!showPhotoCarousel && setPhotos && photos.length > 0 ? (
        <>
          <UserPageTopGallery
            photos={photos}
            activeIndex={current}
            onActiveIndexChange={setCurrent}
            enableDragPosition
            onDragPositionY={setPositionY}
          />
          <div className={styles.positionStrip}>
            <p className={styles.positionTitle}>
              表示の調整
              {photos.length > 1 ? (
                <span className={styles.positionEditingBadge}>（写真 {current + 1} を編集中）</span>
              ) : null}
            </p>
            {photos.length > 1 ? (
              <div className={styles.photoIndexRow} role="group" aria-label="調整する写真">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={i === current ? styles.idxActive : styles.idxBtn}
                    onClick={() => setCurrent(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            ) : null}
            <p className={styles.dragHint}>画像を上下にドラッグしても調整できます。</p>
            <div className={styles.positionRow}>
              <label className={styles.positionLabel} htmlFor="photoPositionY">
                縦の位置 {currentY}%
              </label>
              <input
                id="photoPositionY"
                className={styles.positionRange}
                type="range"
                min={0}
                max={100}
                value={currentY}
                onChange={(e) => setPositionY(Number(e.target.value))}
              />
            </div>
            <div className={styles.positionPresets}>
              <button type="button" className={styles.presetBtn} onClick={() => setPositionY(0)}>
                上
              </button>
              <button type="button" className={styles.presetBtn} onClick={() => setPositionY(50)}>
                中央
              </button>
              <button type="button" className={styles.presetBtn} onClick={() => setPositionY(100)}>
                下
              </button>
            </div>
            <p className={styles.positionHint}>上のプレビューにすぐ反映されます。「写真を保存」で確定してください。</p>
          </div>
        </>
      ) : null}

      {setPhotos && (
        <div
          className={`${styles.wrapper} ${showPhotoCarousel ? styles.wrapperLegacy : ''} photo-upload auth-only`}
        >
          <div className={styles.card}>
            <h2 className={styles.title}>プロフィール写真の管理</h2>
            <p className={styles.desc}>
              最大5枚まで登録できます。上部ギャラリーの写真をここで追加・差し替えできます。
              並び順の先頭がメイン写真で、ユーザーページを開いたときの中央表示になります。
            </p>

            {photos.length > 0 ? (
              <div className={styles.reorderSection}>
                <p className={styles.reorderTitle}>写真の並び順</p>
                <p className={styles.reorderHint}>
                  「メインにする」で先頭へ。「左へ」「右へ」で隣と入れ替えます。保存までは未反映の画面だけ変わります。
                </p>
                <ul className={styles.reorderList}>
                  {photos.map((p, i) => (
                    <li key={`${p.url}-${i}`} className={styles.reorderRow}>
                      <span className={styles.reorderIndex}>{i + 1}</span>
                      <div className={styles.reorderThumbWrap}>
                        <img
                          src={p.url}
                          alt=""
                          className={styles.reorderThumb}
                          style={{ objectPosition: `center ${clampPhotoPositionY(p.position)}%` }}
                          draggable={false}
                        />
                      </div>
                      <div className={styles.reorderMeta}>
                        {i === 0 ? (
                          <span className={styles.mainBadge}>メイン</span>
                        ) : (
                          <button
                            type="button"
                            className={styles.mainBtn}
                            onClick={() => setMainPhoto(i)}
                          >
                            メインにする
                          </button>
                        )}
                      </div>
                      <div className={styles.reorderMove}>
                        <button
                          type="button"
                          className={styles.moveBtn}
                          disabled={i === 0}
                          onClick={() => movePhotoLeft(i)}
                          aria-label={`写真 ${i + 1} を左へ`}
                        >
                          左へ
                        </button>
                        <button
                          type="button"
                          className={styles.moveBtn}
                          disabled={i >= photos.length - 1}
                          onClick={() => movePhotoRight(i)}
                          aria-label={`写真 ${i + 1} を右へ`}
                        >
                          右へ
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className={styles.actions}>
              <label
                htmlFor="photoInput"
                className={`${styles.dropZone} ${dragOver ? styles.dragOver : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  const next = e.relatedTarget as Node | null;
                  if (next && e.currentTarget.contains(next)) return;
                  setDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(false);
                  void processFileList(e.dataTransfer.files);
                }}
              >
                <p className={styles.dropHint}>
                  クリックまたはドラッグ＆ドロップで追加（1〜5枚・JPEG/PNG など）
                </p>
                <span className={styles.chooseBtn}>画像を選択</span>
              </label>

              <button
                type="button"
                id="savePhotosBtn"
                className={`${styles.saveBtn} ${isSavingPhotos ? styles.saveBtnBusy : ''}`}
                onClick={() => void savePhotos()}
                disabled={isSavingPhotos}
                aria-busy={isSavingPhotos}
              >
                {isSavingPhotos ? (
                  <span className={styles.saveBtnInner}>
                    <span className={styles.saveBtnSpinner} aria-hidden />
                    写真を保存中...
                  </span>
                ) : (
                  '写真を保存'
                )}
              </button>
            </div>

            <input
              type="file"
              accept="image/*"
              multiple
              id="photoInput"
              className={styles.visuallyHidden}
              onChange={handlePhotoInput}
              aria-label="プロフィール用の画像ファイルを選択"
            />

            <p className={styles.status}>{statusLine}</p>

            {showPhotoCarousel && photos.length > 0 ? (
              <div className={styles.positionBlock}>
                <p className={styles.positionTitle}>写真の見え方（トリミング位置）</p>
                {photos.length > 1 ? (
                  <div className={styles.photoIndexRow} role="group" aria-label="調整する写真">
                    {photos.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={i === current ? styles.idxActive : styles.idxBtn}
                        onClick={() => setCurrent(i)}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className={styles.positionRow}>
                  <label className={styles.positionLabel} htmlFor="photoPositionYLegacy">
                    縦の位置 {currentY}%
                  </label>
                  <input
                    id="photoPositionYLegacy"
                    className={styles.positionRange}
                    type="range"
                    min={0}
                    max={100}
                    value={currentY}
                    onChange={(e) => setPositionY(Number(e.target.value))}
                  />
                </div>
                <div className={styles.positionPresets}>
                  <button type="button" className={styles.presetBtn} onClick={() => setPositionY(0)}>
                    上
                  </button>
                  <button type="button" className={styles.presetBtn} onClick={() => setPositionY(50)}>
                    中央
                  </button>
                  <button type="button" className={styles.presetBtn} onClick={() => setPositionY(100)}>
                    下
                  </button>
                </div>
                <p className={styles.positionHint}>下部プレビューと連動します。「写真を保存」で確定してください。</p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
