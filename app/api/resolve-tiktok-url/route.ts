// app/api/resolve-tiktok-url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fetch from 'node-fetch';

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    const resolvedUrl = res.url;

    if (!resolvedUrl.includes('tiktok.com/video/')) {
      return NextResponse.json({ error: 'TikTok動画URLではありません' }, { status: 400 });
    }

    return NextResponse.json({ resolvedUrl });
  } catch (error) {
    console.error('🔴 TikTok URL解決エラー:', error);
    return NextResponse.json({ error: 'URL解決に失敗しました' }, { status: 500 });
  }
}
