'use client';

import { useState, useEffect } from 'react';

type Props = {
  uid: string;
  isEditable: boolean;
  initialEmail?: string;
};

export default function ContactButtonBlock({ uid, isEditable, initialEmail }: Props) {
  const [email, setEmail] = useState(initialEmail || '');
  const [savedEmail, setSavedEmail] = useState(initialEmail || '');
  const [saving, setSaving] = useState(false);

  // ✅ 初期メールアドレスが変更されたときに反映する
  useEffect(() => {
    setEmail(initialEmail || '');
    setSavedEmail(initialEmail || '');
  }, [initialEmail]);

  const handleSave = async () => {
    if (!email) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/user/${uid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: { emailForContact: email } }),
      });
      if (res.ok) {
        setSavedEmail(email);
        alert('お仕事用メールアドレスを保存しました');
      } else {
        throw new Error();
      }
    } catch (err) {
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (isEditable) {
    return (
      <div className="my-6 text-center">
        <p className="text-sm mb-2">📩 お仕事用メールアドレス（訪問者に表示されます）</p>
        <input
          type="email"
          placeholder="contact@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border px-3 py-2 rounded w-[280px] text-sm mb-2"
        />
        <br />
        <button
          onClick={handleSave}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          disabled={saving}
        >
          {saving ? '保存中...' : '保存'}
        </button>
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
