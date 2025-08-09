import { NextRequest, NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin"; // FieldValue をエクスポートしている前提
import { verifySessionFromRequest } from "@/lib/session"; // ← APIは req から取る方が確実
import { isAdmin } from "@/lib/isAdmin";

export const runtime = "nodejs";

// 更新で許可するフィールドだけ
const ALLOWED_FIELDS = new Set(["title", "body", "date", "isPublished", "isPinned"]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!params?.id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const session = await verifySessionFromRequest(req);
    if (!isAdmin(session?.uid)) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

    const body = await req.json();
    const update: Record<string, any> = {};

    // ホワイトリスト化
    for (const [k, v] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(k)) update[k] = v;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "no valid fields" }, { status: 400 });
    }

    update.updatedAt = FieldValue.serverTimestamp();

    const ref = db.collection("news").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });

    await ref.update(update);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/news/[id] failed:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!params?.id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const session = await verifySessionFromRequest(req);
    if (!isAdmin(session?.uid)) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

    const ref = db.collection("news").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });

    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/news/[id] failed:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
