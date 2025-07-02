'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAuth, confirmPasswordReset } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebaseClient';

export default function ResetPage() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();
  const oobCode = searchParams.get('oobCode');

  const handleReset = async () => {
    if (!oobCode || !password) return;
    try {
      const auth = getAuth(firebaseApp);
      await confirmPasswordReset(auth, oobCode, password);
      setMessage('✅ パスワードが変更されました。ログインページに移動します...');
      setTimeout(() => router.push('/login'), 3000);
    } catch (err) {
      setMessage('❌ パスワードの再設定に失敗しました');
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-blue-300 px-4">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md">
         <img src="/procom-logo.png" alt="Procom Logo" className="h-12 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">🔐 パスワード再設定</h1>
        <input
          type="password"
          placeholder="新しいパスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={handleReset}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
        >
          パスワードを変更
        </button>
        {message && <p className="mt-4 text-center text-sm text-gray-700">{message}</p>}
      </div>
    </div>
  );
}
