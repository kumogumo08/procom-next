/**
 * TikTok URL 解決の SSRF 回帰。外部ネットワークと Firebase には接続しない。
 * 実行: npx tsx scripts/tiktok-ssrf-check.ts
 */
import type { LookupAddress } from 'node:dns';
import { NextRequest } from 'next/server';
import { POST } from '@/api/resolve-tiktok-url/route';
import {
  createSafeLookup,
  isBlockedIp,
  resolveTikTokVideoUrl,
  selectPublicAddresses,
  TikTokResolveError,
  type TikTokFetch,
} from '@/lib/tiktokResolve';

const rows: Array<{ item: string; ok: boolean; note: string }> = [];

function row(item: string, ok: boolean, note: string): void {
  rows.push({ item, ok, note });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${item}: ${note}`);
}

function headers(location: string | null): { get(name: string): string | null } {
  return {
    get(name: string) {
      return name.toLowerCase() === 'location' ? location : null;
    },
  };
}

async function expectAllow(item: string, raw: string, fetchImpl: TikTokFetch, resolved: string): Promise<void> {
  try {
    const actual = await resolveTikTokVideoUrl(raw, fetchImpl);
    row(item, actual === resolved, actual);
  } catch (err: unknown) {
    row(item, false, err instanceof Error ? err.name : 'error');
  }
}

async function expectReject(
  item: string,
  raw: string,
  fetchImpl: TikTokFetch,
  status: 400 | 500,
  calls: number
): Promise<void> {
  let called = 0;
  const wrapped: TikTokFetch = async (url) => {
    called += 1;
    return fetchImpl(url);
  };
  try {
    const resolved = await resolveTikTokVideoUrl(raw, wrapped);
    row(item, false, `resolved ${resolved}`);
  } catch (err: unknown) {
    const safe = err instanceof TikTokResolveError && err.status === status && !err.message.includes('://');
    row(item, safe && called === calls, `status=${err instanceof TikTokResolveError ? err.status : 'throw'} calls=${called}`);
  }
}

async function main(): Promise<number> {
  const video = 'https://www.tiktok.com/@username/video/1234567890';
  const untouched: TikTokFetch = async () => {
    throw new Error('fetch must not run');
  };

  await expectAllow('正常なTikTok URL', video, untouched, video);
  await expectAllow('apexのTikTok URL', 'https://tiktok.com/@username/video/123', untouched, 'https://tiktok.com/@username/video/123');
  await expectAllow('モバイルのTikTok URL', 'https://m.tiktok.com/@username/video/123', untouched, 'https://m.tiktok.com/@username/video/123');

  let shortCalls: string[] = [];
  await expectAllow(
    'vm短縮URL',
    'https://vm.tiktok.com/ZMabc/',
    async (url) => {
      shortCalls.push(url);
      return { headers: headers(video) };
    },
    video
  );
  row('vm短縮URLは許可ホストだけへ接続', shortCalls.length === 1 && shortCalls[0] === 'https://vm.tiktok.com/ZMabc/', shortCalls.join(','));

  shortCalls = [];
  await expectAllow(
    'vt短縮URL',
    'https://vt.tiktok.com/ZSabc/',
    async (url) => {
      shortCalls.push(url);
      return { headers: headers('https://www.tiktok.com/@username/video/42?is_from_webapp=1') };
    },
    'https://www.tiktok.com/@username/video/42?is_from_webapp=1'
  );
  row('vt短縮URLは許可ホストだけへ接続', shortCalls.length === 1 && shortCalls[0] === 'https://vt.tiktok.com/ZSabc/', shortCalls.join(','));

  shortCalls = [];
  await expectAllow(
    '相対Location',
    'https://vm.tiktok.com/ZMrel',
    async (url) => {
      shortCalls.push(url);
      return { headers: headers('/@username/video/7') };
    },
    'https://vm.tiktok.com/@username/video/7'
  );
  row('相対Locationの接続先', shortCalls.length === 1, shortCalls.join(','));

  const noFetch: TikTokFetch = async () => {
    throw new Error('fetch must not run');
  };
  const blocked = [
    'https://example.com/@username/video/1',
    'https://tiktok.com.example.com/@username/video/1',
    'https://www.tiktok.com.example.com/@username/video/1',
    'https://evil.example/?next=https://www.tiktok.com/@username/video/1',
    'https://tiktok.com@evil.example/@username/video/1',
    'https://user:pass@www.tiktok.com/@username/video/1',
    'http://www.tiktok.com/@username/video/1',
    'http://vm.tiktok.com/ZMabc',
    'https://127.0.0.1/',
    'https://10.0.0.1/',
    'https://192.168.1.1/',
    'https://169.254.169.254/latest/meta-data',
    'https://[::1]/',
    'https://localhost/@username/video/1',
    'https://www.tiktok.com:8443/@username/video/1',
    'not a url',
    'https://',
    '',
  ];
  for (const raw of blocked) {
    await expectReject(`拒否 ${raw || '(empty)'}`, raw, noFetch, 400, 0);
  }
  await expectReject('URL以外', 1 as unknown as string, noFetch, 400, 0);

  let redirectCalls: string[] = [];
  await expectReject(
    '許可外ホストへのリダイレクト',
    'https://vm.tiktok.com/ZMout',
    async (url) => {
      redirectCalls.push(url);
      return { headers: headers('https://evil.example/internal') };
    },
    400,
    1
  );
  row(
    '許可外リダイレクト先は未接続',
    redirectCalls.length === 1 && redirectCalls[0] === 'https://vm.tiktok.com/ZMout',
    redirectCalls.join(',')
  );

  redirectCalls = [];
  await expectReject(
    '内部IPへのリダイレクト',
    'https://vt.tiktok.com/ZSout',
    async (url) => {
      redirectCalls.push(url);
      return { headers: headers('https://169.254.169.254/latest/meta-data') };
    },
    400,
    1
  );
  row('内部IPリダイレクト先は未接続', redirectCalls.length === 1, redirectCalls.join(','));

  redirectCalls = [];
  await expectReject(
    'プロトコル相対の許可外Location',
    'https://vm.tiktok.com/ZMproto',
    async (url) => {
      redirectCalls.push(url);
      return { headers: headers('//evil.example/video/1') };
    },
    400,
    1
  );

  let loopCalls = 0;
  await expectReject(
    'リダイレクトループ',
    'https://vm.tiktok.com/loop',
    async () => {
      loopCalls += 1;
      return { headers: headers('https://vt.tiktok.com/loop') };
    },
    400,
    5
  );
  row('ループの接続回数', loopCalls === 5, String(loopCalls));

  await expectReject(
    'タイムアウト',
    'https://vm.tiktok.com/slow',
    async () => {
      throw new DOMException('The operation was aborted', 'TimeoutError');
    },
    500,
    1
  );

  const privateAddresses = ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.0.1', '169.254.169.254', '0.0.0.0', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe'];
  const publicAddresses = ['1.1.1.1', '151.101.1.1', '2606:4700:4700::1111'];
  row(
    '内部アドレスの判定',
    privateAddresses.every((address) => isBlockedIp(address)) && publicAddresses.every((address) => !isBlockedIp(address)),
    'private blocked'
  );
  row('公開と内部が混在するDNS応答', selectPublicAddresses(['1.1.1.1', '10.0.0.1']) === null, 'mixed');
  row('公開アドレスだけのDNS応答', selectPublicAddresses(['1.1.1.1'])?.join(',') === '1.1.1.1', 'public');

  const lookup = createSafeLookup(((
    _hostname: string,
    _options: unknown,
    callback: (err: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void
  ) => {
    callback(null, [
      { address: '1.1.1.1', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);
  }) as typeof import('node:dns').lookup);
  const blockedLookup = await new Promise<boolean>((resolve) => {
    lookup('www.tiktok.com', { all: true }, (err, address) => {
      resolve(Boolean(err) && address === '');
    });
  });
  row('接続時の名前解決は内部アドレスを渡さない', blockedLookup, blockedLookup ? 'blocked' : 'passed');

  const req = new NextRequest('http://127.0.0.1/api/resolve-tiktok-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'http://169.254.169.254/latest/meta-data' }),
  });
  const res = await POST(req);
  const text = await res.text();
  row(
    '不正URLの応答に内部情報を含めない',
    res.status === 400 && !text.includes('169.254') && !text.includes('resolvedUrl'),
    `HTTP ${res.status}`
  );

  const failed = rows.filter((item) => !item.ok);
  console.log(`${rows.length - failed.length}/${rows.length} passed`);
  return failed.length === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.name : 'error');
    process.exit(1);
  });
