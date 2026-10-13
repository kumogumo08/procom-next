/** 未設定のときは旧一覧。`1` のときだけ publicProfiles / directoryPages を読む。 */
export function isListingDirectoryReady(flag: string | undefined = process.env.LISTING_DIRECTORY_READY): boolean {
  return flag === '1';
}

/** 移行中の全件読みの上限。これを超えたら旧表示を拒否し、新方式へ切り替えるまで一覧は出さない。 */
export const LEGACY_SCAN_LIMIT = 500;

export function assertLegacyScanAllowed(count: number): void {
  if (count > LEGACY_SCAN_LIMIT) {
    throw new Error(`legacy scan refused: ${count}`);
  }
}

export function assessDirectoryReady(input: {
  publicUids: readonly string[];
  listedUids: readonly string[];
  pageUids: readonly string[];
}): { ready: boolean; missing: number; extra: number; unpaged: number } {
  const listed = new Set(input.listedUids);
  const pages = new Set(input.pageUids);
  const publicSet = new Set(input.publicUids);
  let missing = 0;
  for (const uid of publicSet) {
    if (!listed.has(uid)) missing += 1;
  }
  let extra = 0;
  for (const uid of listed) {
    if (!publicSet.has(uid)) extra += 1;
  }
  let unpaged = 0;
  for (const uid of listed) {
    if (!pages.has(uid)) unpaged += 1;
  }
  return {
    ready: publicSet.size > 0 && missing === 0 && extra === 0 && unpaged === 0,
    missing,
    extra,
    unpaged,
  };
}
