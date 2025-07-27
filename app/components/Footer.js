import Script from 'next/script';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gradient-to-br from-[#1f1f2e] to-[#38385a] text-white text-center py-8 px-5 mt-16 border-t-4 border-[#ff4f81] shadow-md">
      <p className="text-sm">&copy; 2025 Procom</p>
            {/* 🔽 トップに戻るボタン */}
      <div className="my-4">
        <Link
          href="/top"
          className="inline-block bg-[#ff4f81] text-white px-6 py-2 rounded-full text-sm hover:bg-pink-600 transition"
        >
          トップページに戻る
        </Link>
      </div>
            {/* ✅ 新規登録リンクを追加 */}
      <div className="my-2">
        <Link
          href="/login"
          className="inline-block text-white underline hover:text-pink-400 text-sm"
        >
          ▶ 新規会員登録はこちら
        </Link>
      </div>
        <p className="text-sm text-white">
        <Link href="/privacy"><span className={linkClass}>プライバシーポリシー</span></Link> |
        <Link href="/owner"><span className={linkClass}>運営者情報</span></Link> |
        <Link href="/withdraw"><span className={linkClass}>退会方法</span></Link> |
        <Link href="/terms"><span className={linkClass}>利用規約</span></Link> |
        <Link href="/help"><span className={linkClass}>ヘルプ</span></Link>
        </p>

      {/* ✅ Google Analyticsタグ（Tailwindとは別枠） */}
      <Script
        strategy="afterInteractive"
        src="https://www.googletagmanager.com/gtag/js?id=G-Q35GSFMBR5"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-Q35GSFMBR5');
        `}
      </Script>
    </footer>
  );
}

const linkClass =
  "text-white hover:underline mx-1";
