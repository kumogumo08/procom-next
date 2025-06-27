'use client';

import { useState, useEffect, FormEvent } from 'react';
import Head from 'next/head';
import Header from '@/components/Header';
import Footer from 'app/components/Footer';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const modeParam = searchParams?.get?.('mode');
    if (modeParam === 'register') {
      setMode('register');
    }
  }, [searchParams]);

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
  };

  const validatePassword = (password: string): string | null => {
    if (password.length < 8 || password.length > 32) return 'パスワードは8〜32文字である必要があります';
    if (!/[A-Z]/.test(password)) return '大文字を含めてください';
    if (!/[a-z]/.test(password)) return '小文字を含めてください';
    if (!/[0-9]/.test(password)) return '数字を含めてください';
    if (/[^A-Za-z0-9]/.test(password)) return '記号は使えません';
    return null;
  };

  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const username = (form.username as HTMLInputElement).value.trim();
    const email = (form.email as HTMLInputElement).value.trim();
    const password = (form.password as HTMLInputElement).value;
    const error = validatePassword(password);
    if (error) return alert(error);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
        credentials: 'include',
      });
      if (res.ok) {
        const result = await res.json();
        alert('登録成功！マイページに移動します');
        router.push(result.redirectTo);
      } else {
        const msg = await res.text();
        alert('登録失敗: ' + msg);
      }
    } catch {
      alert('通信エラーが発生しました');
    }
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.email as HTMLInputElement).value.trim();
    const password = (form.password as HTMLInputElement).value;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const result = await res.json();
        alert('ログイン成功！マイページに移動します');
        router.push(`/user/${result.uid}`);
      } else {
        const msg = await res.text();
        alert('ログイン失敗: ' + msg);
      }
    } catch {
      alert('通信エラーが発生しました');
    }
  };

  return (
    <>
      <Head>
        <title>ログイン / 新規登録 - Procom</title>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </Head>

      <Header />

      <main className="flex flex-col items-center justify-center px-4 py-8 bg-gray-100">
        <div className="bg-white w-full max-w-md p-6 rounded-lg shadow-md">
          {mode === 'login' ? (
            <div id="loginForm">
              <h2 className="text-xl font-bold text-center mb-4">ログイン</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <input
                  type="email"
                  name="email"
                  placeholder="メールアドレス"
                  required
                  className="w-full p-2 border rounded"
                />
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="パスワード"
                    required
                    className="w-full p-2 border rounded"
                  />
                  <i
                    className={`fa-solid ${showLoginPassword ? 'fa-eye-slash' : 'fa-eye'} absolute right-3 top-3 cursor-pointer`}
                    onClick={() => setShowLoginPassword((v) => !v)}
                  ></i>
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 rounded font-bold"
                >
                  ログイン
                </button>
              </form>
              <div
                className="text-center mt-4 text-blue-600 cursor-pointer"
                onClick={toggleMode}
              >
                → 新規登録はこちら
              </div>
            </div>
          ) : (
            <div id="registerForm">
              <h2 className="text-xl font-bold text-center mb-4">新規登録</h2>
              <form
                id="registerFormEl"
                className="space-y-4"
                onSubmit={handleRegister}
              >
                <input
                  type="text"
                  name="username"
                  placeholder="ユーザー名"
                  required
                  className="w-full p-2 border rounded"
                />
                <input
                  type="email"
                  name="email"
                  placeholder="メールアドレス"
                  required
                  className="w-full p-2 border rounded"
                />
                <div className="relative">
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="パスワード"
                    required
                    className="w-full p-2 border rounded"
                  />
                  <i
                    className={`fa-solid ${showRegisterPassword ? 'fa-eye-slash' : 'fa-eye'} absolute right-3 top-3 cursor-pointer`}
                    onClick={() => setShowRegisterPassword((v) => !v)}
                  ></i>
                </div>
                <small className="text-red-600 font-bold block">
                  ※ パスワードは8～32文字で、大文字・小文字・数字を含み、記号は使えません。
                </small>
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 rounded font-bold"
                >
                  登録する
                </button>
              </form>
              <div
                className="text-center mt-4 text-blue-600 cursor-pointer"
                onClick={toggleMode}
              >
                ← ログインに戻る
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
