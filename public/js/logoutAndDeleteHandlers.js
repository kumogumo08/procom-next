export function setupLogoutAndDeleteHandlers() {
  // 🔓 ログアウト処理
  document.addEventListener('submit', (e) => {
    if (e.target.action.endsWith('/logout')) {
      e.preventDefault();
      fetch('/logout', { method: 'GET', credentials: 'include' })
        .then(() => window.location.href = '/')
        .catch(err => {
          console.error('ログアウト失敗:', err);
          alert('ログアウトに失敗しました');
        });
    }
  });

  // ❌ 各種削除ボタン
  document.getElementById('deleteNameBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('nameInput');
    nameInput.value = '';
    nameInput.dataset.cleared = 'true';
  });

  document.getElementById('deleteTitleBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    const titleInput = document.getElementById('titleInput');
    titleInput.value = '';
    titleInput.dataset.cleared = 'true';
  });

  document.getElementById('deleteBioBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    const bioInput = document.getElementById('bioInput');
    bioInput.value = '';
    bioInput.dataset.cleared = 'true';
  });
}
