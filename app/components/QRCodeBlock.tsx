'use client';

import { useRef } from 'react';
import QRCodeLib from 'qrcode';

export default function QRCodeBlock() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ⬇️ QRコード生成（ロゴ付き）
  const handleGenerate = async () => {
    const uid = location.pathname.split('/').pop();
    const url = `${location.origin}/user/${uid}`;
    const canvas = canvasRef.current;
    if (!canvas) return alert('❌ canvas要素が見つかりません');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const tempDiv = document.createElement('div');
    tempDiv.style.visibility = 'hidden';
    document.body.appendChild(tempDiv);

    new (window as any).QRCode(tempDiv, {
      text: url,
      width: 200,
      height: 200,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: (window as any).QRCode.CorrectLevel.H,
    });

    setTimeout(() => {
      const qrImg = tempDiv.querySelector('img') as HTMLImageElement;
      if (!qrImg) {
        alert('QRコードの生成に失敗しました');
        document.body.removeChild(tempDiv);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = qrImg.src;

      img.onload = () => {
        ctx.drawImage(img, 0, 0, 200, 200);

        const logo = new Image();
        logo.src = '/procom-logo.png';

        logo.onload = () => {
          const size = 50;
          const x = (canvas.width - size) / 2;
          const y = (canvas.height - size) / 2;
          ctx.drawImage(logo, x, y, size, size);
          document.body.removeChild(tempDiv);
        };

        logo.onerror = () => {
          console.warn('⚠️ ロゴ画像の読み込みに失敗しました');
          document.body.removeChild(tempDiv);
        };
      };
    }, 300);
  };

const handleDownload = async () => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const dataUrl = canvas.toDataURL('image/png');

  const uid = location.pathname.split('/').pop();
  let displayName = 'procom-user';

  try {
    const res = await fetch(`/api/user/${uid}`);
    const data = await res.json();
    displayName = data.profile?.name || 'procom-user';
  } catch (err) {
    console.warn('⚠ ユーザーデータ取得に失敗:', err);
  }

  const sanitizedName = displayName
    .normalize('NFKD')
    .replace(/[^\w\-一-龥ぁ-んァ-ヶａ-ｚＡ-Ｚ０-９]/g, '_')
    .slice(0, 30);

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${sanitizedName || 'procom'}-qr.png`;
  link.click();
};


  return (
    <div className="qr-section" style={{ textAlign: 'center', margin: '30px 0' }}>
      <h2>QRコード</h2>
      <canvas
        id="qrCanvas"
        ref={canvasRef}
        width={200}
        height={200}
        style={{
          background: '#fff',
          padding: '8px',
          margin: '0 auto',
          display: 'block'
        }}
      />
      <div style={{ marginTop: '10px' }}>
        <button id="generateQrBtn" onClick={handleGenerate}>
          📱 QRコードを生成
        </button>
        <br />
        <button id="downloadQrBtn" onClick={handleDownload} style={{ marginTop: '10px' }}>
          📥 QRコードをダウンロード
        </button>
      </div>
    </div>
  );
}
