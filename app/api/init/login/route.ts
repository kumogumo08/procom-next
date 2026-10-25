import { NextRequest, NextResponse } from 'next/server';

/** 本文の uid は読まない。通常ログインは /api/session/login。 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { ok: false, msg: 'Deprecated. Use /api/session/login instead.' },
    { status: 410 }
  );
}
