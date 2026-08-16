'use client';

import { useState, useEffect } from 'react';

type Props = {
  uid: string;
  isEditable: boolean;
  initialEmail?: string;
  onDraftChange?: (emailForContact: string) => void;
};

export default function ContactButtonBlock({
  isEditable,
  initialEmail,
  onDraftChange,
}: Props) {
  const [email, setEmail] = useState(initialEmail || '');
  const [savedEmail, setSavedEmail] = useState(initialEmail || '');

  // ✅ 初期メールアドレスが変更されたときに反映する
  useEffect(() => {
    setEmail(initialEmail || '');
    setSavedEmail(initialEmail || '');
  }, [initialEmail]);

  useEffect(() => {
    onDraftChange?.(email);
  }, [email, onDraftChange]);

  if (isEditable) {
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
      </div>
    );
  }

  if (!savedEmail) return null;

  const subject = encodeURIComponent('【お仕事依頼】Procomページからのご連絡');
  const body = encodeURIComponent(
    `■ 会社名または活動名：\n■ お名前：\n■ ご依頼内容：\n\nProcomページを拝見し、ご連絡差し上げました。`
  );

  const mailtoLink = `mailto:${savedEmail}?subject=${subject}&body=${body}`;

  return (
    <div className="my-6 text-center">
      <p className="text-sm mb-2">📩 お仕事のご依頼はこちら</p>
      <a
        href={mailtoLink}
        className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold text-lg py-3 px-8 rounded-full shadow-md hover:shadow-lg transition-all duration-300 hover:brightness-110"
      >
        お仕事を依頼する
      </a>
    </div>
  );
}
