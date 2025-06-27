function updatePhotoSlider(photoData = [], isOwnPage = false) {
  carousel.innerHTML = '';
  slides = [];

  photoData.forEach((photo, index) => {
    const slideDiv = document.createElement('div');
    slideDiv.classList.add('slide');

    const photoUrl = typeof photo === 'string' ? photo : photo.url;
    const position = typeof photo === 'object' && photo.position ? photo.position : '50';

    const img = document.createElement('img');
    img.src = photoUrl;
    img.classList.add('carousel-image');
    img.style.objectPosition = `center ${position}%`;

    slideDiv.appendChild(img);

    if (typeof isOwnPage !== 'undefined' && isOwnPage) {
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '100';
      slider.value = position;
      slider.classList.add('position-slider');
      slider.dataset.index = index;
      slider.style.position = 'absolute';
      slider.style.bottom = '10px';
      slider.style.left = '10%';
      slider.style.width = '80%';
      slider.style.zIndex = '10';
      slider.addEventListener('input', () => {
        img.style.objectPosition = `center ${slider.value}%`;
      });
      slideDiv.appendChild(slider);
    }

    carousel.appendChild(slideDiv);
  });

  slides = carousel.querySelectorAll('.slide');
  currentSlide = 0;
  updateCarousel();
}

function updateCarousel() {
  slides.forEach((slide, i) => {
    const offset = ((i - currentSlide + slides.length) % slides.length);
    slide.style.setProperty('--i', offset);
    slide.classList.toggle('active', offset === 0);
  });
}

function prevSlide() {
  currentSlide = (currentSlide - 1 + slides.length) % slides.length;
  updateCarousel();
}

function nextSlide() {
  currentSlide = (currentSlide + 1) % slides.length;
  updateCarousel();
}

window.addEventListener('DOMContentLoaded', async () => {
  updateAuthUI();
  attachAuthFormHandlers();

  const savedName = localStorage.getItem('profile_name');
  if (savedName) nameDisplay.textContent = savedName;
  const savedTitle = localStorage.getItem('profile_title');
  if (savedTitle) titleDisplay.textContent = `（${savedTitle}）`;
  const savedBio = localStorage.getItem('profile_bio');
  if (savedBio) bioDisplay.innerHTML = savedBio.replace(/\n/g, '<br>');

  const uidFromURL = decodeURIComponent(window.location.pathname.split('/').pop());

  fetch(`/api/user/${uidFromURL}`)
    .then(async res => {
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    })
    .then(data => {
      const profile = data.profile || data;
      if (profile.xUsername) {
        document.getElementById('xUsernameInput').value = profile.xUsername;
        localStorage.setItem('xUsername', profile.xUsername);
      }
      if (profile.instagramPostUrl) {
        document.getElementById('instagramPostLink').value = profile.instagramPostUrl;
        localStorage.setItem('instagramPostUrl', profile.instagramPostUrl);
      }
      if (Array.isArray(profile.photos)) {
        updatePhotoSlider(profile.photos, isOwnPage);
      }
    })
    .catch(err => {
      console.error("❌ プロフィール読み込みエラー:", err.message);
    });

  let isEditable = false;
  try {
    const sessionRes = await fetch('/session');
    const session = await sessionRes.json();
    isEditable = session.loggedIn && session.uid === uidFromURL;
  } catch (err) {
    console.warn("⚠ セッション情報の取得に失敗しました", err);
  }

  document.getElementById('editBtn')?.addEventListener('click', () => {
    document.getElementById('editForm')?.classList.remove('hidden');
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn && !saveBtn.dataset.listenerAdded) {
      saveBtn.addEventListener('click', () => {
        saveProfileAndEventsToServer(true);
      });
      saveBtn.dataset.listenerAdded = 'true';
    }
  });

  events = JSON.parse(localStorage.getItem('calendarEvents')) || [];
  createCalendar(currentDate, isEditable);

  const saveTop = document.getElementById('saveProfileBtnTop');
  if (saveTop && !saveTop.dataset.listenerAdded) {
    saveTop.addEventListener('click', () => saveProfileAndEventsToServer(true));
    saveTop.dataset.listenerAdded = 'true';
  }

  const saveBottom = document.getElementById('saveProfileBtnBottom');
  if (saveBottom && !saveBottom.dataset.listenerAdded) {
    saveBottom.addEventListener('click', () => saveProfileAndEventsToServer(true));
    saveBottom.dataset.listenerAdded = 'true';
  }

  document.getElementById('instagramPostLink')?.addEventListener('input', (e) => {
    localStorage.setItem('instagramPostUrl', e.target.value.trim());
  });

  document.getElementById('xUsernameInput')?.addEventListener('input', (e) => {
    localStorage.setItem('xUsername', e.target.value.trim());
  });

  const savePhotosBtn = document.getElementById('savePhotosBtn');
  if (savePhotosBtn && !savePhotosBtn.dataset.listenerAdded) {
    savePhotosBtn.addEventListener('click', () => {
      savePhotos();
    });
    savePhotosBtn.dataset.listenerAdded = 'true';
  }

  document.getElementById('add-event-btn')?.addEventListener('click', () => {
    const date = document.getElementById('event-date').value.trim();
    const text = document.getElementById('event-text').value.trim();
    if (!date || !text) {
      alert('日付と内容を入力してください。');
      return;
    }
    if (!events[date]) events[date] = [];
    events[date].push(text);
    try {
      localStorage.setItem('calendarEvents', JSON.stringify(events));
    } catch (e) {
      console.error(`ローカル保存に失敗しました（${date}）:`, e);
    }
    createCalendar(currentDate);
    document.getElementById('event-date').value = '';
    document.getElementById('event-text').value = '';
  });
});