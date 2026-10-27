import { NextRequest, NextResponse } from 'next/server';
import { resolveTikTokVideoUrl, TikTokResolveError } from '@/lib/tiktokResolve';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let url: unknown;
  try {
    const body = (await req.json()) as { url?: unknown } | null;
    url = body?.url;
  } catch {
    return NextResponse.json({ error: 'TikTok動画URLではありません' }, { status: 400 });
  }

  try {
    const resolvedUrl = await resolveTikTokVideoUrl(url);
    return NextResponse.json({ resolvedUrl });
  } catch (err: unknown) {
    if (err instanceof TikTokResolveError && err.status === 400) {
      return NextResponse.json({ error: 'TikTok動画URLではありません' }, { status: 400 });
    }
    console.error('TikTok URL解決エラー');
    return NextResponse.json({ error: 'URL解決に失敗しました' }, { status: 500 });
  }
}
