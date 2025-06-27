function getEventsForDate(date, eventsArray) {
  const entry = eventsArray.find(e => e.date === date);
  return entry ? entry.events : [];
}

function validatePassword(password) {
  const lengthOK = password.length >= 8 && password.length <= 32;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password); // 記号検出

  if (!lengthOK) return 'パスワードは8文字以上32文字以下にしてください';
  if (!hasUpper) return 'パスワードには大文字を含めてください';
  if (!hasLower) return 'パスワードには小文字を含めてください';
  if (!hasNumber) return 'パスワードには数字を含めてください';
  if (hasSymbol) return 'パスワードに記号は使えません';

  return ''; // エラーなし
}

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('usernameInput').value.trim();
  const email = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;

  const error = validatePassword(password);
  if (error) {
    alert(error);
    return;
  }

  const res = await fetch('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });

  if (res.ok) {
    alert('登録成功！ログインしてください');
    location.href = '/login.html';
  } else {
    const msg = await res.text();
    alert('登録失敗: ' + msg);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navLinks = document.getElementById('navLinks');

  hamburgerBtn.addEventListener('click', () => {
    navLinks.classList.toggle('show');
  });
});