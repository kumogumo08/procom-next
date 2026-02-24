// app/api/news/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";
import { getSessionServer } from "@/lib/session";
import { isAdmin } from "@/lib/isAdmin";

export const runtime = "nodejs";

function toISO(v: any): string | null {
  // Firestore Timestamp 対応
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v?.toDate) return v.toDate().toISOString();
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 10);

    const snap = await db
      .collection("news")
      .orderBy("date", "desc")
      .limit(limit)
      .get();

    const items = snap.docs
      .map((d) => {
        const data: any = d.data();
        return {
          id: d.id,
          title: typeof data.title === "string" ? data.title : "",
          body: typeof data.body === "string" ? data.body : "",
          date: typeof data.date === "string" ? data.date : "",
          isPublished: data.isPublished !== false,
          isPinned: !!data.isPinned,
          createdAt: toISO(data.createdAt),
          updatedAt: toISO(data.updatedAt),
        };
      })
      .filter((n) => n.isPublished);

    return NextResponse.json({ items }, { status: 200 });
  } catch (e) {
    console.error("GET /api/news error:", e);
    return NextResponse.json({ items: [], error: String(e) }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionServer();
  if (!isAdmin(session?.uid)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const { title, body, date, isPublished = true, isPinned = false } = await req.json();
  if (!body || !date) {
    return NextResponse.json({ error: "date and body are required" }, { status: 400 });
  }

  const payload = {
    title: title || "",
    body,
    date,
    isPublished,
    isPinned,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const ref = await db.collection("news").add(payload);
  return NextResponse.json({ id: ref.id }, { status: 200 });
}
