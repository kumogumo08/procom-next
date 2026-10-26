import { NextRequest, NextResponse } from 'next/server';
import type { UserRecord } from 'firebase-admin/auth';
import bcrypt from 'bcryptjs';
import { admin } from '@/lib/firebase';
import { noteUserListing } from '@/lib/listing/firestoreListing';
import {
  PENDING_REGISTRATION,
  authCleanupDecision,
  initialNewUserProfile,
  isFirestoreAlreadyExists,
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
  const { username, email, password }: { username: string; email: string; password: string } = await req.json();

  if (!username || !email || !password) {
    return new NextResponse('すべての項目を入力してください', { status: 400 });
  }

  if (!isValidEmail(email)) {
    return new NextResponse('メールアドレスの形式が正しくありません', { status: 400 });
  }

  if (!isValidPassword(password)) {
    return new NextResponse('パスワードは8〜32文字で、大文字・小文字・数字を含み、記号は使えません', { status: 400 });
  }

  const db = admin.firestore();

  // ユーザー名の重複チェック（Firestore 上）
  const usernameSnapshot = await db.collection('users').where('profile.name', '==', username).get();
  if (!usernameSnapshot.empty) {
    return new NextResponse('ユーザー名は既に使用されています', { status: 409 });
  }

  // メールアドレスの重複チェック（Firestore 上）
  const emailSnapshot = await db.collection('users').where('email', '==', email).get();
  if (!emailSnapshot.empty) {
    return new NextResponse('メールアドレスは既に使用されています', { status: 409 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim();
  const hashed = await bcrypt.hash(password, 10);

  const newDocument = (uid: string) => ({
    uid,
    email: normalizedEmail,
    password: hashed,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    profile: initialNewUserProfile(normalizedUsername),
  });

  const finish = async (uid: string) => {
    await noteUserListing(uid);
    const res = NextResponse.json({ success: true, redirectTo: '/profile/setup' });
    await setSessionCookie(req, res, {
      uid,
      username: normalizedUsername,
      user: { name: normalizedUsername },
    });
    return res;
  };

  let existingUser: UserRecord | null = null;
  try {
    existingUser = await admin.auth().getUserByEmail(normalizedEmail);
  } catch (lookupErr: unknown) {
    const code = (lookupErr as { code?: string }).code;
    if (code !== 'auth/user-not-found') {
      console.error('admin.auth().getUserByEmail で予期せぬエラー:', lookupErr);
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
      displayName: normalizedUsername,
    });
    uid = userRecord.uid;
    await admin.auth().setCustomUserClaims(uid, {
      procomRegistration: PENDING_REGISTRATION,
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
