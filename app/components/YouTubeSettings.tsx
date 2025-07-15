import { useEffect, useState } from 'react';

interface Props {
  initialMode?: 'latest' | 'manual';
  initialChannelId?: string;
  initialManualUrls?: string[];
  uid?: string;
}

const YouTubeSettings: React.FC<Props> = ({ initialMode = 'latest', initialChannelId = '', initialManualUrls = [], uid }) => {
  const [mode, setMode] = useState<'latest' | 'manual'>(initialMode);
  const [channelId, setChannelId] = useState(initialChannelId);
  const [manualUrls, setManualUrls] = useState<string[]>(initialManualUrls);
  const [showYouTube, setShowYouTube] = useState<boolean | undefined>(undefined);

    useEffect(() => {
      async function fetchInitial() {
        try {
          const sessionRes = await fetch('/session');
          const session = await sessionRes.json();
          if (!session.loggedIn) return;

          const res = await fetch(`/api/user/${session.uid}`);
          const data = await res.json();
          const profile = data.profile || {};

          setMode(profile.youtubeMode || 'latest');
          setChannelId(profile.youtubeChannelId || '');
          setManualUrls(profile.manualYouTubeUrls || []);
          setShowYouTube(profile.settings?.showYouTube !== false); // ✅ ここで初期値を反映
        } catch (e) {
          console.warn('初期データの取得に失敗しました');
        }
      }

      fetchInitial();
    }, []);

  const handleAddManualInput = () => {
    if (manualUrls.length >= 4) return alert('最大4つまで登録できます');
    setManualUrls([...manualUrls, '']);
  };

  const handleManualChange = (index: number, value: string) => {
    const updated = [...manualUrls];
    updated[index] = value;
    setManualUrls(updated);
  };

  const handleSave = async () => {
    if (mode === 'latest') {
      const match = channelId.trim().match(/(UC[\w-]+)/);
      if (!match) return alert('正しいチャンネルIDを入力してください');
    } else {
      const validUrls = manualUrls.filter((url) => url.trim().includes('youtube.com/watch'));
      if (validUrls.length === 0) return alert('URLを1つ以上入力してください');
    }

    const profile = {
      youtubeMode: mode,
      youtubeChannelId: mode === 'latest' ? channelId : '',
      manualYouTubeUrls: mode === 'manual' ? manualUrls : [],
      settings: {
      showYouTube,
  },
    };

    localStorage.setItem('youtubeMode', profile.youtubeMode);
    localStorage.setItem('youtubeChannelId', profile.youtubeChannelId);
    localStorage.setItem('manualYouTubeUrls', JSON.stringify(profile.manualYouTubeUrls));

    try {
      const sessionRes = await fetch('/session');
      const session = await sessionRes.json();
      if (!session.loggedIn) return alert('ログインが必要です');

      const res = await fetch(`/api/user/${session.uid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      });

      if (res.ok) alert('YouTube設定を保存しました');
      else throw new Error('保存に失敗しました');
    } catch (err) {
      console.error('❌ 保存エラー:', err);
      alert('保存に失敗しました');
    }
  };

  return (
    <div className="sns-item">
      <h2>YouTube動画表示設定</h2>
      <div>
        <label>
          <input type="radio" name="youtubeMode" value="latest" checked={mode === 'latest'} onChange={() => setMode('latest')} /> 最新動画
        </label>
        <label>
          <input type="radio" name="youtubeMode" value="manual" checked={mode === 'manual'} onChange={() => setMode('manual')} /> お気に入り動画
        </label>
      </div>

      {mode === 'latest' && (
        <div>
          <input
            type="text"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            placeholder="チャンネルID (UC〜で始まるID)"
          />
          <p className="help-text">
            ※最新動画は最大2本まで表示されます。
          </p>
        </div>
      )}

      {mode === 'manual' && (
        <div>
          {manualUrls.map((url, idx) => (
            <input
              key={idx}
              type="text"
              value={url}
              onChange={(e) => handleManualChange(idx, e.target.value)}
              placeholder={`動画URL ${idx + 1}`}
              className="manualVideoInput"
            />
          ))}
          <button type="button" onClick={handleAddManualInput}>＋入力欄を追加</button>
        </div>
      )}

      <button type="button" onClick={handleSave} className="auth-only">保存</button>
      <label>
      <input
        type="checkbox"
        checked={showYouTube}
        onChange={(e) => setShowYouTube(e.target.checked)}
      />
      YouTubeを表示する
    </label>
    </div>
  );
};

export default YouTubeSettings;
