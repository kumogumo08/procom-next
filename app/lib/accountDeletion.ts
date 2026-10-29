import { randomBytes } from 'crypto';
import { admin, bucket, db } from '@/lib/firebase';
import { assertDeletionSealConfigured, classifyDeletionMarker, signDeletionMarker } from '@/lib/accountDeletionSeal';
import { enqueueUserListing, listingOutboxPending, runListingWorker } from '@/lib/listing/firestoreListing';
import { invalidateListingAfterUnpublish, invalidateListingPages } from '@/lib/listing/listingCache';

const MARKER = 'accountDeletions';
const SWEEP_LIMIT = 20;
const LOCK_TTL_MS = 90_000;

export function isDeletionUid(uid: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(uid);
}

/** 退会UIDの photos または banners 直下だけ。クライアントのパスは受け取らない。 */
export async function deleteOwnedStoragePrefix(uid: string, folder: 'photos' | 'banners'): Promise<void> {
  if (!isDeletionUid(uid)) {
    throw new Error('退会対象を確認できません');
  }
  const prefix = `${folder}/${uid}/`;
  const [files] = await bucket.getFiles({ prefix });
  await Promise.all(
    files.map(async (file) => {
      if (!file.name.startsWith(prefix) || file.name.includes('..')) {
        throw new Error('退会対象を確認できません');
      }
      await file.delete({ ignoreNotFound: true });
    })
  );
}

export type AuthState = 'present' | 'missing' | 'unavailable';

export type AccountDeletionPorts = {
  authState(uid: string): Promise<AuthState>;
  writeMarker(uid: string): Promise<void>;
  hasMarker(uid: string): Promise<boolean>;
  noteAuthDeleted(uid: string): Promise<void>;
  deleteMarker(uid: string): Promise<void>;
  unpublish(uid: string): Promise<void>;
  deleteAuth(uid: string): Promise<void>;
  deleteStorage(uid: string): Promise<void>;
  deleteUserDoc(uid: string): Promise<void>;
  syncListing(uid: string): Promise<void>;
};

export type DeletionResult = { ok: true } | { ok: false; status: 401 | 503; message: string };

/**
 * 本人 UID だけを削除する。
 * 失敗したステップは例外になり、呼び出し元は成功にしない。
 * Auth 削除後に後続が失敗しても、同じ UID の削除マーカーがあれば再実行できる。
 */
export async function runAccountDeletion(uid: string, ports: AccountDeletionPorts): Promise<DeletionResult> {
  if (!isDeletionUid(uid)) {
    return { ok: false, status: 401, message: 'ログインが必要です' };
  }
  try {
    assertDeletionSealConfigured();
  } catch (err: unknown) {
    console.error('退会を見送り:', err instanceof Error ? err.name : 'error');
    return { ok: false, status: 503, message: '退会処理に失敗しました' };
  }

  const auth = await ports.authState(uid);
  if (auth === 'unavailable') {
    return { ok: false, status: 503, message: '退会処理に失敗しました' };
  }
  if (auth === 'missing') {
    if (!(await ports.hasMarker(uid))) {
      return { ok: false, status: 401, message: 'ログインが必要です' };
    }
  } else {
    await ports.writeMarker(uid);
  }

  await ports.unpublish(uid);
  await ports.deleteAuth(uid);
  await ports.noteAuthDeleted(uid);
  await ports.deleteStorage(uid);
  await ports.deleteUserDoc(uid);
  await ports.syncListing(uid);
  await ports.deleteMarker(uid);
  return { ok: true };
}

/** サーバーが作った退会記録だけを認める。文書IDとUIDが違うものは拒否する。 */
export function markerSealValid(uid: string, data: Record<string, unknown> | undefined): boolean {
  return classifyDeletionMarker(uid, data) === 'valid';
}

export type DeletionSweep = {
  completed: number;
  skipped: number;
  failed: number;
  skippedLock: boolean;
  unavailable: boolean;
};

function emptySweep(partial: Partial<DeletionSweep> = {}): DeletionSweep {
  return { completed: 0, skipped: 0, failed: 0, skippedLock: false, unavailable: false, ...partial };
}

async function acquireSweepLock(owner: string): Promise<boolean> {
  const ref = db.collection('accountDeletionMeta').doc('lock');
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const until = snap.get('untilMs');
    if (typeof until === 'number' && until > now) return false;
    tx.set(ref, { owner, untilMs: now + LOCK_TTL_MS });
    return true;
  });
}

async function releaseSweepLock(owner: string): Promise<void> {
  const ref = db.collection('accountDeletionMeta').doc('lock');
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.get('owner') !== owner) return;
    tx.delete(ref);
  });
}

/**
 * Cookie が無くても、Auth 削除済みの未完了記録だけを片付ける。
 * Auth が残っている記録と、署名のない記録は削除しない。
 */
export async function resumeIncompleteAccountDeletions(
  ports: AccountDeletionPorts = firebaseDeletionPorts()
): Promise<DeletionSweep> {
  const result = emptySweep();
  try {
    assertDeletionSealConfigured();
  } catch (err: unknown) {
    console.error('退会後処理を見送り:', err instanceof Error ? err.name : 'error');
    return emptySweep({ unavailable: true });
  }

  const owner = `resume-${randomBytes(8).toString('hex')}`;
  let locked = false;
  try {
    locked = await acquireSweepLock(owner);
  } catch (err: unknown) {
    console.error('退会後処理のロックに失敗:', err instanceof Error ? err.name : 'error');
    throw err;
  }
  if (!locked) {
    console.error('退会後処理を見送り: 実行中');
    return emptySweep({ skippedLock: true });
  }

  try {
    const pending = await db.collection(MARKER).where('status', '==', 'in_progress').limit(SWEEP_LIMIT).get();
    for (const doc of pending.docs) {
      const uid = doc.id;
      const data = doc.data() as Record<string, unknown>;
      const verdict = classifyDeletionMarker(uid, data);
      if (verdict === 'unconfigured') {
        console.error('退会後処理を見送り: 署名設定がありません');
        return emptySweep({ unavailable: true });
      }
      if (!isDeletionUid(uid) || verdict === 'invalid') {
        console.error('退会後処理を見送り: 記録を確認できません', uid);
        await db.collection(MARKER).doc(uid).set(
          { status: 'rejected', updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
        result.skipped += 1;
        continue;
      }
      if (verdict === 'unknown-key') {
        const keyId = typeof data.sealKeyId === 'string' ? data.sealKeyId : '';
        console.error('退会後処理を見送り: 署名鍵が未登録です', uid, keyId);
        result.skipped += 1;
        continue;
      }
      const auth = await ports.authState(uid);
      if (auth !== 'missing') {
        console.error('退会後処理を見送り:', auth === 'present' ? 'Authが残っています' : 'Authを確認できません', uid);
        result.skipped += 1;
        continue;
      }
      const steps: Array<[string, () => Promise<void>]> = [
        ['unpublish', () => ports.unpublish(uid)],
        ['deleteStorage', () => ports.deleteStorage(uid)],
        ['deleteUserDoc', () => ports.deleteUserDoc(uid)],
        ['syncListing', () => ports.syncListing(uid)],
        ['deleteMarker', () => ports.deleteMarker(uid)],
      ];
      let failed = false;
      for (const [name, run] of steps) {
        try {
          await run();
        } catch (err: unknown) {
          const code = (err as { code?: string }).code;
          console.error('退会後処理に失敗:', uid, name, code ?? (err instanceof Error ? err.name : 'error'));
          failed = true;
          break;
        }
      }
      if (failed) result.failed += 1;
      else result.completed += 1;
    }
    return result;
  } finally {
    try {
      await releaseSweepLock(owner);
    } catch (err: unknown) {
      console.error('退会後処理のロック解除に失敗:', err instanceof Error ? err.name : 'error');
    }
  }
}

export function firebaseDeletionPorts(): AccountDeletionPorts {
  return {
    async authState(uid) {
      try {
        await admin.auth().getUser(uid);
        return 'present';
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === 'auth/user-not-found') return 'missing';
        console.error('退会前のAuth確認に失敗:', code ?? 'unknown');
        return 'unavailable';
      }
    },
    async writeMarker(uid) {
      const ref = db.collection(MARKER).doc(uid);
      const snap = await ref.get();
      const currentNonce = snap.get('nonce');
      const nonce = typeof currentNonce === 'string' && currentNonce.length >= 32
        ? currentNonce
        : randomBytes(32).toString('hex');
      const phase = snap.get('phase') === 'auth_deleted' ? 'auth_deleted' : 'started';
      const signed = signDeletionMarker(uid, nonce, phase);
      await ref.set(
        {
          uid,
          status: 'in_progress',
          phase,
          nonce,
          seal: signed.seal,
          sealKeyId: signed.sealKeyId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    },
    async hasMarker(uid) {
      const snap = await db.collection(MARKER).doc(uid).get();
      return markerSealValid(uid, snap.data() as Record<string, unknown> | undefined);
    },
    async noteAuthDeleted(uid) {
      const ref = db.collection(MARKER).doc(uid);
      const snap = await ref.get();
      const nonce = snap.get('nonce');
      if (!snap.exists || typeof nonce !== 'string') {
        throw new Error('退会記録がありません');
      }
      const phase = 'auth_deleted';
      const signed = signDeletionMarker(uid, nonce, phase);
      await ref.set(
        {
          uid,
          status: 'in_progress',
          phase,
          nonce,
          seal: signed.seal,
          sealKeyId: signed.sealKeyId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    },
    async deleteMarker(uid) {
      await db.collection(MARKER).doc(uid).delete();
    },
    async unpublish(uid) {
      const ref = db.collection('users').doc(uid);
      const snap = await ref.get();
      if (snap.exists) {
        await ref.update({ deletionPending: true });
      }
      await enqueueUserListing(uid);
      invalidateListingAfterUnpublish();
    },
    async deleteAuth(uid) {
      try {
        await admin.auth().deleteUser(uid);
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === 'auth/user-not-found') return;
        throw err;
      }
    },
    async deleteStorage(uid) {
      await deleteOwnedStoragePrefix(uid, 'photos');
      await deleteOwnedStoragePrefix(uid, 'banners');
    },
    async deleteUserDoc(uid) {
      await db.collection('users').doc(uid).delete();
    },
    async syncListing(uid) {
      await enqueueUserListing(uid);
      const listed = await db.collection('publicProfiles').doc(uid).get();
      if (listed.exists) {
        throw new Error('公開プロフィールが残っています');
      }
      try {
        const result = await runListingWorker(`withdraw:${uid}`);
        if (result.skippedLock) {
          console.error('掲載ページの無効化を見送りました');
        } else if (!(await listingOutboxPending(uid))) {
          invalidateListingPages();
        }
      } catch (err: unknown) {
        console.error('退会後の掲載ワーカーに失敗:', err instanceof Error ? err.name : 'error');
      }
    },
  };
}
