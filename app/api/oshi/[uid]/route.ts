// app/api/oshi/[uid]/route.ts
export const runtime = 'nodejs'; // 👈 これが必須

import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase';
import { getFirestore } from 'firebase-admin/firestore';

initializeFirebaseAdmin();
const db = getFirestore();

export async function POST(
  req: NextRequest,
  { params }: { params: { uid: string } }
) {
  const uid = params.uid;
  const userRef = db.collection('users').doc(uid);

  try {
    await db.runTransaction(async (tx) => {
      const doc = await tx.get(userRef);
      if (!doc.exists) {
        tx.set(userRef, { oshiCount: 1 }, { merge: true });
      } else {
        const prev = doc.data()?.oshiCount ?? 0;
        tx.update(userRef, { oshiCount: prev + 1 });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST エラー:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { uid: string } }
) {
  const uid = params.uid;

  try {
    const doc = await db.collection('users').doc(uid).get();
    const count = doc.exists ? doc.data()?.oshiCount ?? 0 : 0;
    return NextResponse.json({ oshiCount: count });
  } catch (error) {
    console.error('GET エラー:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
