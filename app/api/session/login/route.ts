export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/firebase";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // 🔐 Firebase Admin で検証
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // 👤 Firestoreからプロフィール取得
    const db = admin.firestore();
    const doc = await db.collection("users").doc(uid).get();
    const profile = doc.data()?.profile;

    const username = profile?.name ?? "ユーザー";

    const res = NextResponse.json({ ok: true, uid });

    // ✅ 旧仕様と同じ形式で保存
    await setSessionCookie(req, res, {
      uid,
      username,
      user: {
        name: username,
        email: decoded.email,
      },
    });

    return res;

  } catch (e: any) {
    console.error("SESSION LOGIN ERROR", e);
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}