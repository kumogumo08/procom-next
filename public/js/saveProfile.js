import { proceedWithSave } from '../../app/lib/proceedWithSave.js'; // 別で定義済みの場合

// 🔑 URLからUIDを抽出
export function getUidFromURL() {
  const path = window.location.pathname;
  const segments = path.split('/');
  const uid = segments[segments.length - 1];
  if (!uid || uid === 'user' || uid === '') {
    return null;
  }
  return uid;
}

// 📡 プロフィール・イベント保存処理
export function saveProfileAndEventsToServer(includePhotos = false, customPhotos = null) {
  fetch('/session')
    .then(res => res.json())
    .then(data => {
      if (!data.loggedIn) {
        console.log("🛑 未ログイン状態のためプロフィール保存を中止");
        return;
      }

      const photos = customPhotos || JSON.parse(localStorage.getItem('photos') || '[]');
      let updatedPhotos = [];

      if (includePhotos && Array.isArray(photos) && photos.length > 0) {
        updatedPhotos = photos.map((photo, index) => {
          const slider = document.querySelector(`.position-slider[data-index="${index}"]`);
          const position = slider ? slider.value : '50';
          return { url: photo.url || photo, position };
        });
      }

      proceedWithSave(data.uid, includePhotos, customPhotos, updatedPhotos);
    });
}
