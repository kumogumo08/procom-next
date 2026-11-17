'use client';

import { useState } from 'react';
import { cardBase } from '@/components/ui/cardStyles';
import {
  TEN_QUESTIONS,
  bioDraftFromEdit,
  parseTenQuestions,
  type TenQuestionsParts,
} from '@/lib/bioQuestions';

type Props = {
  bio: string;
  isEditable: boolean;
  isSaving?: boolean;
  onDraftChange?: (bio: string) => void;
  onSave?: () => Promise<boolean>;
  readSaveError?: () => string;
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

function QuestionList({ answers }: { answers: string[] }) {
  return (
    <div className="profile-questions">
      {TEN_QUESTIONS.map((question, index) => (
        <div key={question}>
          <p className="profile-questions__q">
            {index + 1}. {question}
          </p>
          {answers[index]?.trim() ? <p className="profile-questions__a">{answers[index]}</p> : null}
        </div>
      ))}
    </div>
  );
}

export default function BioBlock({
  bio,
  isEditable,
  isSaving = false,
  onDraftChange,
  onSave,
  readSaveError,
}: Props) {
  const saved = parseTenQuestions(bio);
  const [editing, setEditing] = useState(false);
  const [prose, setProse] = useState(saved.prose);
  const [answers, setAnswers] = useState<string[] | null>(saved.answers);
  const [error, setError] = useState<string | null>(null);

  if (!isEditable && bio.trim() === '') return null;

  function emit(nextProse: string, nextAnswers: string[] | null) {
    onDraftChange?.(bioDraftFromEdit(bio, nextProse, nextAnswers));
  }

  function begin() {
    const parsed: TenQuestionsParts = parseTenQuestions(bio);
    setProse(parsed.prose);
    setAnswers(parsed.answers);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    onDraftChange?.(bio);
    setError(null);
    setEditing(false);
  }

  async function save() {
    if (isSaving || !onSave) return;
    emit(prose, answers);
    setError(null);
    const ok = await onSave();
    if (ok) {
      setEditing(false);
      return;
    }
    setError(readSaveError?.() || '保存に失敗しました');
  }

  const view = saved;

  return (
    <section className="profile-bio-card" style={cardBase}>
      <div className="profile-bio-heading" data-block-title="">
        <p className="profile-bio-kicker" lang="en">
          PROFILE
        </p>
        {isEditable && !editing ? (
          <button type="button" className="profile-icon-button" aria-label="自己紹介を編集" onClick={begin}>
            <PencilIcon />
          </button>
        ) : null}
      </div>

      {editing ? (
        <>
          <textarea
            className="profile-bio-input"
            aria-label="自己紹介"
            rows={8}
            value={prose}
            onChange={(event) => {
              const next = event.target.value;
              setProse(next);
              emit(next, answers);
            }}
          />
          {answers ? (
            <div className="profile-questions">
              {TEN_QUESTIONS.map((question, index) => (
                <label key={question} className="profile-question-field">
                  <span>
                    {index + 1}. {question}
                  </span>
                  <textarea
                    rows={2}
                    aria-label={`${index + 1}. ${question}`}
                    value={answers[index] ?? ''}
                    onChange={(event) => {
                      const next = answers.map((answer, answerIndex) =>
                        answerIndex === index ? event.target.value : answer
                      );
                      setAnswers(next);
                      emit(prose, next);
                    }}
                  />
                </label>
              ))}
              <button
                type="button"
                className="profile-inline-cancel"
                onClick={() => {
                  setAnswers(null);
                  emit(prose, null);
                }}
              >
                10の質問を外す
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="ten-questions-btn"
              onClick={() => {
                const next = Array.from({ length: TEN_QUESTIONS.length }, () => '');
                setAnswers(next);
                emit(prose, next);
              }}
            >
              🎀 10の質問を追加
            </button>
          )}
          <div className="profile-inline-actions">
            <button type="button" className="profile-text-btn" onClick={() => void save()} disabled={isSaving}>
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
        </>
      ) : (
        <>
          {view.prose.trim() ? <p className="profile-bio">{view.prose}</p> : null}
          {view.answers ? <QuestionList answers={view.answers} /> : null}
          {!view.prose.trim() && !view.answers ? (
            <p className="profile-bio profile-bio--empty">自己紹介はまだありません</p>
          ) : null}
        </>
      )}
    </section>
  );
}
