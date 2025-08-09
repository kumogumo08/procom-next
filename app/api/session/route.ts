import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import type { SessionData } from "@/lib/session-types";
import { isAdmin } from "@/lib/isAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // App Routerは req/res を渡す形でOK
    const res = new NextResponse();
    const session = await getIronSession<SessionData>(req, res, sessionOptions);

    const uid = session?.uid ?? null;
    const username = session?.username ?? null;

    return NextResponse.json({
      loggedIn: !!uid,
      uid,
      username,
      name: session?.user?.name ?? null,
      isAdmin: isAdmin(uid),         // ★これが重要
    });
  } catch {
    return NextResponse.json({ loggedIn: false, isAdmin: false }, { status: 200 });
  }
}
