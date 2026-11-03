'use client';

import { useState } from 'react';
import { sendPasswordResetEmail, getAuth } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebaseClient';
import AuthPageShell from '@/components/AuthPageShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const auth = getAuth(firebaseApp);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('✅ リセット用メールを送信しました。メールをご確認ください。');
    } catch (error: any) {
      console.error(error);
      setMessage('❌ エラーが発生しました。メールアドレスをご確認ください。');
    }
  };

  return (
    <>
      <AuthPageShell>
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          <h1 className="text-2xl font-bold text-center mb-6">パスワードを忘れた方</h1>
          <form onSubmit={handleReset} className="space-y-4">
            <label className="block text-gray-700">
              登録済みのメールアドレス：
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full mt-1 p-2 border rounded"
                placeholder="example@mail.com"
              />
            </label>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 transition"
            >
              リセットメールを送信
            </button>
          </form>
          {message && (
            <p className="mt-4 text-center text-sm text-green-600">{message}</p>
          )}
        </div>
      </AuthPageShell>
    </>
  );
}
