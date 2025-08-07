// app/api/resolve-tiktok-url/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  try {
    let currentUrl = url;
    let maxRedirects = 5;

    while (maxRedirects > 0) {
      const res = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
      });

      const location = res.headers.get('location');
      if (!location) break; // リダイレクトがなければ終了

      if (location.startsWith('/')) {
        const base = new URL(currentUrl).origin;
        currentUrl = base + location;
      } else {
        currentUrl = location;
      }

      maxRedirects--;
    }

    console.log('✅ 最終的な展開URL:', currentUrl);

    if (!currentUrl.includes('tiktok.com/video/')) {
      return NextResponse.json({ error: 'TikTok動画URLではありません', resolvedUrl: currentUrl }, { status: 400 });
    }

    return NextResponse.json({ resolvedUrl: currentUrl });
  } catch (error) {
    console.error('🔴 TikTok URL解決エラー:', error);
    return NextResponse.json({ error: 'URL解決に失敗しました' }, { status: 500 });
  }
}
