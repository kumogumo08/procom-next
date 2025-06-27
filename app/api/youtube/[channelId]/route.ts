// app/api/youtube/[channelId]/route.ts

export const runtime = 'nodejs'; 

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  contextPromise: Promise<{ params: { channelId?: string } }>
): Promise<NextResponse> {
  try {
    const { params } = await contextPromise;
    const channelId = params?.channelId;

    if (!channelId) {
      return NextResponse.json({ error: 'channelId が指定されていません' }, { status: 400 });
    }

    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'YouTube APIキーが未設定です' }, { status: 500 });
    }

    const url = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet,id&order=date&maxResults=5`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error('YouTube API エラー');
    }

    const json = await res.json();

    const videos = (json.items || [])
      .filter((item: any) => item.id.kind === 'youtube#video')
      .map((item: any) => item.id.videoId);

    return NextResponse.json({
      message: 'YouTube チャンネルIDを正常に受け取りました',
      channelId,
      videos,
    });

  } catch (err) {
    console.error('❌ YouTube APIルートでエラー:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
