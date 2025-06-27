// lib/sns.ts

declare global {
  interface Window {
    instgrm?: {
      Embeds: {
        process: () => void;
      };
    };
    twttr?: {
      widgets: {
        load: () => void;
      };
    };
  }
}

// Instagram 埋め込み
export function embedInstagramPost(url: string) {
  const container = document.getElementById('instagramEmbed');
  if (!container) return;

  container.innerHTML = `
    <blockquote class="instagram-media" data-instgrm-permalink="${url}" data-instgrm-version="14"></blockquote>
  `;

  window.instgrm?.Embeds?.process();
}

// X（旧Twitter）表示
export function showXProfile(username: string) {
  const container = document.getElementById('xEmbed');
  if (!container) return;

  container.innerHTML = `
    <a class="twitter-timeline" href="https://twitter.com/${username}?ref_src=twsrc%5Etfw">Tweets by ${username}</a>
  `;

  window.twttr?.widgets?.load();
}

// TikTok埋め込み
export function displayTikTokVideos(urls: string[]) {
  const container = document.getElementById('tiktokEmbed');
  if (!container) return;

  container.innerHTML = '';
  urls.forEach((url) => {
    const block = document.createElement('blockquote');
    block.className = 'tiktok-embed';
    block.setAttribute('cite', url);
    block.setAttribute('data-video-id', '');
    block.innerHTML = `<a href="${url}">TikTok</a>`;
    container.appendChild(block);
  });

  // 既に存在する script を確認し、なければ追加
  const existingScript = document.querySelector('script[src="https://www.tiktok.com/embed.js"]');
  if (!existingScript) {
    const script = document.createElement('script');
    script.src = 'https://www.tiktok.com/embed.js';
    script.async = true;
    document.body.appendChild(script);
  } else {
    // 再読み込み（必要な場合）
    (window as any).tiktokEmbedLoad?.();
  }
}

export async function fetchLatestVideos(channelId: string) {
  try {
    const res = await fetch(`/api/youtube/${channelId}`);
    if (!res.ok) throw new Error('動画取得失敗');
    const data = await res.json();

    const container = document.getElementById('youtubeLatestEmbed');
    if (!container) return;

    container.innerHTML = '';
    data.videos.slice(0, 2).forEach((video: any) => {
      const iframe = document.createElement('iframe');
      iframe.width = '100%';
      iframe.height = '200';
      iframe.src = `https://www.youtube.com/embed/${video.videoId}`;
      iframe.frameBorder = '0';
      iframe.allow =
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      container.appendChild(iframe);
    });
  } catch (err) {
    console.error('❌ fetchLatestVideos エラー:', err);
  }
}
