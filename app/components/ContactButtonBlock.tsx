'use client';

import { useState, useEffect } from 'react';

type Props = {
  uid: string;
  isEditable: boolean;
  initialEmail?: string;
  savedEmail?: string;
  onDraftChange?: (emailForContact: string) => void;
};

export function contactMailtoHref(email: string): string {
  const subject = encodeURIComponent('【お仕事依頼】Procomページからのご連絡');
  const body = encodeURIComponent(
    `■ 会社名または活動名：\n■ お名前：\n■ ご依頼内容：\n\nProcomページを拝見し、ご連絡差し上げました。`
  );
  return `mailto:${email.trim()}?subject=${subject}&body=${body}`;
}

/** 保存済みメールがあるときだけ出す。未保存の入力はここでは使わない。 */
export function WorkRequestButton({ email }: { email: string }) {
  const trimmed = email.trim();
  if (!trimmed) return null;
  return (
    <div className="profile-request-card">
      <a href={contactMailtoHref(trimmed)} className="profile-request-button">
        <svg className="profile-request-button__icon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5.5" width="18" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        <span className="profile-request-button__label">お仕事依頼</span>
        <span className="profile-request-button__title">お問い合わせ</span>
      </a>
    </div>
  );
}

export default function ContactButtonBlock({
  uid,
  isEditable,
  initialEmail,
  savedEmail,
  onDraftChange,
}: Props) {
  const [email, setEmail] = useState(initialEmail || '');
  const saved = (savedEmail ?? initialEmail ?? '').trim();

  useEffect(() => {
    setEmail(initialEmail || '');
  }, [initialEmail]);

  useEffect(() => {
    onDraftChange?.(email);
  }, [email, onDraftChange]);

  if (!isEditable) return null;

  return (
    <div className="profile-request-card profile-request-card--editor">
      <label className="profile-request-editor__label" htmlFor={`contact-email-${uid}`}>
        お仕事用メールアドレス
        <span className="profile-request-editor__note">訪問者に表示されます</span>
      </label>
      <input
        id={`contact-email-${uid}`}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="contact@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="profile-request-editor__input"
      />
      <p className="profile-request-editor__hint">※未入力の場合、お仕事依頼ボタンは表示されません。</p>
      {saved ? (
        <a href={contactMailtoHref(saved)} className="profile-request-button profile-request-button--compact">
          <svg className="profile-request-button__icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5.5" width="18" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          <span className="profile-request-button__label">お仕事依頼</span>
          <span className="profile-request-button__title">お問い合わせ</span>
        </a>
      ) : null}
    </div>
  );
}
