import { NextRequest, NextResponse } from 'next/server';
import {
  BASE_CUSTOM_DOMAIN_ERROR,
  BASE_PRODUCT_URL_ERROR,
  readBaseProductCandidate,
} from '@/lib/baseProducts';
import { verifyBaseCustomHost } from '@/lib/baseProductDns';
import { rejectIfSuspended } from '@/lib/accountSuspensionGuard';
import { allowRequest, clientKey } from '@/lib/rateLimit';
import { resolveSessionUid } from '@/lib/session';

export const runtime = 'nodejs';

const MAX_BODY_CHARS = 4096;
const UID_LIMIT = 20;
const IP_LIMIT = 30;
const WINDOW_MS = 60_000;
const PRIVATE = { 'Cache-Control': 'private, no-store' };

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: PRIVATE });
}

/** 登録前の独自ドメイン確認。保存はしない。確認済みフラグは返さない。 */
export async function POST(req: NextRequest, context: { params: Promise<{ uid: string }> }) {
  const { uid } = await context.params;
  if (!uid) return jsonError('uidが指定されていません', 400);

  const sessionUid = await resolveSessionUid(req);
  if (sessionUid instanceof NextResponse) return sessionUid;
  if (!sessionUid || sessionUid !== uid) return jsonError('権限がありません', 403);

  const ip = clientKey(req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'));
  if (!allowRequest(`base-product:${uid}`, UID_LIMIT, WINDOW_MS)) {
    return jsonError('確認の回数が多いため、しばらく待ってから再度お試しください', 429);
  }
  if (!allowRequest(`base-product-ip:${ip}`, IP_LIMIT, WINDOW_MS)) {
    return jsonError('確認の回数が多いため、しばらく待ってから再度お試しください', 429);
  }

  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_CHARS) {
    return jsonError('リクエストが大きすぎます', 413);
  }

  let text = '';
  try {
    text = await req.text();
  } catch {
    return jsonError(BASE_PRODUCT_URL_ERROR, 400);
  }
  if (text.length > MAX_BODY_CHARS) return jsonError('リクエストが大きすぎます', 413);

  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return jsonError(BASE_PRODUCT_URL_ERROR, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonError(BASE_PRODUCT_URL_ERROR, 400);
  }

  const candidate = readBaseProductCandidate((body as { url?: unknown }).url);
  if (!candidate) return jsonError(BASE_PRODUCT_URL_ERROR, 400);

  const suspended = await rejectIfSuspended(uid);
  if (suspended) return suspended;

  if (candidate.hostKind === 'custom') {
    let ok = false;
    try {
      ok = await verifyBaseCustomHost(candidate.hostname);
    } catch (error) {
      console.error('BASE独自ドメインの確認に失敗', error instanceof Error ? error.name : 'error');
      ok = false;
    }
    if (!ok) return jsonError(BASE_CUSTOM_DOMAIN_ERROR, 400);
  }

  return NextResponse.json(
    { productUrl: candidate.productUrl, widgetUrl: candidate.widgetUrl },
    { headers: PRIVATE }
  );
}
