import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { bucket, db } from '@/lib/firebase';
import { readOnboardingGate } from '@/lib/onboarding';
import { getSessionUID } from '@/lib/session';
import {
  acceptOwnedSetupPhoto,
  buildSetupPhotoUrl,
  inspectSetupImage,
  parseOwnedSetupPhoto,
  planSetupComplete,
  planSetupDraft,
  resolveSetupUid,
  type SetupPlan,
} from '@/lib/onboardingSetup';

export class SetupHttpError extends Error {
  status: number;
  field?: 'name' | 'title' | 'photo';

  constructor(status: number, message: string, field?: 'name' | 'title' | 'photo') {
    super(message);
    this.status = status;
    this.field = field;
  }
}

function failPlan(plan: Extract<SetupPlan, { ok: false }>): never {
  throw new SetupHttpError(plan.status, plan.error, plan.field);
}

export async function readSetupActor(req: NextRequest, claimedUid: unknown): Promise<string> {
  const sessionUid = await getSessionUID(req);
  const resolved = resolveSetupUid(sessionUid, claimedUid);
  if (!resolved.ok) throw new SetupHttpError(resolved.status, resolved.error);
  return resolved.uid;
}

/** パス照合のあと、Storage 上に実在し、画像形式であるものだけを採用する。 */
export async function confirmOwnedPhoto(rawUrl: unknown, uid: string): Promise<{ url: string; objectPath: string }> {
  const parsed = parseOwnedSetupPhoto(rawUrl, uid, bucket.name);
  if (!parsed) throw new SetupHttpError(400, '本人のプロフィール画像だけを使えます', 'photo');
  const file = bucket.file(parsed.objectPath);
  const [exists] = await file.exists();
  if (!exists) throw new SetupHttpError(400, 'プロフィール画像が見つかりません', 'photo');
  const [meta] = await file.getMetadata();
  if (meta.contentType !== 'image/jpeg' && meta.contentType !== 'image/png' && meta.contentType !== 'image/webp') {
    throw new SetupHttpError(400, '画像はJPEG、PNG、WebPにしてください', 'photo');
  }
  const rawToken = meta.metadata?.firebaseStorageDownloadTokens;
  const token = typeof rawToken === 'string' ? rawToken.split(',')[0].trim() : '';
  const url = buildSetupPhotoUrl(bucket.name, parsed.objectPath, token);
  const accepted = acceptOwnedSetupPhoto(url, uid, bucket.name, true);
  if (!url || !accepted.ok) throw new SetupHttpError(400, 'プロフィール画像を確認できません', 'photo');
  return { url: accepted.url, objectPath: parsed.objectPath };
}

export async function assertRequiredProfile(uid: string): Promise<void> {
  const snap = await db.collection('users').doc(uid).get();
  const gate = readOnboardingGate(snap.exists ? snap.get('profile') : undefined);
  if (gate === 'complete') throw new SetupHttpError(409, '初期設定は完了しています');
  if (gate !== 'required') throw new SetupHttpError(403, '初期設定の対象ではありません');
}

export async function storeSetupImage(uid: string, dataUrl: unknown): Promise<{ url: string; objectPath: string }> {
  if (typeof dataUrl !== 'string' || dataUrl.length > 8_000_000) {
    throw new SetupHttpError(400, '画像は5MB以内にしてください', 'photo');
  }
  const matched = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!matched) throw new SetupHttpError(400, '画像はJPEG、PNG、WebPにしてください', 'photo');
  const bytes = Buffer.from(matched[2], 'base64');
  const inspected = inspectSetupImage(matched[1], bytes);
  if (!inspected.ok) throw new SetupHttpError(400, inspected.error, 'photo');
  const objectPath = `photos/${uid}/${uuidv4()}.${inspected.ext}`;
  const token = uuidv4();
  const file = bucket.file(objectPath);
  await file.save(bytes, {
    resumable: false,
    metadata: {
      contentType: inspected.contentType,
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  try {
    return await confirmOwnedPhoto(buildSetupPhotoUrl(bucket.name, objectPath, token), uid);
  } catch (error) {
    await file.delete({ ignoreNotFound: true }).catch(() => undefined);
    throw error;
  }
}

export async function commitSetup(uid: string, planFrom: (profile: unknown) => SetupPlan): Promise<void> {
  const ref = db.collection('users').doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const profile = snap.exists ? snap.get('profile') : undefined;
    const plan = planFrom(profile);
    if (!plan.ok) failPlan(plan);
    const update: Record<string, unknown> = {};
    if (plan.writes.name !== undefined) update['profile.name'] = plan.writes.name;
    if (plan.writes.title !== undefined) update['profile.title'] = plan.writes.title;
    if (plan.writes.photos !== undefined) update['profile.photos'] = plan.writes.photos;
    if (plan.writes.onboardingStatus !== undefined) {
      update['profile.onboardingStatus'] = plan.writes.onboardingStatus;
    }
    if (Object.keys(update).length === 0) return;
    tx.update(ref, update);
  });
}

export async function saveSetupDraft(
  uid: string,
  body: { name?: unknown; title?: unknown; photoUrl?: unknown },
  photoUrl: string | undefined,
  photoProvided: boolean
): Promise<void> {
  await commitSetup(uid, (profile) =>
    planSetupDraft({
      existingProfile: profile,
      sessionUid: uid,
      claimedUid: uid,
      bucketName: bucket.name,
      nameProvided: Object.prototype.hasOwnProperty.call(body, 'name'),
      titleProvided: Object.prototype.hasOwnProperty.call(body, 'title'),
      photoProvided,
      name: body.name,
      title: body.title,
      photoUrl,
      photoExists: photoProvided,
    })
  );
}

export async function completeSetup(
  uid: string,
  body: { name?: unknown; title?: unknown },
  photoUrl: string
): Promise<void> {
  await commitSetup(uid, (profile) =>
    planSetupComplete({
      existingProfile: profile,
      sessionUid: uid,
      claimedUid: uid,
      bucketName: bucket.name,
      name: body.name,
      title: body.title,
      photoUrl,
      photoExists: true,
    })
  );
}
