function fetchLatestVideos(channelId) {
  if (!channelId) return;

  const cacheKey = `cachedVideos_${channelId}`;
  const cacheTimeKey = `lastFetchTime_${channelId}`;
  const now = Date.now();
  const lastFetch = localStorage.getItem(cacheTimeKey);

  if (lastFetch && now - parseInt(lastFetch, 10) < 10 * 60 * 1000) {
    console.log('📦 キャッシュからYouTube動画を表示します');
    const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    displayYouTubeVideos(cached);
    return;
  }

  fetch(`/api/youtube/${channelId}`)
    .then(res => {
      if (!res.ok) throw new Error('ユーザーデータの取得に失敗しました。');
      return res.json();
    })
    .then(data => {
      const videos = (data.items || []).filter(item => item.id.kind === 'youtube#video');
      if (videos.length === 0) throw new Error('動画が見つかりません');

      localStorage.setItem(cacheKey, JSON.stringify(videos));
      localStorage.setItem(cacheTimeKey, now.toString());

      displayYouTubeVideos(videos);
    })
    .catch(err => {
      console.error('YouTube API エラー:', err);
      document.getElementById('videoContainer').innerText = '動画を表示できませんでした。';
    });
}

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
