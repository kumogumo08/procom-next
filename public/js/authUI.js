// public/js/authUI.js
export function updateAuthUI() {
  console.log("✅ updateAuthUI 呼び出し開始");

  fetch('/session', { credentials: 'include' })
    .then(res => res.json())
    .then(data => {
      console.log("📨 /session レスポンス:", data);
      const authForms = document.querySelector('.auth-forms');
      const editSection = document.getElementById('edit-section');
      const photoUpload = document.querySelector('.photo-upload');
      const eventForm = document.getElementById('event-form');
      const youtubeInputSection = document.querySelector('.sns-section');
      const instagramSection = document.querySelector('#editForm #instagramPostLink')?.parentElement;
      const xSection = editSection?.querySelector('#xUsernameInput')?.parentElement;
      const tiktokSection = document.getElementById('tiktok-section');
      const currentUid = decodeURIComponent(window.location.pathname.split('/').pop());

      if (!authForms) return;

      if (data.loggedIn) {
        const isMobile = window.innerWidth <= 768;
        const mypageLinkHTML = `<a href="/user/${data.uid}" class="mypage-btn">マイページ</a>`;
        const logoutFormHTML = `<form action="/logout" method="GET"><button type="submit">ログアウト</button></form>`;
        const accountLinkHTML = `<a href="/account">⚙ アカウント設定</a>`;
        const isOwnPage = data.uid === currentUid;

        if (isMobile) {
          const navLinks = document.getElementById('navLinks');
          if (navLinks) {
            navLinks.innerHTML = `
              <li>${mypageLinkHTML}</li>
              <li>${logoutFormHTML}</li>
              <li>${accountLinkHTML}</li>
            `;
          }
          authForms.style.display = 'none';
        } else {
          authForms.innerHTML = `
            <div style="text-align: right; margin-top: 10px;">
              <p>ようこそ、${data.name}さん！</p>
              <div style="display: flex; justify-content: flex-end; gap: 10px; align-items: center;">
                ${mypageLinkHTML}
                ${logoutFormHTML}
              </div>
              <div style="margin-top: 5px;">
                ${accountLinkHTML}
              </div>
            </div>
          `;
          authForms.style.display = 'block';
        }

        if (isOwnPage) {
          if (editSection) editSection.style.display = 'block';
          if (photoUpload) photoUpload.style.display = 'block';
          if (eventForm) eventForm.style.display = 'block';
          if (youtubeInputSection) youtubeInputSection.style.display = 'block';
          if (instagramSection) instagramSection.style.display = 'block';
          if (xSection) xSection.style.display = 'block';
          if (tiktokSection) tiktokSection.style.display = 'block';
        } else {
          if (editSection) editSection.style.display = 'none';
          if (photoUpload) photoUpload.style.display = 'none';
          if (eventForm) eventForm.style.display = 'none';
          if (youtubeInputSection) youtubeInputSection.style.display = 'none';
          if (instagramSection) instagramSection.style.display = 'none';
          if (xSection) xSection.style.display = 'none';
          if (tiktokSection) tiktokSection.style.display = 'block';
        }

        document.body.classList.toggle('own-page', isOwnPage);
      } else {
        console.log("🔴 非ログイン状態：UIを非表示にします");

        authForms.innerHTML = '';
        if (editSection) editSection.style.display = 'none';
        if (photoUpload) photoUpload.style.display = 'none';
        if (eventForm) eventForm.style.display = 'none';
        if (youtubeInputSection) youtubeInputSection.style.display = 'none';
        if (instagramSection) instagramSection.style.display = 'none';
        if (xSection) xSection.style.display = 'none';
        if (tiktokSection) tiktokSection.style.display = 'none';

        document.body.classList.remove('own-page');
      }
    })
    .catch(err => {
      console.error("❌ /session取得またはUI処理中エラー:", err);
    });
}