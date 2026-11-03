'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAuth, confirmPasswordReset } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebaseClient';
import Image from 'next/image';
import AuthPageShell from '@/components/AuthPageShell';

export default function ResetPage() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();
  const oobCode = searchParams.get('oobCode');

    // ✅ Procomと同じバリデーションルールを追加
  const validatePassword = (password: string): string | null => {
    if (password.length < 8 || password.length > 32) return 'パスワードは8〜32文字である必要があります';
    if (!/[A-Z]/.test(password)) return '大文字を含めてください';
    if (!/[a-z]/.test(password)) return '小文字を含めてください';
    if (!/[0-9]/.test(password)) return '数字を含めてください';
    if (/[^A-Za-z0-9]/.test(password)) return '記号は使えません';
    return null;
  };
  
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
    <AuthPageShell>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
         <Image src="/procom-logo.png" alt="Procom Logo" width={180} height={48} className="mx-auto mb-4 h-12 w-auto" />
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
    </AuthPageShell>
  );
}
