// app/deleted/page.tsx
'use client';

import Head from 'next/head';
import { useEffect } from 'react';
import AuthPageShell from '@/components/AuthPageShell';

export default function DeletedPage() {
  useEffect(() => {
    document.title = '退会完了 - Procom';
  }, []);

  return (
    <>
      <AuthPageShell>
      <div className="deleted-box">
        <h1>退会が完了しました</h1>
        <p>ご利用ありがとうございました。またのご利用をお待ちしております。</p>
        <a href="/top" className="button">トップページに戻る</a>
      </div>
      </AuthPageShell>

      <style jsx>{`
        .deleted-box {
          width: min(600px, 100%);
          box-sizing: border-box;
          margin: 0 auto;
          background: white;
          padding: 32px 20px;
          border-radius: 16px;
          box-shadow: 0 12px 32px rgba(4, 8, 28, 0.28);
          text-align: center;
        }
        h1 {
          font-size: 2rem;
          color: #333;
          margin-bottom: 20px;
        }
        p {
          font-size: 1.1rem;
          color: #666;
          margin-bottom: 30px;
        }
        .button {
          display: inline-block;
          padding: 12px 30px;
          background-color: #4e73df;
          color: #fff;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
        }
      `}</style>
    </>
  );
}
