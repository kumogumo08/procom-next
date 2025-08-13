'use client';

import { useEffect, useState } from 'react';

const MAX_OSHI_PER_DAY = 5;
const getTodayKey = (uid: string) => {
  const today = new Date();
  return `oshi-${uid}-${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
};

export default function OshiButton({ uid }: { uid: string }) {
  const [totalCount, setTotalCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [animate, setAnimate] = useState(false); // 🔹 アニメーション制御用

  useEffect(() => {
    const todayKey = getTodayKey(uid);
    const today = parseInt(localStorage.getItem(todayKey) || '0', 10);
    setTodayCount(today);

    fetch(`/api/oshi/${uid}`)
      .then(res => res.json())
      .then(data => {
        setTotalCount(data.oshiCount ?? 0);
      });
  }, [uid]);

  const handleOshi = async () => {
    const todayKey = getTodayKey(uid);
    let today = parseInt(localStorage.getItem(todayKey) || '0', 10);

    if (today >= MAX_OSHI_PER_DAY) {
      alert('今日の推し活完了！また明日✨');
      return;
    }

    // アニメーション開始
    setAnimate(true);

    // localStorage更新
    today++;
    localStorage.setItem(todayKey, String(today));
    setTodayCount(today);

    // Firestoreへ推し数を加算
    const res = await fetch(`/api/oshi/${uid}`, { method: 'POST' });
    if (res.ok) {
      setTotalCount(prev => prev + 1);
    } else {
      alert('推しに失敗しました...');
    }
  };

  return (
    <div className="oshi-container">
      <button
        className={`oshi-button ${animate ? 'animate' : ''}`}
        onClick={handleOshi}
        onAnimationEnd={() => setAnimate(false)} // 🔹 終了時にクラス解除
      >
        ❤️ 推す！
      </button>
        <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '6px' }}>
      （1日{MAX_OSHI_PER_DAY}回まで押せます）
        </p>
      <p>✨ 合計推し数：<span>{totalCount}</span></p>
      <p>📅 今日の推し数：<span>{todayCount}</span> / {MAX_OSHI_PER_DAY}</p>

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

        .oshi-button:hover {
          opacity: 0.9;
          transform: scale(1.05);
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
