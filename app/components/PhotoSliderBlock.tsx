'use client';

import React, { useState } from 'react';
import PhotoSlider from '@/components/PhotoSlider';

type Photo = {
  url: string;
  position?: string;
};

type Props = {
  uid: string;
  photos: Photo[];
  setPhotos: React.Dispatch<React.SetStateAction<Photo[]>>;
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

export default function PhotoSliderBlock({ uid, photos, setPhotos }: Props) {
  const [current, setCurrent] = useState(0); // スライダーの現在位置を管理

  // 📤 ファイル読み込み・スライダー更新
  const handlePhotoInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const arr: Photo[] = [];

    for (const file of Array.from(files).slice(0, 5)) {
      const resizedBlob = await resizeImage(file); // ✅ リサイズする
      const reader = new FileReader();

      reader.onload = ev => {
        arr.push({ url: ev.target?.result as string, position: '50' });

        if (arr.length === Math.min(files.length, 5)) {
          setPhotos([...arr]);
          setCurrent(0);
        }
      };

      reader.readAsDataURL(resizedBlob); // ✅ リサイズ後の画像をbase64に変換
    }
  };

  // 📍 object-position のスライダー操作
  const handlePositionChange = (index: number, value: string) => {
    setPhotos(prev =>
      prev.map((photo, i) =>
        i === index ? { ...photo, position: value } : photo
      )
    );
  };

// 💾 写真をStorageへまとめてアップロード → FirestoreへURLと位置を保存
const savePhotos = async () => {
  try {
    if (photos.length === 0) {
      alert('❌ 写真がありません');
      return;
    }

    // base64だけ抽出
    const base64Images = photos.map(p => p.url);
    console.log('📤 送信する画像数:', base64Images.length);
    console.log('🖼️ 最初の画像の先頭:', base64Images[0]?.slice(0, 50));

    // 🔁 一括アップロードAPIに送信
    const uploadRes = await fetch('/api/uploadPhotos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ base64Images }),
    });

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();  // ← HTMLかJSON文字列になる
      console.error('❌ uploadPhotos API error:', errorText);
      alert('❌ 写真の保存に失敗しました\n' + errorText);
      throw new Error('アップロード失敗');
    }

    const data = await uploadRes.json(); // { urls: [...] }
    if (!Array.isArray(data.urls) || data.urls.length === 0) {
      throw new Error('画像アップロード結果が不正です');
    }

    const uploaded = data.urls.map((url: string, i: number) => ({
      url,
      position: photos[i].position ?? '50',
    }));

    console.log('✅ アップロード成功:', uploaded);

    // Firestoreに保存（uidで指定）
    const res = await fetch(`/api/user/${uid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: {
          photos: uploaded,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('❌ Firestore保存失敗:', errText);
      throw new Error('Firestore保存失敗');
    }

    alert('✅ 写真が保存されました');
  } catch (e) {
    console.error('❌ 保存エラー:', e);
    alert('❌ 写真の保存に失敗しました\n' + (e as Error).message);
  }
};


  return (
    <>
      <PhotoSlider
        photos={photos}
        current={current}
        onPrev={() => setCurrent(c => (c === 0 ? photos.length - 1 : c - 1))}
        onNext={() => setCurrent(c => (c === photos.length - 1 ? 0 : c + 1))}
        onPositionChange={handlePositionChange}
      />

      <div className="photo-upload auth-only" style={{ textAlign: 'center', marginTop: 20 }}>
        <h3 style={{ marginBottom: 10 }}>写真を登録 (最大5枚)</h3>
        <input
          type="file"
          accept="image/*"
          multiple
          id="photoInput"
          onChange={handlePhotoInput}
          style={{ marginBottom: 10 }}
        />
        <br />
        <button
          type="button"
          id="savePhotosBtn"
          onClick={savePhotos}
          style={{
            backgroundColor: '#4f7cf7',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          写真を保存
        </button>
      </div>
    </>
  );
}
