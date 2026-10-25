'use client';

import { useState, useEffect } from 'react';

type Props = {
  uid: string;
  isEditable: boolean;
  initialEmail?: string;
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
  isEditable,
  initialEmail,
  onDraftChange,
}: Props) {
  const [email, setEmail] = useState(initialEmail || '');

  useEffect(() => {
    setEmail(initialEmail || '');
  }, [initialEmail]);

  useEffect(() => {
    onDraftChange?.(email);
  }, [email, onDraftChange]);

  if (!isEditable) return null;

  return (
    <div className="my-6 text-center">
      <p className="text-sm mb-2">📩 お仕事用メールアドレス（訪問者に表示されます）</p>
      <input
        type="email"
        placeholder="contact@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border px-3 py-2 rounded w-[280px] text-sm"
      />
      <p className="text-sm mt-2" style={{ color: '#64748b' }}>
        保存すると、上の推しボタンの横に「お仕事依頼」が表示されます。
      </p>
    </div>
  );
}
