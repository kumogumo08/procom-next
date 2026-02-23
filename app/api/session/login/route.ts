export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import type { SessionData } from "@/lib/session-types";
import { admin } from "@/lib/firebase"; // ← dynamic importやめる（高速化）

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json(
        { ok: false, code: "bad-request", msg: "idToken is required" },
        { status: 400 }
      );
    }

    // ✅ IDトークン検証
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // ✅ レスポンスを先に作る（iron-sessionはresが必要）
    const res = NextResponse.json({ ok: true, uid });

    // ✅ セッション取得
    const session = await getIronSession<SessionData>(
      req,
      res,
      sessionOptions
    );

    // ✅ セッション保存（最小構成：uidだけ）
    session.uid = uid;
    await session.save();

    return res;
  } catch (error: any) {
    console.error("SESSION LOGIN ERROR", {
      code: error?.code,
      message: error?.message,
      stack: error?.stack,
    });

    return NextResponse.json(
      { ok: false, code: error?.code ?? "unknown", msg: error?.message ?? "" },
      { status: 401 }
    );
  }
}