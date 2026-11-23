'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import styles from './mypage.module.css';

type Props = {
  initialPublic: boolean;
};

export default function FanActivityVisibility({ initialPublic }: Props) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function choose(next: boolean) {
    if (busy || next === isPublic) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/fan-activity-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ public: next }),
      });
      const data = (await res.json().catch(() => null)) as { fanActivityPublic?: unknown; error?: unknown } | null;
      if (!res.ok || data?.fanActivityPublic !== next) {
        setError(typeof data?.error === 'string' ? data.error : '公開設定を保存できませんでした');
        return;
      }
      setIsPublic(next);
      router.refresh();
    } catch {
      setError('公開設定を保存できませんでした');
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className={styles.visibility} disabled={busy}>
      <legend className={styles.visibilityLegend}>応援履歴の公開</legend>
      <div className={styles.visibilityOptions}>
        <label className={styles.visibilityOption}>
          <input
            type="radio"
            name="fanActivityPublic"
            checked={!isPublic}
            onChange={() => void choose(false)}
          />
          非公開
        </label>
        <label className={styles.visibilityOption}>
          <input
            type="radio"
            name="fanActivityPublic"
            checked={isPublic}
            onChange={() => void choose(true)}
          />
          公開
        </label>
      </div>
      {error ? <p className={styles.fanIconError}>{error}</p> : null}
    </fieldset>
  );
}
