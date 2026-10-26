import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import type { SessionData } from "@/lib/session-types";
import { isAdmin } from "@/lib/isAdmin";
import { confirmActiveUid } from "@/lib/activeSession";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // App Routerは req/res を渡す形でOK
    const res = new NextResponse();
    const session = await getIronSession<SessionData>(req, res, sessionOptions);

    const rawUid = typeof session?.uid === 'string' ? session.uid : null;
    const uid = await confirmActiveUid(rawUid);

    return NextResponse.json({
      loggedIn: !!uid,
      uid,
      username: uid ? session?.username ?? null : null,
      name: uid ? session?.user?.name ?? null : null,
      isAdmin: isAdmin(uid ?? undefined),
    });
  } catch {
    return NextResponse.json({ loggedIn: false, isAdmin: false }, { status: 200 });
  }
}
