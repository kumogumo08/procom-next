import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import type { SessionData } from "@/lib/session-types";
import { readAccountKind } from "@/lib/accountKind";
import { readUserSuspended } from "@/lib/accountSuspension";
import { isAdmin } from "@/lib/isAdmin";
import { db } from "@/lib/firebase-admin";
import { authRejectedResponse, authUnavailableResponse, confirmActiveUid } from "@/lib/activeSession";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // App Routerは req/res を渡す形でOK
    const res = new NextResponse();
    const session = await getIronSession<SessionData>(req, res, sessionOptions);

    const rawUid = typeof session?.uid === 'string' ? session.uid : null;
    const uid = await confirmActiveUid(rawUid);
    let suspended = false;
    let accountKind: ReturnType<typeof readAccountKind> = null;
    if (uid) {
      const snap = await db.collection('users').doc(uid).get();
      suspended = readUserSuspended(snap.data());
      accountKind = readAccountKind(snap.get('accountKind'));
    }

    return NextResponse.json({
      loggedIn: !!uid,
      uid,
      username: uid ? session?.username ?? null : null,
      name: uid ? session?.user?.name ?? null : null,
      isAdmin: isAdmin(uid ?? undefined),
      suspended,
      accountKind,
    });
  } catch (err: unknown) {
    const unavailable = authUnavailableResponse(err);
    if (unavailable) return unavailable;
    const rejected = authRejectedResponse(err);
    if (rejected) return rejected;
    return NextResponse.json({ loggedIn: false, isAdmin: false }, { status: 200 });
  }
}
