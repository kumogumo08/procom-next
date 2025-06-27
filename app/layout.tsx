import '../styles/globals.css';

export const metadata = {
  title: 'Procom',
  description: 'あなたのすべてを、ここに集約。SNSプロフィール集約プラットフォーム Procom',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        {/* 必要に応じてGoogle Fontsや外部CSSもこちらでグローバルに追加 */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
