'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_OSHI_PER_DAY = 5;
const LIMIT_MESSAGE = '今日の推し活完了！また明日✨';

type OshiResponse = {
  success?: boolean;
  reason?: string;
  todayCount?: number;
  totalCount?: number;
  oshiCount?: number;
};

function readCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
}

export default function OshiButton({ uid }: { uid: string }) {
  const [totalCount, setTotalCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [posting, setPosting] = useState(false);
  const [animate, setAnimate] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const postingRef = useRef(false);

  const applyCounts = useCallback((data: OshiResponse) => {
    const today = readCount(data.todayCount);
    if (today !== null) setTodayCount(today);
    const total = readCount(data.totalCount) ?? readCount(data.oshiCount);
    if (total !== null) setTotalCount(total);
  }, []);

  const refreshCounts = useCallback(() => {
    if (postingRef.current) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetch(`/api/oshi/${encodeURIComponent(uid)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data: OshiResponse) => {
        if (controller.signal.aborted || postingRef.current) return;
        applyCounts(data);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      })
      .finally(() => {
        if (!controller.signal.aborted) setReady(true);
      });
  }, [applyCounts, uid]);

  useEffect(() => {
    setTotalCount(0);
    setReady(false);
    refreshCounts();
    return () => {
      abortRef.current?.abort();
    };
  }, [refreshCounts]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refreshCounts();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshCounts();
    };
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshCounts]);

  const reached = todayCount >= MAX_OSHI_PER_DAY;
  const disabled = !ready || posting || reached;

  const handleOshi = async () => {
    if (postingRef.current) return;
    if (todayCount >= MAX_OSHI_PER_DAY) {
      alert(LIMIT_MESSAGE);
      return;
    }

    postingRef.current = true;
    setPosting(true);
    setAnimate(true);
    abortRef.current?.abort();

    try {
      const res = await fetch(`/api/oshi/${encodeURIComponent(uid)}`, {
        method: 'POST',
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => ({}))) as OshiResponse;
      if (res.ok && data.success) {
        applyCounts(data);
        return;
      }
      if (data.reason === 'daily_limit') {
        const today = readCount(data.todayCount);
        setTodayCount(today ?? MAX_OSHI_PER_DAY);
        alert(LIMIT_MESSAGE);
        return;
      }
      alert('推しに失敗しました...');
    } catch {
      alert('推しに失敗しました...');
    } finally {
      postingRef.current = false;
      setPosting(false);
    }
  };

  return (
    <div className="oshi-container">
      <button
        type="button"
        className={`oshi-button ${animate ? 'animate' : ''}`}
        onClick={handleOshi}
        onAnimationEnd={() => setAnimate(false)}
        disabled={disabled}
      >
        ❤️ 推す！
      </button>
      <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '6px' }}>
        （1日合計{MAX_OSHI_PER_DAY}回まで押せます）
      </p>
      {reached && (
        <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '6px' }}>{LIMIT_MESSAGE}</p>
      )}
      <p>✨ 合計推し数：<span>{totalCount}</span></p>
      <p>📅 今日使った推し数：<span>{todayCount}</span> / {MAX_OSHI_PER_DAY}</p>

      <style jsx>{`
        .oshi-container {
          text-align: center;
          background: #eef7ff;
          padding: 16px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 100, 255, 0.1);
          font-family: 'Segoe UI', sans-serif;
          max-width: 300px;
          margin: 20px auto;
        }

        .oshi-button {
          background: linear-gradient(135deg, #4facfe, #00f2fe);
          color: white;
          font-size: 1.1rem;
          padding: 10px 20px;
          border: none;
          border-radius: 30px;
          cursor: pointer;
          transition: 0.3s ease;
        }

        .oshi-button:hover:not(:disabled) {
          opacity: 0.9;
          transform: scale(1.05);
        }

        .oshi-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .oshi-button.animate {
          animation: pop 0.4s ease-in-out;
        }

        @keyframes pop {
          0% {
            transform: scale(1);
          }
          30% {
            transform: scale(1.3);
          }
          60% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
