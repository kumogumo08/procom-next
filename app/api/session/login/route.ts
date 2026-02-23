export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import type { SessionData } from "@/lib/session-types";

export async function POST(req: NextRequest) {
  const { idToken } = await req.json();

  try {
    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ ok: false, code: "bad-request", msg: "idToken is required" }, { status: 400 });
    }

    // ✅ Admin SDK
    const { admin } = await import("@/lib/firebase");
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // ✅ Firestoreからプロフィール名を取る（任意）
    const db = admin.firestore();
    const doc = await db.collection("users").doc(uid).get();
    const profileData = doc.exists ? doc.data()?.profile : null;
    const username = profileData?.name ?? "unknown";

    // ✅ セッション保存
    const res = NextResponse.json({ ok: true, uid });
    const session = await getIronSession<SessionData>(req, res, sessionOptions);
    session.uid = uid;
    session.username = username;
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