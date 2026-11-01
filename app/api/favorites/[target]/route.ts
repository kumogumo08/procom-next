// src/app/api/favorites/[target]/route.ts
import { db, admin } from '@/lib/firebase';
import { resolveSessionUid } from '@/lib/session';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, props: { params: Promise<{ target: string }> }) {
  const params = await props.params;
  const sessionUser = await resolveSessionUid(req);
  if (sessionUser instanceof NextResponse) return sessionUser;
  const targetUser = params.target;

  if (!sessionUser || sessionUser === targetUser) {
    return NextResponse.json({ error: '不正な操作' }, { status: 400 });
  }

  await db.collection('users').doc(sessionUser).set(
    {
      favorites: admin.firestore.FieldValue.arrayUnion(targetUser),
    },
    { merge: true }
  );

  return NextResponse.json({ success: true });
}

