function displayYouTubeVideos(videos) {
  const videoHTML = videos.slice(0, 2).map(video => {
    const { videoId } = video.id;
    const { title } = video.snippet;
    return `
      <div class="youtube-card">
        <iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>
        <p>${title}</p>
      </div>
    `;
  }).join('');
  document.getElementById('videoContainer').innerHTML = videoHTML;
}

// ==== TikTok埋め込み ====
window.saveTikTokVideos = function (isUserAction = true) {
  const inputs = document.querySelectorAll('.tiktok-input');
  const urls = Array.from(inputs).map(input => input.value.trim())
    .filter(url => url.includes('tiktok.com/@') && url.includes('/video/'));

  console.log('✅ 保存対象URL:', urls);

  if (urls.length === 0) {
    alert('TikTokの正しい動画URLを1つ以上入力してください。');
    return;
  }

  localStorage.setItem('tiktokUrls', JSON.stringify(urls));
  displayTikTokVideos(urls);

  if (isUserAction) {
    console.log("👍 ユーザー操作によりSNSが変更されました");
  } else {
    console.log("📄 初期表示なのでプロフィール保存はスキップ");
  }
};

function displayTikTokVideos(urls = null) {
  const container = document.getElementById('tiktok-container');
  container.innerHTML = '';

  const savedUrls = urls || JSON.parse(localStorage.getItem('tiktokUrls') || '[]');
  savedUrls.forEach(url => {
    const match = url.match(/\/video\/(\d{10,})/);
    if (!match) return;
    const videoId = match[1];

    const block = document.createElement('blockquote');
    block.className = 'tiktok-embed';
    block.setAttribute('cite', url);
    block.setAttribute('data-video-id', videoId);
    block.innerHTML = '<section></section>';
    container.appendChild(block);
  });

  const script = document.createElement('script');
  script.src = 'https://www.tiktok.com/embed.js';
  script.async = true;
  document.body.appendChild(script);
}

document.addEventListener('DOMContentLoaded', () => {
  const latestInputSection = document.getElementById('youtube-latest-input');
  const manualInputSection = document.getElementById('youtube-manual-input');
  const modeRadios = document.querySelectorAll('input[name="youtubeMode"]');

  const updateModeDisplay = (mode) => {
    if (mode === 'manual') {
      latestInputSection.style.display = 'none';
      manualInputSection.style.display = 'block';
    } else {
      latestInputSection.style.display = 'block';
      manualInputSection.style.display = 'none';
    }
  };

  modeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const selectedMode = document.querySelector('input[name="youtubeMode"]:checked')?.value;
      updateModeDisplay(selectedMode);
    });
  });

  const savedMode = localStorage.getItem('youtubeMode');
  if (savedMode === 'manual') {
    document.querySelector('input[name="youtubeMode"][value="manual"]').checked = true;
    updateModeDisplay('manual');

    const urls = JSON.parse(localStorage.getItem('manualYouTubeUrls') || '[]');
    const textarea = document.getElementById('manualYouTubeUrls');
    if (textarea) textarea.value = urls.join('\n');
    displayManualYouTubeVideos(urls);
  } else {
    document.querySelector('input[name="youtubeMode"][value="latest"]').checked = true;
    updateModeDisplay('latest');

    const ytChannelId = localStorage.getItem('youtubeChannelId');
    if (ytChannelId) {
      const input = document.getElementById('channelIdInput');
      if (input) input.value = ytChannelId;
      fetchLatestVideos(ytChannelId);
    }
  }
});
