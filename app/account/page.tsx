'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function AccountSettingsPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setMessage('');

  const res = await fetch('/account/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      newUsername,
      newEmail,
      newPassword
    })
  });

  const resultText = await res.text();

  if (res.ok) {
    setMessage('✅ アカウント情報を更新しました');
    const sessionRes = await fetch('/api/session');
    const session = await sessionRes.json();
    if (session.uid) {
      router.refresh();
      setTimeout(() => {
        router.push(`/user/${session.uid}`);
      }, 1000);
    }
  } else {
    setMessage(`❌ ${resultText}`);
  }
};

  const handleWithdraw = async () => {
    const confirmed = confirm("本当にアカウントを削除しますか？この操作は元に戻せません。");
    if (!confirmed) return;

    try {
      const res = await fetch('/api/account/delete', { method: 'DELETE' });
      if (res.ok) {
        await fetch('/api/logout');
        alert("退会処理が完了しました。ご利用ありがとうございました。");
        router.push('/deleted');
      } else {
        const msg = await res.text();
        alert("退会に失敗しました：" + msg);
      }
    } catch (err) {
      alert("退会処理中にエラーが発生しました。");
      console.error(err);
    }
  };

  return (
    <>
      <Header />
      <main>
        <div className="account-container">
          <h2>アカウント設定</h2>
          {message && <p style={{ textAlign: 'center' }}>{message}</p>}
          <form onSubmit={handleSubmit}>
            <label htmlFor="newUsername">新しいユーザー名</label>
            <input
              type="text"
              id="newUsername"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="変更しない場合は空欄"
            />

            <label htmlFor="newEmail">新しいメールアドレス</label>
            <input
              type="email"
              id="newEmail"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="変更しない場合は空欄"
            />

            <label htmlFor="newPassword">新しいパスワード</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="変更しない場合は空欄"
              />
              <i
                className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'pointer'
                }}
              ></i>
            </div>

            <button type="submit">保存する</button>
          </form>
        </div>

        <div className="account-container" style={{ marginTop: 30, borderTop: '2px solid #f55' }}>
          <h2 style={{ color: '#c00' }}>アカウントを削除する</h2>
          <p>この操作は元に戻せません。本当に退会される場合のみ実行してください。</p>
          <button onClick={handleWithdraw} style={{ backgroundColor: '#d9534f', marginTop: 10 }}>
            退会する
          </button>
        </div>
      </main>
      <Footer />
    </>
  );
}
