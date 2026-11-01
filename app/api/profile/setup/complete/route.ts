import { NextRequest, NextResponse } from 'next/server';
import { bucket, db } from '@/lib/firebase';
import { noteUserListing } from '@/lib/listing/firestoreListing';
import { invalidateListingAfterPhotoChange } from '@/lib/listing/listingCache';
import { listingPhotoChanged } from '@/lib/ownedPhotoPath';
import { retainReplacedPhotos } from '@/lib/photoGc';
import { assertRequiredProfile, completeSetup, confirmOwnedPhoto, readSetupActor, SetupHttpError } from '@/lib/onboardingSetupServer';

export const runtime = 'nodejs';

/** required の本人だけを、条件を満たしたとき complete にする。 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: '入力内容が不正です' }, { status: 400 });
    }
    const record = body as Record<string, unknown>;
    const uid = await readSetupActor(req, record.uid);
    try {
      await assertRequiredProfile(uid);
    } catch (error) {
      if (error instanceof SetupHttpError && error.status === 409) {
        await noteUserListing(uid);
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }
    const photo = await confirmOwnedPhoto(record.photoUrl, uid);
    const beforeSnap = await db.collection('users').doc(uid).get();
    const beforePhotos = beforeSnap.get('profile.photos');
    let alreadyComplete = false;
    try {
      await completeSetup(uid, record, photo.url);
    } catch (error) {
      if (error instanceof SetupHttpError && error.status === 409) alreadyComplete = true;
      else throw error;
    }
    const listed = await noteUserListing(uid);
    const afterSnap = await db.collection('users').doc(uid).get();
    const afterPhotos = afterSnap.get('profile.photos');
    if (!alreadyComplete && listed && listingPhotoChanged(beforePhotos, afterPhotos)) {
      invalidateListingAfterPhotoChange();
    }
    await retainReplacedPhotos(uid, bucket.name, beforePhotos, afterPhotos);
    if (alreadyComplete) {
      return NextResponse.json({ error: '初期設定は完了しています' }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SetupHttpError) {
      return NextResponse.json({ error: error.message, field: error.field }, { status: error.status });
    }
    console.error('[profile setup complete]', error);
    return NextResponse.json({ error: '公開処理に失敗しました' }, { status: 500 });
  }
}
