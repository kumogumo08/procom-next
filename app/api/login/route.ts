import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { ok: false, msg: 'Deprecated. Use /api/session/login instead.' },
    { status: 410 }
  );
}