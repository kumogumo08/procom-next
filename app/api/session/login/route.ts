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
import { AUTH_REJECTED_MESSAGE, AUTH_UNAVAILABLE_MESSAGE, classifyGetUserError, noteEmulatorAuthFault } from "@/lib/activeSession";

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // 🔐 Firebase Admin で検証
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    let userRecord;
    try {
      noteEmulatorAuthFault();
      userRecord = await admin.auth().getUser(uid);
    } catch (lookupErr: unknown) {
      const code = (lookupErr as { code?: string }).code;
      console.error('SESSION LOGIN ERROR', code ?? 'unknown');
      const kind = classifyGetUserError(lookupErr);
      if (kind === 'missing') {
        return NextResponse.json({ ok: false }, { status: 401 });
      }
      if (kind === 'rejected') {
        return NextResponse.json({ ok: false, error: AUTH_REJECTED_MESSAGE }, { status: 403 });
      }
      return NextResponse.json({ ok: false, error: AUTH_UNAVAILABLE_MESSAGE }, { status: 503 });
    }
    if (userRecord.disabled === true) {
      return NextResponse.json({ ok: false, error: AUTH_REJECTED_MESSAGE }, { status: 403 });
    }
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

  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    console.error('SESSION LOGIN ERROR', code ?? (e instanceof Error ? e.name : 'error'));
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}