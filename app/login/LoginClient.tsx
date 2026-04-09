'use client';

import { useState, useEffect, FormEvent } from 'react';
import Head from 'next/head';
import Header from '@/components/Header';
import Footer from 'app/components/Footer';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link'
import { FirebaseError } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebaseClient';

/** ユーザー向け（Firebase の code / 英語メッセージは出さない） */
const LOGIN_FAIL_TITLE = 'ログインに失敗しました';
const LOGIN_FAIL_CREDENTIAL_DETAIL = 'メールアドレスまたはパスワードをご確認ください';
const LOGIN_FAIL_GENERIC_DETAIL = 'しばらく時間をおいて再度お試しください';

/** メール／パスワード誤り等に寄せる（レート制限・内部エラーは含めない） */
function isFirebaseAuthCredentialError(code: string): boolean {
  return (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-email' ||
    code === 'auth/invalid-login-credentials'
  );
}

type LoginPageProps = {
  /** /register などから開いたときの初期表示（未指定時はログイン） */
  initialMode?: 'login' | 'register';
};

export default function LoginPage({ initialMode }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode ?? 'login');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<{ title: string; detail: string } | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const modeParam = searchParams?.get?.('mode');
    if (modeParam === 'register') {
      setMode('register');
    }
  }, [searchParams]);

  const toggleMode = () => {
    setLoginError(null);
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
    if (isLoading) return;

    setLoginError(null);
    setIsLoading(true);
  
    const form = e.currentTarget;
    const email = (form.email as HTMLInputElement).value.trim();
    const password = (form.password as HTMLInputElement).value;
  
    /** 調査用: どの段階で失敗したか（catch で出力） */
    let loginStep = 'start';

    try {
      // ① クライアントでログイン（Firebase Auth）
      loginStep = 'getAuth';
      const auth = getAuth(firebaseApp);
      console.log('[LOGIN] firebaseApp.name:', firebaseApp?.name);
      console.log('[LOGIN] AUTH INSTANCE:', auth);
      console.log('[LOGIN] AUTH APP NAME:', auth?.app?.name);

      loginStep = 'signInWithEmailAndPassword';
      console.log('[LOGIN] before signInWithEmailAndPassword');
      const cred = await signInWithEmailAndPassword(auth, email, password);
      console.log('[LOGIN] signInWithEmailAndPassword OK, uid:', cred?.user?.uid);

      // ② IDトークン取得
      loginStep = 'getIdToken';
      console.log('[LOGIN] before getIdToken');
      const idToken = await cred.user.getIdToken();
      console.log('[LOGIN] getIdToken OK, token length:', idToken?.length ?? 0);

      // ③ サーバでセッション発行（iron-session）
      loginStep = 'fetch /api/session/login';
      console.log('[LOGIN] before fetch /api/session/login');
      const res = await fetch('/api/session/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        credentials: 'include',
      });
      console.log('[LOGIN] after fetch, status:', res.status, 'ok:', res.ok);

      if (!res.ok) {
        loginStep = 'parse error body (res not ok)';
        const data = await res.json().catch(async () => ({ msg: await res.text() }));
        console.error('[LOGIN] SESSION LOGIN FAILED (API not ok):', data);
        setLoginError({ title: LOGIN_FAIL_TITLE, detail: LOGIN_FAIL_GENERIC_DETAIL });
        return;
      }

      loginStep = 'res.json() session response';
      let data: { uid?: string; ok?: boolean };
      try {
        data = await res.json();
      } catch (parseErr) {
        loginStep = 'res.json() threw';
        console.error('[LOGIN] res.json() failed despite res.ok:', parseErr);
        throw parseErr;
      }
      console.log('[LOGIN] session JSON ok, keys:', data ? Object.keys(data) : [], 'uid:', data?.uid);

      loginStep = 'router.push';
      if (!data?.uid) {
        console.error('[LOGIN] missing uid in session response:', data);
        setLoginError({ title: LOGIN_FAIL_TITLE, detail: LOGIN_FAIL_GENERIC_DETAIL });
        return;
      }
      router.push(`/user/${data.uid}`);
    } catch (e: unknown) {
      console.error('[LOGIN] FAILED at step:', loginStep, e);

      if (e instanceof FirebaseError) {
        console.error('[LOGIN] FirebaseError code:', e.code, 'message:', e.message);
        const detail =
          e.code.startsWith('auth/') && isFirebaseAuthCredentialError(e.code)
            ? LOGIN_FAIL_CREDENTIAL_DETAIL
            : LOGIN_FAIL_GENERIC_DETAIL;
        setLoginError({ title: LOGIN_FAIL_TITLE, detail });
      } else {
        const msg =
          e instanceof Error
            ? e.message
            : typeof (e as { message?: string })?.message === 'string'
              ? (e as { message: string }).message
              : String(e);
        console.error('[LOGIN] non-Firebase error:', msg);
        setLoginError({ title: LOGIN_FAIL_TITLE, detail: LOGIN_FAIL_GENERIC_DETAIL });
      }
    } finally {
      setIsLoading(false);
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
                {loginError && (
                  <div
                    role="alert"
                    className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
                  >
                    <p className="font-semibold">{loginError.title}</p>
                    <p className="mt-1 leading-snug">{loginError.detail}</p>
                  </div>
                )}
                <input
                  type="email"
                  name="email"
                  placeholder="メールアドレス"
                  required
                  className="w-full p-2 border rounded"
                  onChange={() => loginError && setLoginError(null)}
                />
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="パスワード"
                    required
                    className="w-full p-2 border rounded"
                    onChange={() => loginError && setLoginError(null)}
                  />
                  <i
                    className={`fa-solid ${showLoginPassword ? 'fa-eye-slash' : 'fa-eye'} absolute right-3 top-3 cursor-pointer`}
                    onClick={() => setShowLoginPassword((v) => !v)}
                  ></i>
                </div>
                <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-2 rounded font-bold transition
                  ${isLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ログイン中...
                  </div>
                ) : (
                  'ログイン'
                )}
              </button>
              </form>
              <div
                className={`text-center mt-4 text-blue-600 cursor-pointer ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={toggleMode}
              >
                → 新規登録はこちら
              </div>
              <p className="text-center mt-2">
                <Link href="/forgot-password" className="text-blue-500 underline">
                  パスワードを忘れた方はこちら
                </Link>
              </p>
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
