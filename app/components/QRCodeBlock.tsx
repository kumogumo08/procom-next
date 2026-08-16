'use client';

import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import QRCodeLib from 'qrcode';
import { fetchUserApi } from '@/lib/userProfileClient';
import { buttonPrimary, cardBase } from '@/components/ui/cardStyles';

const QR_SIZE = 220;

const headingStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: '1.25rem',
  marginBottom: 16,
  fontWeight: 800,
};

const descStyle: CSSProperties = {
  margin: '0 0 20px',
  fontSize: 14,
  lineHeight: 1.7,
  color: '#475569',
};

const buttonSecondary: CSSProperties = {
  height: 40,
  padding: '0 14px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#0f172a',
  fontWeight: 700,
  cursor: 'pointer',
};

function getProfileUrl(uid: string) {
  return `${location.origin}/user/${uid}`;
}

function getUidFromPath() {
  return location.pathname.split('/').pop() ?? '';
}

export default function QRCodeBlock({
  initialName,
  uid: uidProp,
}: {
  initialName?: string;
  uid?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'ok' | 'warn'>('ok');

  const resolveUid = () => uidProp || getUidFromPath();
  const resolveUrl = () => getProfileUrl(resolveUid());

  const showMessage = (text: string, tone: 'ok' | 'warn' = 'ok') => {
    setMessageTone(tone);
    setMessage(text);
    window.setTimeout(() => setMessage(null), 2500);
  };

  const handleGenerate = async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      showMessage('QRコードの生成に失敗しました', 'warn');
      return;
    }

    setGenerating(true);
    try {
      await QRCodeLib.toCanvas(canvas, resolveUrl(), {
        width: QR_SIZE,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#000000', light: '#ffffff' },
      });
      setGenerated(true);
    } catch {
      showMessage('QRコードの生成に失敗しました', 'warn');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      showMessage('画像をダウンロードしてください', 'warn');
      return;
    }

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png');
      });

      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('clipboard unsupported');
      }

      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      } catch {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': Promise.resolve(blob) }),
        ]);
      }
      showMessage('QRコードをコピーしました');
    } catch {
      showMessage('画像をダウンロードしてください', 'warn');
    }
  };

  const handleCopyUrl = async () => {
    const url = resolveUrl();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('execCommand');
      }
      showMessage('URLをコピーしました');
    } catch {
      showMessage('URLのコピーに失敗しました', 'warn');
    }
  };

  const handleDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');

    const uid = resolveUid();
    const displayName =
      initialName ||
      (await (async () => {
        try {
          const data = await fetchUserApi(uid, {
            caller: 'QRCodeBlock',
            reason: 'download (get displayName)',
          });
          return data.profile?.name || 'procom-user';
        } catch (err) {
          console.warn('⚠ ユーザーデータ取得に失敗:', err);
          return 'procom-user';
        }
      })());

    const sanitizedName = displayName
      .normalize('NFKD')
      .replace(/[^\w\-一-龥ぁ-んァ-ヶａ-ｚＡ-Ｚ０-９]/g, '_')
      .slice(0, 30);

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `procom-qr-${sanitizedName || 'user'}.png`;
    link.click();
  };

  return (
    <section className="qr-section" style={{ ...cardBase, width: '100%', textAlign: 'center' }}>
      <h2 style={headingStyle}>QRコードでプロフィールをシェア</h2>

      {!generated ? (
        <>
          <p style={descStyle}>
            名刺やフライヤー、イベント告知などに
            <br />
            あなたのProcomプロフィールを掲載できます。
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            style={{
              ...buttonPrimary,
              opacity: generating ? 0.7 : 1,
              cursor: generating ? 'wait' : 'pointer',
            }}
          >
            {generating ? '作成中…' : 'QRコードを表示'}
          </button>
        </>
      ) : null}

      <div
        style={{
          display: generated ? 'flex' : 'none',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 16,
            boxSizing: 'border-box',
          }}
        >
          <canvas
            id="qrCanvas"
            ref={canvasRef}
            width={QR_SIZE}
            height={QR_SIZE}
            style={{
              display: 'block',
              width: 'min(220px, 70vw)',
              height: 'auto',
              maxWidth: '100%',
            }}
          />
        </div>

        <p style={{ ...descStyle, marginBottom: 0 }}>
          名刺・フライヤー・SNS画像などに利用できます。
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 10,
            width: '100%',
          }}
        >
          <button type="button" onClick={handleCopyImage} style={buttonPrimary}>
            QRコードをコピー
          </button>
          <button type="button" onClick={handleDownload} style={buttonSecondary}>
            画像をダウンロード
          </button>
          <button type="button" onClick={handleCopyUrl} style={buttonSecondary}>
            URLをコピー
          </button>
        </div>
      </div>

      {message ? (
        <p
          role="status"
          style={{
            margin: '14px 0 0',
            fontSize: 13,
            fontWeight: 600,
            color: messageTone === 'ok' ? '#15803d' : '#b45309',
          }}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
