'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FAN_ICON_MAX_BYTES } from '@/lib/fanIcon';

import styles from './mypage.module.css';

type Props = {
  initialUrl: string | null;
};

function FanPersonIcon() {
  return (
    <svg className={styles.fanGlyph} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M5 19.5a7 7 0 0 1 14 0" />
    </svg>
  );
}

export default function FanIconEditor({ initialUrl }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSelect(file: File | null) {
    if (!file || busy) return;
    if (file.size <= 0 || file.size > FAN_ICON_MAX_BYTES) {
      setError('画像は2MB以下にしてください');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('画像はJPEG、PNG、WebPにしてください');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.set('file', file);
      const res = await fetch('/api/fan-icon', { method: 'POST', body, credentials: 'include' });
      const data = (await res.json().catch(() => null)) as { fanIconUrl?: unknown; error?: unknown } | null;
      if (!res.ok || typeof data?.fanIconUrl !== 'string') {
        setError(typeof data?.error === 'string' ? data.error : '画像を保存できませんでした');
        return;
      }
      setUrl(data.fanIconUrl);
      router.refresh();
    } catch {
      setError('画像を保存できませんでした');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (busy || !url) return;
    if (!confirm('アイコン画像を削除しますか？')) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/fan-icon', { method: 'DELETE', credentials: 'include' });
      const data = (await res.json().catch(() => null)) as { fanIconUrl?: unknown; error?: unknown } | null;
      if (!res.ok || data?.fanIconUrl !== null) {
        setError(typeof data?.error === 'string' ? data.error : '画像を削除できませんでした');
        return;
      }
      setUrl(null);
      router.refresh();
    } catch {
      setError('画像を削除できませんでした');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.fanIconColumn}>
      <label className={styles.fanIconButton}>
        <input
          className={styles.fanIconInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="アイコン画像を選択"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.target.value = '';
            void onSelect(file);
          }}
        />
        <span className={styles.fanIcon}>
          {url ? <img src={url} alt="" className={styles.fanIconImage} /> : <FanPersonIcon />}
        </span>
      </label>
      {url ? (
        <button type="button" className={styles.fanIconDelete} onClick={() => void onDelete()} disabled={busy}>
          アイコンを削除
        </button>
      ) : null}
      {error ? <p className={styles.fanIconError}>{error}</p> : null}
    </div>
  );
}
