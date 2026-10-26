import { createHmac, timingSafeEqual } from 'crypto';

const MIN_SECRET = 32;
const KEY_ID = /^[A-Za-z0-9_-]{1,32}$/;

export type DeletionMarkerVerdict = 'valid' | 'invalid' | 'unconfigured' | 'unknown-key';

type SealKey = { id: string; secret: string };

function readPair(idName: string, secretName: string): SealKey | null | 'invalid' {
  const id = process.env[idName];
  const secret = process.env[secretName];
  const idSet = typeof id === 'string' && id.length > 0;
  const secretSet = typeof secret === 'string' && secret.length > 0;
  if (!idSet && !secretSet) return null;
  if (!idSet || !secretSet || !KEY_ID.test(id) || secret.length < MIN_SECRET) return 'invalid';
  return { id, secret };
}

function currentSealKey(): SealKey {
  const key = readPair('ACCOUNT_DELETION_SEAL_KEY_ID', 'ACCOUNT_DELETION_SEAL_SECRET');
  if (key === null || key === 'invalid') {
    throw new Error('退会記録の署名に必要な設定がありません');
  }
  return key;
}

function previousSealKey(): SealKey | null {
  const key = readPair('ACCOUNT_DELETION_SEAL_KEY_ID_PREVIOUS', 'ACCOUNT_DELETION_SEAL_SECRET_PREVIOUS');
  if (key === 'invalid') {
    throw new Error('退会記録の署名に必要な設定がありません');
  }
  return key;
}

/** 現在の署名鍵が使えるときだけ先へ進む。以前の鍵はローテーション中だけ任意。 */
export function assertDeletionSealConfigured(): void {
  const current = currentSealKey();
  const previous = previousSealKey();
  if (previous && previous.id === current.id) {
    throw new Error('退会記録の署名に必要な設定がありません');
  }
}

export function signDeletionMarker(uid: string, nonce: string, phase: string): { seal: string; sealKeyId: string } {
  const key = currentSealKey();
  const seal = createHmac('sha256', key.secret).update(`${uid}:${nonce}:${phase}`).digest('hex');
  return { seal, sealKeyId: key.id };
}

function sealsMatch(seal: string, expected: string): boolean {
  const actual = Buffer.from(seal);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}

/**
 * 現在の鍵と、ローテーション中の一つ前の鍵だけを認める。
 * 設定が無いときは記録を無効扱いにしない。
 */
export function classifyDeletionMarker(
  uid: string,
  data: Record<string, unknown> | undefined
): DeletionMarkerVerdict {
  let current: SealKey;
  let previous: SealKey | null;
  try {
    current = currentSealKey();
    previous = previousSealKey();
    if (previous && previous.id === current.id) return 'unconfigured';
  } catch {
    return 'unconfigured';
  }
  if (!data || data.uid !== uid || data.status !== 'in_progress') return 'invalid';
  const nonce = data.nonce;
  const phase = data.phase;
  const seal = data.seal;
  const sealKeyId = data.sealKeyId;
  if (typeof nonce !== 'string' || nonce.length < 32) return 'invalid';
  if (phase !== 'started' && phase !== 'auth_deleted') return 'invalid';
  if (typeof seal !== 'string' || typeof sealKeyId !== 'string') return 'invalid';
  const key = sealKeyId === current.id ? current : sealKeyId === previous?.id ? previous : null;
  if (!key) return 'unknown-key';
  const expected = createHmac('sha256', key.secret).update(`${uid}:${nonce}:${phase}`).digest('hex');
  return sealsMatch(seal, expected) ? 'valid' : 'invalid';
}
