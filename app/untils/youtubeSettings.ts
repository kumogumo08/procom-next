// src/utils/youtubeSettings.ts

export async function saveYouTubeSettingsToServer(
  mode: 'latest' | 'manual',
  channelId: string,
  manualUrls: string[]
): Promise<void> {
  try {
    const sessionRes = await fetch('/session');
    const session = await sessionRes.json();
    if (!session.loggedIn) {
      alert('ログインが必要です');
      return;
    }

    // localStorage に保存
    localStorage.setItem('youtubeMode', mode);
    localStorage.setItem('youtubeChannelId', channelId || '');
    localStorage.setItem('manualYouTubeUrls', JSON.stringify(manualUrls || []));

    const response = await fetch(`/api/user/${session.uid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: {
          youtubeMode: mode,
          youtubeChannelId: channelId,
          manualYouTubeUrls: manualUrls
        }
      })
    });

    if (response.ok) {
      alert('YouTube設定を保存しました');
    } else {
      throw new Error('保存失敗');
    }
  } catch (err) {
    console.error('❌ YouTube設定保存エラー:', err);
    alert('保存に失敗しました');
  }
}

export function addManualVideoInput(containerId: string): void {
  const container = document.getElementById(containerId);
  if (!container) return;
  const count = container.querySelectorAll('.manualVideoInput').length + 1;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'manualVideoInput';
  input.placeholder = `動画URL ${count}`;

  container.appendChild(document.createElement('br'));
  container.appendChild(input);
}

export function initializeYouTubeAndSNS(uid: string) {
  fetch(`/api/user/${uid}`)
    .then(res => res.json())
    .then(data => {
      const profile = data.profile || data;

      // ▼ X表示
      if (profile.xUsername) {
        const xInput = document.getElementById('xUsernameInput') as HTMLInputElement;
        if (xInput) xInput.value = profile.xUsername;
        window.showXProfile?.(profile.xUsername);
      }

      // ▼ Instagram表示
      if (profile.instagramPostUrl) {
        const igInput = document.getElementById('instagramPostLink') as HTMLInputElement;
        if (igInput) igInput.value = profile.instagramPostUrl;
        window.embedInstagramPost?.('');
      }

      // ▼ YouTube表示
      if (profile.youtubeMode === 'latest' && profile.youtubeChannelId) {
        const ytInput = document.getElementById('channelIdInput') as HTMLInputElement;
        if (ytInput) ytInput.value = profile.youtubeChannelId;
        window.fetchLatestVideos?.(profile.youtubeChannelId);
      } else if (profile.youtubeMode === 'manual') {
        const urls = profile.manualYouTubeUrls || [];
        const textarea = document.getElementById('manualYouTubeUrls') as HTMLTextAreaElement;
        if (textarea) textarea.value = urls.join('\n');
        window.displayManualYouTubeVideos?.(urls);
      }

      // ▼ TikTok表示
      if (Array.isArray(profile.tiktokUrls)) {
        window.displayTikTokVideos?.(profile.tiktokUrls);
      }
    })
    .catch(err => {
      console.error("❌ Firestoreからのユーザーデータ取得エラー:", err);
    });
}
