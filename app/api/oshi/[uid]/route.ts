// app/api/oshi/[uid]/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase';
import { getFirestore } from 'firebase-admin/firestore';

initializeFirebaseAdmin();
const db = getFirestore();

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  const { uid } = await context.params;
  if (!uid) {
    return NextResponse.json({ error: 'Missing UID' }, { status: 400 });
  }

  const userRef = db.collection('users').doc(uid);

  try {
    await db.runTransaction(async (tx) => {
      const doc = await tx.get(userRef);
      const prev = doc.exists ? doc.data()?.oshiCount ?? 0 : 0;
      tx.set(userRef, { oshiCount: prev + 1 }, { merge: true });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  const { uid } = await context.params;
  if (!uid) {
    return NextResponse.json({ error: 'Missing UID' }, { status: 400 });
  }

  try {
    const doc = await db.collection('users').doc(uid).get();
    const count = doc.exists ? doc.data()?.oshiCount ?? 0 : 0;
    return NextResponse.json({ oshiCount: count });
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
