// 未認証の users 全件取得は廃止。個別取得は /api/user/[uid]。
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'この一覧APIは利用できません' }, { status: 403 });
}
