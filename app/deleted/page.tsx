// app/deleted/page.tsx
'use client';

import Head from 'next/head';
import { useEffect } from 'react';
import Header from '@/components/Headerlogin';
import Footer from '@/components/Footer';

export default function DeletedPage() {
  useEffect(() => {
    document.title = '退会完了 - Procom';
  }, []);

  return (
    <>
      <Header />

      <main className="deleted-box">
        <h1>退会が完了しました</h1>
        <p>ご利用ありがとうございました。またのご利用をお待ちしております。</p>
        <a href="/top" className="button">トップページに戻る</a>
      </main>

      <Footer />

      <style jsx>{`
        .deleted-box {
          max-width: 600px;
          margin: 60px auto;
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
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
