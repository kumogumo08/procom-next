import { updatePhotoSlider } from './photoSlider.js'; // スライダー機能が別ファイルの場合のみ

export function attachAuthFormHandlers() {
  const registerForm = document.getElementById('registerFormEl');
  const loginForm = document.getElementById('login-form');

  // 🔹 登録処理
  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    const res = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
      credentials: 'include'
    });

    if (res.ok) {
      const result = await res.json();
      alert('登録成功！マイページに移動します');
      window.location.href = result.redirectTo;
    } else {
      const msg = await res.text();
      alert('登録失敗: ' + msg);
    }
  });

  // 🔐 ログイン処理
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });

    if (res.ok) {
      const data = await res.json();
      alert(`ログイン成功！ようこそ ${data.name} さん`);
      window.location.href = data.redirectTo;

      if (data.photos && Array.isArray(data.photos)) {
        updatePhotoSlider(data.photos); // 任意：写真がある場合スライダー更新
      }

    } else {
      const errorText = await res.text();
      alert(`ログイン失敗: ${errorText}`);
    }
  });
}
