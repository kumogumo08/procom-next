'use client';

import { useEffect, useState } from 'react';
import { ReactNode } from 'react';
import SnsVisibilityToggle from './SnsVisibilityToggle';
import SnsHelpTooltip from './SnsHelpTooltip';
import YouTubeHelpTooltip from '@/components/YouTubeHelpTooltip';
import { fetchUserApi } from '@/lib/userProfileClient';
import { buttonDanger, buttonPrimary, cardActions, cardBody, cardPreviewArea, cardTitle, emptyStateBox, inputBase, snsCardBase } from '@/components/ui/cardStyles';

/** SSR / クライアント双方で同じ結果になる純関数（window / document 非依存） */
function extractVideoId(url: string): string {
  const match = url.match(/(?:v=|\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : '';
}

type Props = {
  uid: string;
  isEditable: boolean;
  hasInitialProfile?: boolean;
  initialMode?: 'latest' | 'manual';
  initialChannelId?: string;
  initialManualUrls?: string[];
  initialShowYouTube?: boolean | undefined;
  onDraftChange?: (draft: {
    youtubeMode: 'latest' | 'manual';
    youtubeChannelId: string;
    manualYouTubeUrls: string[];
    showYouTube?: boolean;
  }) => void;
};

export default function YouTubeEmbedBlock({
  uid,
  isEditable,
  hasInitialProfile,
  initialMode,
  initialChannelId,
  initialManualUrls,
  initialShowYouTube,
  onDraftChange,
}: Props) {
  const [mode, setMode] = useState<'latest' | 'manual'>(initialMode ?? 'latest');
  const [channelId, setChannelId] = useState(initialChannelId ?? '');
  const [manualUrls, setManualUrls] = useState<string[]>(initialManualUrls ?? []);
  const [videoElements, setVideoElements] = useState<ReactNode[]>([]);
  const [showYouTube, setShowYouTube] = useState<boolean | undefined>(initialShowYouTube);
  // 初期化
  useEffect(() => {
    if (hasInitialProfile) return;
    async function fetchData() {
      try {
        const data = await fetchUserApi(uid, { caller: 'YouTubeEmbedBlock', reason: 'initial load (youtube settings)' });
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
  }, [uid, hasInitialProfile]);

  useEffect(() => {
    onDraftChange?.({
      youtubeMode: mode,
      youtubeChannelId: channelId,
      manualYouTubeUrls: manualUrls,
      showYouTube,
    });
  }, [mode, channelId, manualUrls, showYouTube, onDraftChange]);

  // latest のみ API 取得。manual は render 時に URL → videoId する（SSR HTML に載せるため）
  useEffect(() => {
    if (mode !== 'latest' || !channelId) return;

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
  }, [mode, channelId]);

  const manualVideoIds =
    mode === 'manual'
      ? manualUrls
          .map((url) => extractVideoId((url ?? '').trim()))
          .filter((videoId) => videoId !== '')
      : [];

  const manualIframes = manualVideoIds.map((videoId, index) => (
    <iframe
      key={index}
      width="100%"
      height="315"
      src={`https://www.youtube.com/embed/${videoId}`}
      title={`YouTube video ${index}`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    ></iframe>
  ));

  const previewVideos = mode === 'manual' ? manualIframes : videoElements;

  const hasYouTubeContent =
    mode === 'latest'
      ? Boolean(channelId.trim())
      : manualUrls.some((url) => Boolean(extractVideoId((url ?? '').trim())));

  if (!isEditable && (showYouTube === false || !hasYouTubeContent)) {
    return null;
  }

  return (
    <div className="sns-item" id="youtube-section" style={snsCardBase}>
      <h2 style={cardTitle}>YouTube</h2>

      {/* 🔘 表示モード切替 */}
      {isEditable && (
        <div className="sns-section" style={cardBody}>
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
            style={inputBase}
          />
        </div>
      )}

      {isEditable && mode === 'manual' && (
        <div className="sns-section" style={cardBody}>
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
              style={{ ...inputBase, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => {
                const updated = [...manualUrls];
                updated.splice(i, 1);
                setManualUrls(updated);
              }}
              style={{ ...buttonDanger, marginLeft: 8, height: 40, minWidth: 40, padding: '0 12px', borderRadius: 10 }}
            >
              ×
            </button>
          </div>
        ))}
          {manualUrls.length < 4 && (
            <button type="button" onClick={() => setManualUrls([...manualUrls, ''])} style={{ ...buttonPrimary, justifySelf: 'start' }}>
              ＋ 入力欄を追加
            </button>
          )}
        </div>
      )}

      <div style={{ flex: 1 }}>
        {previewVideos.length > 0 ? (
          <div id="videoContainer" className="video-container" style={cardPreviewArea}>
            {previewVideos}
          </div>
        ) : isEditable ? (
          <div style={emptyStateBox}>未設定（チャンネルID / URL を入力するとここに表示されます）</div>
        ) : null}
      </div>

      {isEditable && (
        <div style={cardActions}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <SnsVisibilityToggle
              label="YouTubeを表示する"
              checked={showYouTube ?? true}
              onChange={setShowYouTube}
            />
            <SnsHelpTooltip />
          </div>
        </div>
      )}
    </div>
  );
}
