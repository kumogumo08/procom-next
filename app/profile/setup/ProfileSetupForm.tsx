'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ONBOARDING_TEXT_MAX } from '@/lib/onboarding';
import { readSetupText } from '@/lib/onboardingSetup';
import styles from './ProfileSetupForm.module.css';

type Props = {
  uid: string;
  initialName: string;
  initialTitle: string;
  initialPhotoUrl: string;
  initialPhotoOwned: boolean;
};

type FieldErrors = {
  name?: string;
  title?: string;
  photo?: string;
  form?: string;
};

export default function ProfileSetupForm({
  uid,
  initialName,
  initialTitle,
  initialPhotoUrl,
  initialPhotoOwned,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [title, setTitle] = useState(initialTitle);
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [photoOwned, setPhotoOwned] = useState(initialPhotoOwned);
  const [previewUrl, setPreviewUrl] = useState(initialPhotoUrl);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState('');
  const [done, setDone] = useState(false);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const nameOk = readSetupText(name, '名前').ok;
  const titleOk = readSetupText(title, '肩書き').ok;
  const canPublish = nameOk && titleOk && photoOwned && !busy && !done;

  function begin() {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setStatus('');
    return true;
  }

  function finish() {
    busyRef.current = false;
    setBusy(false);
  }

  function applyError(data: { error?: string; field?: string }) {
    const message = data.error || '保存できませんでした';
    if (data.field === 'name' || data.field === 'title' || data.field === 'photo') {
      setErrors({ [data.field]: message });
      return;
    }
    setErrors({ form: message });
  }

  async function onSelectFile(file: File | undefined) {
    if (!file || !begin()) return;
    setErrors({});
    try {
      const dataUrl = await readFile(file);
      const res = await fetch('/api/profile/setup/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.url !== 'string') {
        applyError(data);
        return;
      }
      setPhotoUrl(data.url);
      setPreviewUrl(data.url);
      setPhotoOwned(true);
      setStatus('画像を保存しました。ログアウトしても、このページで続きから再開できます。');
    } catch {
      setErrors({ photo: '画像の保存に失敗しました' });
    } finally {
      finish();
    }
  }

  async function saveDraft() {
    if (!begin()) return;
    const nextErrors: FieldErrors = {};
    const payload: { name?: string; title?: string; photoUrl?: string } = {};
    if (name.trim()) {
      const nameResult = readSetupText(name, '名前');
      if (!nameResult.ok) nextErrors.name = nameResult.error;
      else payload.name = name;
    }
    if (title.trim()) {
      const titleResult = readSetupText(title, '肩書き');
      if (!titleResult.ok) nextErrors.title = titleResult.error;
      else payload.title = title;
    }
    if (photoOwned && photoUrl) payload.photoUrl = photoUrl;
    if (!payload.name && !payload.title && !payload.photoUrl) {
      nextErrors.form = '保存できる項目がありません';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      finish();
      return;
    }
    setErrors({});
    try {
      const res = await fetch('/api/profile/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        applyError(data);
        return;
      }
      setStatus('保存しました。ログアウトしても、ログイン後にこのページを開けば続きから入力できます。');
    } catch {
      setErrors({ form: '保存に失敗しました' });
    } finally {
      finish();
    }
  }

  async function publish() {
    if (!canPublish || !begin()) return;
    setErrors({});
    try {
      const res = await fetch('/api/profile/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, title, photoUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 409) {
        applyError(data);
        return;
      }
      setDone(true);
      router.push(`/user/${uid}`);
    } catch {
      setErrors({ form: '公開処理に失敗しました' });
    } finally {
      finish();
    }
  }

  return (
    <section className={styles.card}>
      <h1 className={styles.title}>プロフィールを作成しましょう</h1>
      <p className={styles.lead}>まずは3つの基本情報を設定してください。</p>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void publish();
        }}
      >
        <div className={styles.photo}>
          {previewUrl ? (
            <img className={styles.preview} src={previewUrl} alt="プロフィール画像のプレビュー" />
          ) : (
            <div className={styles.placeholder}>画像未設定</div>
          )}
          <input
            id="setup-photo"
            className={styles.file}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy || done}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              void onSelectFile(file);
            }}
          />
          <label className={`${styles.fileLabel} ${busy || done ? styles.fileLabelDisabled : ''}`} htmlFor="setup-photo">
            {photoOwned ? '画像を変更' : '画像を選択'}
            <span className={styles.required}>必須</span>
          </label>
          {errors.photo ? <p className={styles.error}>{errors.photo}</p> : null}
        </div>

        <label className={styles.field}>
          <span>
            名前・活動名
            <span className={styles.required}>必須</span>
          </span>
          <input
            value={name}
            maxLength={ONBOARDING_TEXT_MAX}
            disabled={busy || done}
            onChange={(event) => setName(event.target.value)}
          />
          {errors.name ? <p className={styles.error}>{errors.name}</p> : null}
        </label>

        <label className={styles.field}>
          <span>
            肩書き
            <span className={styles.required}>必須</span>
          </span>
          <input
            value={title}
            maxLength={ONBOARDING_TEXT_MAX}
            disabled={busy || done}
            onChange={(event) => setTitle(event.target.value)}
          />
          {errors.title ? <p className={styles.error}>{errors.title}</p> : null}
        </label>

        {errors.form ? <p className={styles.error}>{errors.form}</p> : null}
        {status ? <p className={styles.status}>{status}</p> : null}

        <div className={styles.actions}>
          <button className={styles.publish} type="submit" disabled={!canPublish}>
            {busy ? '保存しています' : 'プロフィールを公開する'}
          </button>
          <button className={styles.save} type="button" disabled={busy || done} onClick={() => void saveDraft()}>
            保存して中断
          </button>
        </div>
        <p className={styles.note}>
          名前、肩書き、画像が揃うと公開できます。保存した内容は、ログアウト後にこのページを開き直すと戻ります。
        </p>
      </form>
    </section>
  );
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}
