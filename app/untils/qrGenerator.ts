declare var QRCode: any;

export const generateQRCode = async (canvas: HTMLCanvasElement, uid: string) => {
  const url = `${location.origin}/user/${uid}`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return alert('Canvasが取得できません');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const tempDiv = document.createElement('div');
  tempDiv.style.visibility = 'hidden';
  document.body.appendChild(tempDiv);

  new QRCode(tempDiv, {
    text: url,
    width: 200,
    height: 200,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  setTimeout(() => {
    const qrImg = tempDiv.querySelector('img');
    if (!qrImg) {
      alert('QRコードの生成に失敗しました');
      document.body.removeChild(tempDiv);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = qrImg.src;

    img.onload = () => {
      ctx.drawImage(img, 0, 0, 200, 200);

      const logo = new Image();
      logo.src = '/procom-logo.png';
      logo.onload = () => {
        ctx.drawImage(logo, 75, 75, 50, 50);
        document.body.removeChild(tempDiv);
      };

      logo.onerror = () => {
        console.warn('⚠️ ロゴ画像の読み込みに失敗しました');
        document.body.removeChild(tempDiv);
      };
    };
  }, 300);
};

export const downloadQRCode = async (canvas: HTMLCanvasElement) => {
  const dataUrl = canvas.toDataURL('image/png');
  let displayName = 'procom-user';

  try {
    const sessionRes = await fetch('/session');
    const session = await sessionRes.json();
    if (session.loggedIn && session.name) displayName = session.name;
  } catch (err) {
    console.warn('⚠ セッション取得に失敗しました。', err);
  }

  const sanitizedName = displayName
    .normalize("NFKD")
    .replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\w\-]/g, '_')
    .slice(0, 30);

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${sanitizedName || 'procom'}-qr.png`;
  link.click();
};
