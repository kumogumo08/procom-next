export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/firebase";
import { profileLoginPath } from "@/lib/onboarding";
import {
  claimsToPersist,
  initialNewUserProfile,
  isFirestoreAlreadyExists,
  registrationResumeAction,
} from "@/lib/registration";
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
    const userRecord = await admin.auth().getUser(uid);
    const db = admin.firestore();
    const userRef = db.collection("users").doc(uid);
    const existing = await userRef.get();
    if (
      registrationResumeAction({
        documentExists: existing.exists,
        claim: userRecord.customClaims?.procomRegistration,
      }) === "create-missing-document"
    ) {
      const name =
        typeof userRecord.displayName === "string" && userRecord.displayName.trim()
          ? userRecord.displayName.trim()
          : "ユーザー";
      try {
        await userRef.create({
          uid,
          email: userRecord.email ?? decoded.email ?? "",
          password: "",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          profile: initialNewUserProfile(name),
        });
      } catch (resumeErr: unknown) {
        const code = (resumeErr as { code?: unknown }).code;
        if (!isFirestoreAlreadyExists(code)) throw resumeErr;
      }
    }
    const saved = await userRef.get();
    const claimUpdate = claimsToPersist(userRecord.customClaims, saved.exists);
    if (claimUpdate.changed) {
      await admin.auth().setCustomUserClaims(uid, claimUpdate.next);
    }
    const profile = saved.exists ? saved.get("profile") : undefined;

    const username = profile?.name ?? "ユーザー";
    const redirectTo = profileLoginPath(uid, profile);

    const res = NextResponse.json({ ok: true, uid, redirectTo });

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