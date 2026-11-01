import { NextRequest, NextResponse } from 'next/server';
import { getYouTubeLatestVideos } from '@/lib/youtubeLatest';

export const runtime = 'nodejs';

const SUCCESS_CACHE = 'public, s-maxage=43200, stale-while-revalidate=86400';
const ERROR_CACHE = 'public, max-age=60, s-maxage=300';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ channelId: string }> }
): Promise<NextResponse> {
  const { channelId } = await context.params;
  const result = await getYouTubeLatestVideos(channelId ?? '');
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status, headers: { 'Cache-Control': result.status === 400 ? 'private, no-store' : ERROR_CACHE } }
    );
  }
  return NextResponse.json(
    {
      message: 'YouTube チャンネルIDを正常に受け取りました',
      channelId: result.channelId,
      videos: result.videos,
    },
    { headers: { 'Cache-Control': SUCCESS_CACHE } }
  );
}
