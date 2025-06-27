export function embedInstagramPost(isUserAction = true) {
  const url = document.getElementById('instagramPostLink').value;
  const container = document.getElementById('instagramPostContainer');

  if (!url || !url.includes('instagram.com')) {
    container.innerHTML = '正しいInstagram投稿のURLを入力してください。';
    return;
  }

  container.innerHTML = `
    <blockquote class="instagram-media" data-instgrm-permalink="${url}" data-instgrm-version="14" style="width:100%; max-width:540px;"></blockquote>
  `;

  localStorage.setItem('instagramPostUrl', url);

  if (window.instgrm) {
    window.instgrm.Embeds.process();
  } else {
    const script = document.createElement('script');
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    document.body.appendChild(script);
  }

  if (isUserAction) {
    console.log("👍 ユーザー操作によりSNSが変更されました");
  } else {
    console.log("📄 初期表示なのでプロフィール保存はスキップ");
  }
}

// ==== YouTubeチャンネルIDの保存と動画取得 ====
export function saveYouTubeChannelId() {
  const input = document.getElementById('channelIdInput').value.trim();
  if (!input) return;

  const match = input.match(/(UC[\w-]+)/);
  if (!match) {
    alert('チャンネルID（UCから始まるID）を入力してください');
    return;
  }

  const channelId = match[1];
  localStorage.setItem('youtubeChannelId', channelId);
  fetchLatestVideos(channelId);
}

function fetchLatestVideos(channelId) {
  // fetchLatestVideosの本体は別途定義またはインポートしてください
  console.log("🎥 fetchLatestVideosを呼び出し:", channelId);
  // 実際のAPI呼び出し処理などが必要です
}
