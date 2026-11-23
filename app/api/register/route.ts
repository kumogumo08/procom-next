import { NextRequest, NextResponse } from 'next/server';
import type { UserRecord } from 'firebase-admin/auth';
import bcrypt from 'bcryptjs';
import {
  ACCOUNT_KIND_CLAIM,
  parseRegistrationAccountKind,
  readFanName,
  type AccountKind,
} from '@/lib/accountKind';
import { AUTH_UNAVAILABLE_MESSAGE, classifyGetUserError, noteEmulatorAuthFault } from '@/lib/activeSession';
import { admin } from '@/lib/firebase';
import { noteUserListing } from '@/lib/listing/firestoreListing';
import {
  PENDING_REGISTRATION,
  authCleanupDecision,
  isFirestoreAlreadyExists,
  newUserRecord,
  repeatRegistrationAction,
} from '@/lib/registration';
import { setSessionCookie } from '@/lib/session';

function isValidPassword(password: string): boolean {
  const lengthOK = password.length >= 8 && password.length <= 32;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  return lengthOK && hasUpper && hasLower && hasNumber && !hasSymbol;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse('入力内容が不正です', { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return new NextResponse('入力内容が不正です', { status: 400 });
  }
  const kindResult = parseRegistrationAccountKind(body);
  if (!kindResult.ok) {
    return new NextResponse(kindResult.error, { status: 400 });
  }
  const accountKind: AccountKind = kindResult.kind;
  const record = body as { username?: unknown; email?: unknown; password?: unknown };
  const username = typeof record.username === 'string' ? record.username.trim() : '';
  const email = typeof record.email === 'string' ? record.email.trim() : '';
  const password = typeof record.password === 'string' ? record.password : '';

  if (!email || !password || (accountKind === 'creator' && !username)) {
    return new NextResponse('すべての項目を入力してください', { status: 400 });
  }
  const fanName = accountKind === 'fan' ? readFanName(record.username) : null;
  if (fanName && !fanName.ok) {
    return new NextResponse(fanName.error, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return new NextResponse('メールアドレスの形式が正しくありません', { status: 400 });
  }

  if (!isValidPassword(password)) {
    return new NextResponse('パスワードは8〜32文字で、大文字・小文字・数字を含み、記号は使えません', { status: 400 });
  }

  const db = admin.firestore();
  const normalizedEmail = email.trim().toLowerCase();

  // 公開プロフィール名だけ一意。ファン表示名は重複できる。
  if (accountKind === 'creator') {
    const usernameSnapshot = await db.collection('users').where('profile.name', '==', username).get();
    if (!usernameSnapshot.empty) {
      return new NextResponse('ユーザー名は既に使用されています', { status: 409 });
    }
  }

  // メールアドレスの重複チェック（Firestore 上）
  const emailSnapshot = await db.collection('users').where('email', '==', normalizedEmail).get();
  if (!emailSnapshot.empty) {
    return new NextResponse('メールアドレスは既に使用されています', { status: 409 });
  }
  const displayName = accountKind === 'fan' && fanName && fanName.ok ? fanName.value : username;
  const hashed = await bcrypt.hash(password, 10);

  const newDocument = (uid: string) => ({
    ...newUserRecord({
      uid,
      email: normalizedEmail,
      password: hashed,
      kind: accountKind,
      name: displayName,
    }),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const finish = async (uid: string) => {
    await noteUserListing(uid);
    const redirectTo = accountKind === 'fan' ? '/mypage' : '/profile/setup';
    const res = NextResponse.json({ success: true, redirectTo });
    await setSessionCookie(req, res, {
      uid,
      username: displayName,
      user: { name: displayName },
    });
    return res;
  };

  let existingUser: UserRecord | null = null;
  try {
    noteEmulatorAuthFault();
    existingUser = await admin.auth().getUserByEmail(normalizedEmail);
  } catch (lookupErr: unknown) {
    if (classifyGetUserError(lookupErr) !== 'missing') {
      console.error(
        'admin.auth().getUserByEmail で予期せぬエラー:',
        (lookupErr as { code?: string }).code ?? 'unknown'
      );
      return new NextResponse(AUTH_UNAVAILABLE_MESSAGE, { status: 503 });
    }
  }

  if (existingUser) {
    const existingDoc = await db.collection('users').doc(existingUser.uid).get();
    const repeat = repeatRegistrationAction(existingDoc.exists);
    if (repeat === 'reject-existing') {
      return new NextResponse('メールアドレスは既に使用されています', { status: 409 });
    }
    if (existingUser.customClaims?.procomRegistration === PENDING_REGISTRATION) {
      return new NextResponse('登録手続きが中断しています。ログインすると続きから再開できます', { status: 409 });
    }
    return new NextResponse('メールアドレスは既に使用されています', { status: 409 });
  }

  let uid = '';
  try {
    const userRecord = await admin.auth().createUser({
      email: normalizedEmail,
      password,
      displayName: displayName,
    });
    uid = userRecord.uid;
    await admin.auth().setCustomUserClaims(uid, {
      procomRegistration: PENDING_REGISTRATION,
      [ACCOUNT_KIND_CLAIM]: accountKind,
    });
  } catch (err: unknown) {
    console.error('Firebase Admin Auth 登録エラー:', err);
    if (uid && authCleanupDecision({ createdUid: uid, failedUid: uid, documentCreated: false }) === 'delete-created-user') {
      await admin.auth().deleteUser(uid).catch((deleteErr) => {
        console.error('作成直後の Auth ユーザー削除に失敗:', deleteErr);
      });
    }
    const code = (err as { code?: string }).code;
    if (code === 'auth/email-already-exists') {
      return new NextResponse('メールアドレスは既に使用されています', { status: 409 });
    }
    if (code === 'auth/invalid-email') {
      return new NextResponse('メールアドレスの形式が正しくありません', { status: 400 });
    }
    if (code === 'auth/operation-not-allowed') {
      return new NextResponse('現在、この操作は許可されていません', { status: 500 });
    }
    return new NextResponse('Firebase Authentication 登録に失敗しました', { status: 500 });
  }

  const userRef = db.collection('users').doc(uid);
  try {
    await userRef.create(newDocument(uid));
  } catch (saveErr: unknown) {
    const code = (saveErr as { code?: unknown }).code;
    if (isFirestoreAlreadyExists(code)) {
      return new NextResponse('メールアドレスは既に使用されています', { status: 409 });
    }
    console.error('Firestore 登録エラー:', saveErr);
    if (authCleanupDecision({ createdUid: uid, failedUid: uid, documentCreated: false }) === 'delete-created-user') {
      await admin.auth().deleteUser(uid).catch((deleteErr) => {
        console.error('Firestore 失敗後の Auth ユーザー削除に失敗:', deleteErr);
      });
    }
    return new NextResponse('登録に失敗しました', { status: 500 });
  }

  await admin.auth().setCustomUserClaims(uid, null).catch((claimErr) => {
    console.error('登録完了の claim 削除に失敗:', claimErr);
  });
  return await finish(uid);
}
