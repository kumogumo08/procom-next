import { useEffect } from 'react';

export function showXProfile(username: string) {
  const container = document.getElementById('xProfileDisplay');
  if (!container || !username) return;
  container.innerHTML = `
    <div style="text-align: center;">
      <a href="https://twitter.com/${username}" target="_blank" class="x-profile-link">
        <img class="x-profile-image" src="https://unavatar.io/twitter/${username}" />
        <br>@${username} のプロフィールを見る
      </a>
    </div>
  `;
  container.style.display = 'block';
}

export function embedInstagramPost(url: string) {
  const container = document.getElementById('instagramPostContainer');
  if (!container || !url) return;
  container.innerHTML = `
    <blockquote class="instagram-media" data-instgrm-permalink="${url}" data-instgrm-version="14"></blockquote>
  `;

  if ((window as any).instgrm) {
    (window as any).instgrm.Embeds.process();
  }
  container.style.display = 'block';
}

function extractTikTokVideoId(url: string): string | null {
  const match = url.match(/\/video\/(\d+)/);
  return match ? match[1] : null;
}

export function displayTikTokVideos(urls: string[]) {
  const container = document.getElementById('tiktok-container');
  if (!container || !Array.isArray(urls)) return;

  container.innerHTML = '';

  urls.slice(0, 3).forEach((url) => {
    const videoId = extractTikTokVideoId(url);
    if (!videoId) return;

    const iframe = document.createElement('iframe');
    iframe.src = `https://www.tiktok.com/embed/${videoId}`;
    iframe.width = '100%';
    iframe.height = '800';
    iframe.allow = 'autoplay; encrypted-media';
    iframe.frameBorder = '0';
    iframe.allowFullscreen = true;
    iframe.loading = 'lazy';
    iframe.style.marginBottom = '20px';

    container.appendChild(iframe);
  });
}
