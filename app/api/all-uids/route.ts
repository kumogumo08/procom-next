// app/api/all-uids/route.ts
import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin } from '@/lib/firebase';

initializeFirebaseAdmin();
const db = getFirestore();

export async function GET() {
  const snapshot = await db.collection('users').get();

  const uids = snapshot.docs.map(doc => doc.id); // UIDがドキュメントIDとして使われている場合
  return NextResponse.json({ uids });
}
