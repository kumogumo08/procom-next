'use client';

import { useState } from 'react';
import { ONBOARDING_TEXT_MAX } from '@/lib/onboarding';

type Props = {
  name: string;
  title: string;
  isEditable: boolean;
  isSaving: boolean;
  onChange: (next: { name: string; title: string }) => void;
  onSave: () => Promise<boolean>;
  readSaveError: () => string;
};

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
      />
    </svg>
  );
}

export default function ProfileHeader({
  name,
  title,
  isEditable,
  isSaving,
  onChange,
  onSave,
  readSaveError,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftTitle, setDraftTitle] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const displayName = name.trim();
  const displayTitle = title.trim();

  if (!isEditable && !displayName && !displayTitle) return null;

  function begin() {
    setDraftName(name);
    setDraftTitle(title);
    setError(null);
    setEditing(true);
  }

  function update(nextName: string, nextTitle: string) {
    setDraftName(nextName);
    setDraftTitle(nextTitle);
    onChange({ name: nextName, title: nextTitle });
  }

  function cancel() {
    onChange({ name, title });
    setDraftName(name);
    setDraftTitle(title);
    setError(null);
    setEditing(false);
  }

  async function save() {
    if (isSaving) return;
    setError(null);
    const ok = await onSave();
    if (ok) {
      setEditing(false);
      return;
    }
    setError(readSaveError() || '保存に失敗しました');
  }

  return (
    <header className="profile-page-heading">
      <p className="profile-page-heading__kicker" lang="en" aria-hidden="true">
        CREATOR PROFILE
      </p>
      {editing ? (
        <form
          className="profile-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="profile-inline-field">
            <span className="sr-only">名前</span>
            <input
              className="profile-inline-input profile-inline-input--name"
              value={draftName}
              maxLength={Math.max(ONBOARDING_TEXT_MAX, draftName.length)}
              aria-label="名前"
              onChange={(event) => update(event.target.value, draftTitle)}
            />
          </label>
          <label className="profile-inline-field">
            <span className="sr-only">肩書</span>
            <input
              className="profile-inline-input profile-inline-input--title"
              value={draftTitle}
              maxLength={Math.max(ONBOARDING_TEXT_MAX, draftTitle.length)}
              aria-label="肩書"
              onChange={(event) => update(draftName, event.target.value)}
            />
          </label>
          <div className="profile-inline-actions">
            <button type="submit" className="profile-text-btn" disabled={isSaving}>
              {isSaving ? '保存中...' : '保存'}
            </button>
            <button type="button" className="profile-inline-cancel" onClick={cancel} disabled={isSaving}>
              キャンセル
            </button>
          </div>
          {error ? (
            <p className="profile-inline-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <>
          <div className="profile-page-heading__name-row">
            {displayName ? (
              <h1 className="profile-page-heading__name">{displayName}</h1>
            ) : (
              <p className="profile-page-heading__placeholder">名前未設定</p>
            )}
            {isEditable ? (
              <button type="button" className="profile-icon-button" aria-label="名前と肩書を編集" onClick={begin}>
                <PencilIcon />
              </button>
            ) : null}
          </div>
          {displayTitle ? <p className="profile-page-heading__title">{displayTitle}</p> : null}
        </>
      )}
    </header>
  );
}
