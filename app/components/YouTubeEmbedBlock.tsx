'use client';

import { useEffect, useState } from 'react';
import { ReactNode } from 'react';
import SnsVisibilityToggle from './SnsVisibilityToggle';
import SnsHelpTooltip from './SnsHelpTooltip';
import YouTubeHelpTooltip from '@/components/YouTubeHelpTooltip';

type Props = {
  uid: string;
  isEditable: boolean;
};

export default function YouTubeEmbedBlock({ uid, isEditable }: Props) {
  const [mode, setMode] = useState<'latest' | 'manual'>('latest');
  const [channelId, setChannelId] = useState('');
  const [manualUrls, setManualUrls] = useState<string[]>([]);
  const [videoElements, setVideoElements] = useState<ReactNode[]>([]);
  const [showYouTube, setShowYouTube] = useState<boolean | undefined>(undefined);
  // 初期化
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/user/${uid}`);
        const data = await res.json();
        const profile = data.profile || {};
        setMode(profile.youtubeMode || 'latest');
        setChannelId(profile.youtubeChannelId || '');
        setManualUrls(profile.manualYouTubeUrls || []);
        setShowYouTube(profile.settings?.showYouTube);
      } catch (e) {
        console.warn('YouTube設定の取得に失敗しました');
      }
    }
    fetchData();
  }, [uid]);

  // 表示更新
  useEffect(() => {
    const container: ReactNode[] = [];

    if (mode === 'latest' && channelId) {
      // 🔄 APIから動画ID取得
      fetch(`/api/youtube/${channelId}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data.videos)) {
          const elements = (data.videos as string[]).slice(0, 2).map((videoId: string, index: number) => (
            <iframe
              key={index}
              width="100%"
              height="315"
              src={`https://www.youtube.com/embed/${videoId}`}
              title={`YouTube video player ${index}`}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ));
            setVideoElements(elements);
          }
        });
    } else if (mode === 'manual') {
      manualUrls.forEach((url, index) => {
        const videoId = extractVideoId(url);
        if (videoId) {
          container.push(
            <iframe
              key={index}
              width="100%"
              height="315"
              src={`https://www.youtube.com/embed/${videoId}`}
              title={`YouTube video ${index}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          );
        }
      });
      setVideoElements(container);
    }
  }, [mode, channelId, manualUrls]);
  
  // 保存処理
  const handleSave = async () => {
    const payload = {
      youtubeMode: mode,
      youtubeChannelId: channelId,
      manualYouTubeUrls: manualUrls,
      settings: {
      showYouTube, // ✅ ここを追加
    },
    };
    await fetch(`/api/user/${uid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: payload }),
    });
    alert('YouTube設定を保存しました');
  };

  const extractVideoId = (url: string) => {
    const match = url.match(/(?:v=|\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : '';
  };

  // 🔽 非表示条件を追加（他人のページでYouTubeが未設定 or 表示対象なしなら非表示）
      if (
        !isEditable &&
        (
          showYouTube === false ||
          (mode === 'latest' && !channelId) ||
          (mode === 'manual' && manualUrls.filter(url => !!extractVideoId(url)).length === 0)
        )
      ) {
        return null;
      }

  return (
    <div className="sns-item" id="youtube-section">
      <h2>YouTube動画表示設定</h2>

      {/* 🔘 表示モード切替 */}
      {isEditable && (
        <div className="sns-section">
          <label>
            <input
              type="radio"
              name="youtubeMode"
              value="latest"
              checked={mode === 'latest'}
              onChange={() => setMode('latest')}
            />
            最新動画
          </label>
          <label>
            <input
              type="radio"
              name="youtubeMode"
              value="manual"
              checked={mode === 'manual'}
              onChange={() => setMode('manual')}
            />
            お気に入り動画
          </label>

          <YouTubeHelpTooltip />
        </div>
      )}

      {/* 🔽 入力欄 */}
      {isEditable && mode === 'latest' && (
        <div className="sns-section">
          <input
            type="text"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            placeholder="チャンネルID（UC〜）"
          />
        </div>
      )}

      {isEditable && mode === 'manual' && (
        <div className="sns-section">
          {manualUrls.map((url, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <input
              type="text"
              value={url}
              placeholder={`動画URL ${i + 1}`}
              onChange={(e) => {
                const updated = [...manualUrls];
                updated[i] = e.target.value;
                setManualUrls(updated);
              }}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={() => {
                const updated = [...manualUrls];
                updated.splice(i, 1);
                setManualUrls(updated);
              }}
              style={{
                marginLeft: '8px',
                background: 'red',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
        ))}
          {manualUrls.length < 4 && (
            <button type="button" onClick={() => setManualUrls([...manualUrls, ''])}>
              ＋ 入力欄を追加
            </button>
          )}
        </div>
      )}

      {isEditable && (
        <button type="button" onClick={handleSave}>
          保存
        </button>
        
      )}
        {isEditable && (
          <SnsVisibilityToggle
            label="YouTubeを表示する"
            checked={showYouTube ?? true}
            onChange={setShowYouTube}
          />
        )}
        <SnsHelpTooltip />
      {/* 🔽 表示 */}
      <div id="videoContainer" className="video-container">
        {videoElements}
      </div>
    </div>
  );
}
