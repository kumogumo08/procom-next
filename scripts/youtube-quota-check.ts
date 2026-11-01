/**
 * YouTube 最新動画の検証とキャッシュ。実APIと本番Firebaseには接続しない。
 * 実行: npx tsx scripts/youtube-quota-check.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { GET } from '../app/api/youtube/[channelId]/route';
import {
  YOUTUBE_ERROR_TTL_MS,
  YOUTUBE_SUCCESS_TTL_MS,
  YOUTUBE_UPSTREAM_BURST,
  YOUTUBE_UPSTREAM_DAILY,
  YOUTUBE_UPSTREAM_DAILY_WINDOW_MS,
  getYouTubeLatestVideos,
  normalizeYouTubeChannelId,
  resetYouTubeLatestForTests,
  setYouTubeClockForTests,
  shouldFetchYouTubeLatest,
} from '../app/lib/youtubeLatest';

const SECRET = 'yt-test-key';
const ID_A = 'UCabcdefghijklmnopqrstuv';
const ID_B = 'UCzyxwvutsrqponmlkjihgfe';
const VIDEO = 'abcdefghijk';

process.env.YOUTUBE_API_KEY = SECRET;

type Status = 'pass' | 'fail';
const rows: Array<{ item: string; status: Status; note: string }> = [];

function row(item: string, ok: boolean, note: string): void {
  rows.push({ item, status: ok ? 'pass' : 'fail', note });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${item}: ${note}`);
}

let calls = 0;
let upstreamStatus = 200;
let upstreamBody: unknown = { items: [{ contentDetails: { videoId: VIDEO } }, { contentDetails: { videoId: 'bad id' } }] };
let seenUrl = '';
let hang = false;

function installFetch(): void {
  global.fetch = (async (input: RequestInfo | URL) => {
    calls += 1;
    seenUrl = String(input);
    if (hang) {
      throw Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    }
    if (upstreamStatus !== 200) {
      return new Response(JSON.stringify({ error: { message: SECRET } }), { status: upstreamStatus });
    }
    return new Response(JSON.stringify(upstreamBody), { status: 200 });
  }) as typeof fetch;
}

function reset(status = 200): void {
  resetYouTubeLatestForTests();
  calls = 0;
  seenUrl = '';
  hang = false;
  upstreamStatus = status;
  upstreamBody = { items: [{ contentDetails: { videoId: VIDEO } }] };
  installFetch();
}

async function textOf(channelId: string): Promise<{ status: number; text: string; json: Record<string, unknown> }> {
  const res = await GET(new NextRequest(`http://127.0.0.1/api/youtube/${encodeURIComponent(channelId)}`), {
    params: Promise.resolve({ channelId }),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = {};
  }
  return { status: res.status, text, json };
}

async function main(): Promise<number> {
  reset();
  const ok = await textOf(ID_A);
  const playlistId = `UU${ID_A.slice(2)}`;
  row(
    '1. 正常なchannelId',
    ok.status === 200 &&
      ok.json.channelId === ID_A &&
      Array.isArray(ok.json.videos) &&
      (ok.json.videos as string[])[0] === VIDEO &&
      seenUrl.startsWith('https://www.googleapis.com/youtube/v3/playlistItems?') &&
      seenUrl.includes(`playlistId=${playlistId}`) &&
      !seenUrl.includes(ID_A) &&
      calls === 1,
    `HTTP ${ok.status} calls=${calls}`
  );

  reset();
  const rejected: Array<[string, string]> = [
    ['空', ''],
    ['スラッシュ', `${ID_A}/../secret`],
    ['クエリ', `${ID_A}?key=1`],
    ['改行', `${ID_A}\n`],
    ['制御文字', `${ID_A}\u0000`],
    ['長すぎる', `UC${'a'.repeat(200)}`],
    ['ハンドル', '@procom'],
    ['外部URL', `https://evil.example/channel/${ID_A}`],
    ['動画URL', 'https://www.youtube.com/watch?v=abcdefghijk'],
  ];
  let rejectOk = true;
  for (const [label, value] of rejected) {
    const result = await getYouTubeLatestVideos(value);
    if (result.ok || result.status !== 400 || calls !== 0) {
      rejectOk = false;
      row('2. 不正なchannelId', false, `${label} status=${result.ok ? 200 : result.status} calls=${calls}`);
      break;
    }
  }
  if (rejectOk) row('2. 不正なchannelIdは400でAPIを呼ばない', true, `${rejected.length}件`);

  reset();
  const channelUrl = `https://www.youtube.com/channel/${ID_A}?si=share`;
  row(
    'YouTubeのチャンネルURLはIDだけを使う',
    normalizeYouTubeChannelId(channelUrl) === ID_A && normalizeYouTubeChannelId(`https://m.youtube.com/channel/${ID_A}/videos`) === ID_A,
    'queryとvideos付きURL'
  );

  reset();
  await getYouTubeLatestVideos(ID_A);
  await getYouTubeLatestVideos(channelUrl);
  await getYouTubeLatestVideos(ID_A);
  row('3. 同じchannelIdの連続アクセス', calls === 1, `calls=${calls}`);

  reset();
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  global.fetch = (async (input: RequestInfo | URL) => {
    calls += 1;
    seenUrl = String(input);
    await gate;
    return new Response(JSON.stringify({ items: [{ contentDetails: { videoId: VIDEO } }] }), { status: 200 });
  }) as typeof fetch;
  const first = getYouTubeLatestVideos(ID_A);
  const second = getYouTubeLatestVideos(ID_A);
  release();
  const both = await Promise.all([first, second]);
  row(
    '4. 同時アクセスは1回',
    calls === 1 && both.every((item) => item.ok && item.videos[0] === VIDEO),
    `calls=${calls}`
  );

  reset();
  await getYouTubeLatestVideos(ID_A);
  await getYouTubeLatestVideos(ID_B);
  row('5. 異なるchannelId', calls === 2, `calls=${calls}`);

  reset();
  let now = 1_000_000;
  setYouTubeClockForTests(() => now);
  await getYouTubeLatestVideos(ID_A);
  now += YOUTUBE_SUCCESS_TTL_MS - 1;
  await getYouTubeLatestVideos(ID_A);
  now += 2;
  await getYouTubeLatestVideos(ID_A);
  row('6. キャッシュ期限切れ', calls === 2, `calls=${calls}`);

  async function upstreamError(label: string, status: number, timeout = false): Promise<void> {
    reset(status);
    hang = timeout;
    const failed = await textOf(ID_A);
    const after = calls;
    const again = await textOf(ID_A);
    row(
      label,
      failed.status === 503 &&
        again.status === 503 &&
        after === 1 &&
        calls === 1 &&
        !failed.text.includes(SECRET) &&
        !again.text.includes(SECRET),
      `HTTP ${failed.status} calls=${calls}`
    );
  }

  await upstreamError('7. YouTube 403', 403);
  await upstreamError('8. YouTube 429', 429);
  await upstreamError('9. YouTube 500', 500);
  await upstreamError('10. タイムアウト', 200, true);

  reset();
  const hidden = await textOf(ID_A);
  row('11. レスポンスにAPIキーを含めない', hidden.status === 200 && !hidden.text.includes(SECRET), `HTTP ${hidden.status}`);

  const block = readFileSync(join(import.meta.dirname, '../app/components/YouTubeEmbedBlock.tsx'), 'utf8');
  row(
    '12. プロフィールのYouTube表示',
    block.includes('https://www.youtube.com/embed/${videoId}') &&
      block.includes('data.videos') &&
      block.includes('encodeURIComponent(id)') &&
      !block.includes('YOUTUBE_API_KEY'),
    'iframeとvideosを維持'
  );

  row(
    '13. 未設定や非表示ではAPIを呼ばない',
    shouldFetchYouTubeLatest({ mode: 'latest', channelId: '', isEditable: false, showYouTube: true }) === false &&
      shouldFetchYouTubeLatest({ mode: 'manual', channelId: ID_A, isEditable: false, showYouTube: true }) === false &&
      shouldFetchYouTubeLatest({ mode: 'latest', channelId: ID_A, isEditable: false, showYouTube: false }) === false &&
      shouldFetchYouTubeLatest({ mode: 'latest', channelId: ID_A, isEditable: false, showYouTube: undefined }) === true &&
      shouldFetchYouTubeLatest({ mode: 'latest', channelId: ID_A, isEditable: true, showYouTube: false }) === true,
    'manual・空・非表示'
  );

  reset();
  now = 5_000_000;
  setYouTubeClockForTests(() => now);
  for (let i = 0; i < YOUTUBE_UPSTREAM_BURST; i += 1) {
    const id = `UC${i.toString(36).padStart(22, 'a')}`;
    await getYouTubeLatestVideos(id);
  }
  const blocked = await getYouTubeLatestVideos(ID_B);
  const blockedCalls = calls;
  now += 60_000;
  await getYouTubeLatestVideos(ID_B);
  row(
    '上限を超えたらYouTubeを呼ばない',
    blocked.ok === false && blocked.status === 503 && blockedCalls === YOUTUBE_UPSTREAM_BURST && calls === YOUTUBE_UPSTREAM_BURST + 1,
    `calls=${blockedCalls}`
  );

  reset(404);
  now = 9_000_000;
  setYouTubeClockForTests(() => now);
  const missing = await textOf(ID_A);
  const missingCalls = calls;
  await textOf(ID_A);
  now += YOUTUBE_ERROR_TTL_MS;
  await textOf(ID_A);
  row(
    '404は再試行間隔を空ける',
    missing.status === 404 && !missing.text.includes(SECRET) && missingCalls === 1 && calls === 2,
    `HTTP ${missing.status} calls=${calls}`
  );

  function channelId(n: number): string {
    return `UC${n.toString(36).padStart(22, '0')}`;
  }

  reset();
  now = 20_000_000;
  setYouTubeClockForTests(() => now);
  await getYouTubeLatestVideos(ID_A);
  for (let i = 0; i < YOUTUBE_UPSTREAM_BURST - 1; i += 1) {
    await getYouTubeLatestVideos(channelId(i));
  }
  const floodCalls = calls;
  for (let i = 0; i < 4000; i += 1) {
    await getYouTubeLatestVideos(channelId(100_000 + i));
  }
  const evicted = await getYouTubeLatestVideos(ID_A);
  row(
    'キャッシュは4000件で止まりYouTubeを追加で呼ばない',
    calls === floodCalls && evicted.ok === false && evicted.status === 503,
    `calls=${calls}`
  );

  reset();
  now = 30_000_000;
  setYouTubeClockForTests(() => now);
  await getYouTubeLatestVideos(ID_A);
  for (let i = 0; i < YOUTUBE_UPSTREAM_BURST - 1; i += 1) {
    await getYouTubeLatestVideos(channelId(i));
  }
  for (let i = 0; i < 10; i += 1) {
    await getYouTubeLatestVideos(channelId(50_000 + i));
  }
  const kept = await getYouTubeLatestVideos(ID_A);
  row(
    '上限内の成功キャッシュは維持する',
    kept.ok === true && kept.videos[0] === VIDEO && calls === YOUTUBE_UPSTREAM_BURST,
    `calls=${calls}`
  );

  reset();
  now = 40_000_000;
  setYouTubeClockForTests(() => now);
  let issued = 0;
  while (issued < YOUTUBE_UPSTREAM_DAILY) {
    const room = Math.min(YOUTUBE_UPSTREAM_BURST, YOUTUBE_UPSTREAM_DAILY - issued);
    for (let i = 0; i < room; i += 1) {
      await getYouTubeLatestVideos(channelId(issued));
      issued += 1;
    }
    now += 60_000;
  }
  const dailyBlocked = await getYouTubeLatestVideos(channelId(issued));
  const dailyCalls = calls;
  const stillShown = await getYouTubeLatestVideos(channelId(0));
  now += YOUTUBE_SUCCESS_TTL_MS;
  const staleShown = await getYouTubeLatestVideos(channelId(0));
  now += YOUTUBE_UPSTREAM_DAILY_WINDOW_MS;
  await getYouTubeLatestVideos(channelId(issued));
  row(
    '1日2000回を超えたらYouTubeを呼ばず表示を維持する',
    dailyBlocked.ok === false &&
      dailyCalls === YOUTUBE_UPSTREAM_DAILY &&
      stillShown.ok === true &&
      stillShown.videos[0] === VIDEO &&
      staleShown.ok === true &&
      staleShown.videos[0] === VIDEO &&
      calls === YOUTUBE_UPSTREAM_DAILY + 1,
    `calls=${dailyCalls}`
  );

  reset();
  upstreamBody = {
    items: [
      {},
      { contentDetails: {} },
      { contentDetails: { videoId: 'short' } },
      { contentDetails: { videoId: 'abcdefghijk' } },
      { contentDetails: { videoId: 'shortsvideo' } },
      { contentDetails: { videoId: 'livestream1' } },
      { contentDetails: { videoId: 'sixthvideox' } },
      { contentDetails: { videoId: 'videofive01' } },
      { contentDetails: { videoId: 'videosix001' } },
    ],
  };
  const mixed = await getYouTubeLatestVideos(ID_A);
  row(
    'videoIdだけを順序どおり最大5件返す',
    mixed.ok === true &&
      mixed.videos.join(',') === 'abcdefghijk,shortsvideo,livestream1,sixthvideox,videofive01' &&
      seenUrl.includes(`playlistId=UU${ID_A.slice(2)}`),
    mixed.ok ? mixed.videos.join(',') : 'failed'
  );

  reset();
  upstreamBody = { items: [] };
  const emptyList = await getYouTubeLatestVideos(ID_A);
  const emptyCalls = calls;
  await getYouTubeLatestVideos(ID_A);
  row(
    '空の再生リストは再取得しない',
    emptyList.ok === true && emptyList.videos.length === 0 && emptyCalls === 1 && calls === 1,
    `calls=${calls}`
  );

  reset();
  const withCookie = await GET(new NextRequest('http://127.0.0.1/api/youtube/' + ID_A, { headers: { cookie: 'procom_session=viewer' } }), {
    params: Promise.resolve({ channelId: ID_A }),
  });
  const withoutCookie = await GET(new NextRequest('http://127.0.0.1/api/youtube/' + ID_A), {
    params: Promise.resolve({ channelId: ID_A }),
  });
  const cookieText = await withCookie.text();
  const plainText = await withoutCookie.text();
  const middleware = readFileSync(join(import.meta.dirname, '../middleware.ts'), 'utf8');
  row(
    'Cookieで結果が変わらず他APIのno-storeは残る',
    cookieText === plainText &&
      !cookieText.includes(SECRET) &&
      withCookie.headers.get('set-cookie') == null &&
      (withCookie.headers.get('cache-control') ?? '').includes('s-maxage=43200') &&
      !(withCookie.headers.get('cache-control') ?? '').includes('no-store') &&
      middleware.includes("path.startsWith('/api/youtube/')") &&
      middleware.includes("'Cache-Control', 'private, no-store'"),
    withCookie.headers.get('cache-control') ?? 'no-cache-header'
  );

  const failed = rows.filter((item) => item.status === 'fail');
  console.log(`${rows.length - failed.length}/${rows.length} passed`);
  return failed.length === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.name : 'error');
    process.exit(1);
  });
