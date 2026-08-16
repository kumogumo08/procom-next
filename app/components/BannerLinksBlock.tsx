'use client';

import { useState, useEffect, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from './utils/cropImage'; // 後述の関数を別ファイルに置くと良い
import type { Area } from 'react-easy-crop';
import SnsVisibilityToggle from './SnsVisibilityToggle';
import { cardBase } from '@/components/ui/cardStyles';


type Banner = {
  imageUrl: string;
  linkUrl: string;
  visible?: boolean;
};

type Props = {
  uid: string;
  isEditable: boolean;
};

export default function BannerLinksBlock({ uid, isEditable }: Props) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const [showBanners, setShowBanners] = useState(true);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  const handleVisibleChange = (index: number, value: boolean) => {
    const newBanners = [...banners];
    newBanners[index] = {
      ...newBanners[index],
      visible: value,
    };
    setBanners(newBanners);
  };

  const uploadBase64ToStorage = async (base64Data: string, uid: string, index: number): Promise<string> => {
    // base64 → Blob
    const blob = await (await fetch(base64Data)).blob();
    const file = new File([blob], `banner-${index}.jpg`, { type: blob.type });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('uid', uid);
    formData.append('index', index.toString());

    const res = await fetch('/api/upload-banner', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      console.error('❌ アップロードに失敗しました');
      throw new Error('アップロード失敗');
    }

    const result = await res.json();
    return result.imageUrl; // ← API から返される画像URLを使用
  };

  const saveBannersToServer = async () => {
    try {
      const uploadedBanners = await Promise.all(
        banners.map(async (b, i) => {
          const url = b.imageUrl.startsWith('data:')
            ? await uploadBase64ToStorage(b.imageUrl, uid, i)
            : b.imageUrl;
          return {
            imageUrl: url,
            linkUrl: b.linkUrl,
            visible: b.visible ?? true,
          };
        })
      );

      const res = await fetch('/api/banner-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bannerLinks: uploadedBanners,
          showBanners, // ✅ 🔥 ← これを追加！
        }),
      });

      if (!res.ok) throw new Error('保存失敗');

      alert('✅ リンクを保存しました！');
    } catch (err) {
      console.error('❌ 保存エラー:', err);
      alert('保存に失敗しました');
    }
  };

  useEffect(() => {
    if (!uid) return;

    const fetchBannerLinks = async () => {
      try {
        const res = await fetch(`/api/banner-links?uid=${encodeURIComponent(uid)}`);
        if (!res.ok) throw new Error('取得失敗');
        const data = await res.json();

        console.log('🔥 取得したデータ:', data);

        const links = data.bannerLinks ?? [];
        const padded = [...links];
        while (padded.length < 3) {
          padded.push({ imageUrl: '', linkUrl: '' });
        }

        setBanners(padded);
        setShowBanners(data.settings?.showBanners ?? true);
      } catch (err) {
        console.error('❌ バナーリンク取得失敗:', err);
      }
    };

    fetchBannerLinks();
  }, [uid]);


  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const newBanners = [...banners];
      setOriginalImageUrl(newBanners[index]?.imageUrl ?? null);
      newBanners[index] = {
        ...newBanners[index],
        imageUrl: reader.result as string,
      };
      setBanners(newBanners);
      setCropIndex(index);

      // ✅ ファイル読み込み完了後に input の value をリセット
      input.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = useCallback((_: any, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const applyCrop = async () => {
    if (cropIndex === null || croppedAreaPixels === null) return;
    const cropped = await getCroppedImg(banners[cropIndex].imageUrl, croppedAreaPixels);
    const updated = [...banners];
    updated[cropIndex] = { ...updated[cropIndex], imageUrl: cropped };
    setBanners(updated);
    setCropIndex(null);
  };

  const handleLinkChange = (index: number, value: string) => {
    const newBanners = [...banners];
    newBanners[index] = {
      ...newBanners[index],
      linkUrl: value,
    };
    setBanners(newBanners);
  };

  const handleDeleteBanner = (index: number) => {
    const newBanners = [...banners];
    newBanners[index] = { imageUrl: '', linkUrl: '', visible: true };
    setBanners(newBanners);
  };

  const renderBannerInput = (banner: Banner, index: number) => (
    <div key={index} className="banner-item" style={{ position: 'relative', width: '100%' }}>
      <input type="file" accept="image/*" onChange={(e) => handleImageChange(e, index)} />
      <input
        type="text"
        placeholder="リンク先のURLを入力"
        value={banner.linkUrl}
        onChange={(e) => handleLinkChange(index, e.target.value)}
        style={{ width: '100%', marginTop: '8px' }}
      />
      {banner?.imageUrl && (
        <div style={{ position: 'relative', display: 'block', width: '100%' }}>
          <a href={banner.linkUrl || '#'} target="_blank" rel="noopener noreferrer">
            <img
              src={banner.imageUrl}
              alt={`バナー${index + 1}`}
              style={{
                marginTop: '10px',
                display: 'block',
                width: '100%',
                maxWidth: '100%',
                height: 'auto',
                borderRadius: '6px',
                objectFit: 'contain',
              }}
            />
          </a>
          {/* ✕ 削除ボタン */}
          <button
            onClick={() => handleDeleteBanner(index)}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              backgroundColor: '#f44336',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              fontSize: '18px',
              fontWeight: 'bold',
              lineHeight: '28px',
              textAlign: 'center',
              cursor: 'pointer',
              boxShadow: '0 0 6px rgba(0,0,0,0.3)',
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );

  const visibleBanners = banners.filter((b) =>
    Boolean(b.imageUrl?.trim() && b.linkUrl?.trim() && (b.visible ?? true))
  );
  const hasBannerContent = visibleBanners.length > 0;
  if (!isEditable && !(showBanners && hasBannerContent)) {
    return null;
  }

  return (
    <section className="banner-section" style={{ ...cardBase, width: '100%' }}>
      <h2 style={{ textAlign: 'center', fontSize: '1.25rem', marginBottom: 16, fontWeight: 800 }}>
        リンク
      </h2>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          width: '100%',
          maxWidth: 960,
          margin: '0 auto',
        }}
      >
      {isEditable ? (
        <>
          {[0, 1, 2].map((i) =>
            renderBannerInput(banners[i] || { imageUrl: '', linkUrl: '', visible: true }, i)
          )}
        </>
      ) : (
        <>
          {visibleBanners
            .map((b, i) => (
              <a
                key={i}
                href={b.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', width: '100%' }}
              >
                <img
                  src={b.imageUrl}
                  alt={`バナー${i + 1}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    maxWidth: '100%',
                    height: 'auto',
                    objectFit: 'contain',
                    borderRadius: '6px',
                  }}
                />
              </a>
            ))}
        </>
      )}
      </div>

      {isEditable && (
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button
            onClick={saveBannersToServer}
            style={{
              background: '#4e73df',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px', // ← 少し大きめでもOK
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            保存
          </button>
          {isEditable && (
            <SnsVisibilityToggle
              label="バナーリンクを表示する"
              checked={showBanners}
              onChange={setShowBanners}
            />
          )}
        </div>
      )}

      {/* 🔽 トリミングUI（モーダル風） */}
      {cropIndex !== null && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: '#000a', zIndex: 9999 }}>
          <div style={{ width: '100%', height: '80vh', position: 'relative' }}>
            <Cropper
              image={banners[cropIndex]?.imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={3 / 1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          </div>

          {/* ❗ここにボタンが必要 */}
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={applyCrop}
              className="bg-green-500 hover:bg-green-600 text-white py-2 px-5 rounded-lg shadow"
            >
              ✅ 切り取り
            </button>
            <button
              onClick={() => {
                if (cropIndex !== null && originalImageUrl !== null) {
                  const updated = [...banners];
                  updated[cropIndex] = {
                    ...updated[cropIndex],
                    imageUrl: originalImageUrl,
                  };
                  setBanners(updated);
                }
                setCropIndex(null);
                setOriginalImageUrl(null);
              }}
              className="bg-red-500 hover:bg-red-600 text-white py-2 px-5 rounded-lg shadow"
            >
              キャンセル
            </button>

            {/* ✅ ← この「適用」ボタンが**ないため**切り取りできない */}
          </div>
        </div>
      )}
    </section>
  );
}

