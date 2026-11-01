import { readFileSync } from 'node:fs';
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase';

export const AUTH_UNAVAILABLE_MESSAGE =
  '認証サービスが一時的に利用できません。時間をおいて再度お試しください。';

export const AUTH_REJECTED_MESSAGE = 'このアカウントでは操作できません';

/** getUser() の一時障害。ユーザー不存在とは区別する。Cookie は消さない。 */
export class AuthUnavailableError extends Error {
  constructor() {
    super('auth-unavailable');
    this.name = 'AuthUnavailableError';
  }
}

/** 無効化されたアカウント。認証済みにはしない。 */
export class AuthRejectedError extends Error {
  constructor() {
    super('auth-rejected');
    this.name = 'AuthRejectedError';
  }
}

export function isAuthUnavailable(err: unknown): boolean {
  return err instanceof AuthUnavailableError || (err instanceof Error && err.name === 'AuthUnavailableError');
}

export function isAuthRejected(err: unknown): boolean {
  return err instanceof AuthRejectedError || (err instanceof Error && err.name === 'AuthRejectedError');
}

function authErrorCode(err: unknown): string {
  if (!err || typeof err !== 'object') return '';
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
}

/** user-not-found だけ不存在。無効化は拒否。それ以外の getUser() 失敗は一時障害。 */
export function classifyGetUserError(err: unknown): 'missing' | 'rejected' | 'unavailable' {
  const code = authErrorCode(err);
  if (code === 'auth/user-not-found') return 'missing';
  if (code === 'auth/user-disabled') return 'rejected';
  return 'unavailable';
}

/**
 * Emulator のテストだけが障害を注入する。
 * 本番では PROCOM_EMULATOR が立たないため、追加の Auth 呼び出しにはならない。
 */
function throwEmulatorAuthFault(): void {
  if (process.env.PROCOM_EMULATOR !== '1') return;
  if (process.env.FIREBASE_PROJECT_ID !== 'demo-procom-local') return;
  const file = process.env.PROCOM_AUTH_FAULT_FILE;
  if (!file) return;
  let text = '';
  try {
    text = readFileSync(file, 'utf8').trim();
  } catch {
    return;
  }
  if (!text || text === 'off') return;
  const code =
    text === 'timeout' ? 'DEADLINE_EXCEEDED' : text === 'network' ? 'ECONNREFUSED' : text === 'unknown' ? 'auth/unknown-code' : 'auth/internal-error';
  const err = new Error('auth fault');
  (err as { code?: string }).code = code;
  throw err;
}

export async function loadAuthUser(uid: string) {
  throwEmulatorAuthFault();
  return admin.auth().getUser(uid);
}

export function noteEmulatorAuthFault(): void {
  throwEmulatorAuthFault();
}

/** 有効な Auth ユーザーのときだけ UID を返す。無効化は拒否、一時障害は例外。Cookie は消さない。 */
export async function confirmActiveUid(uid: string | null | undefined): Promise<string | null> {
  if (!uid) return null;
  try {
    const user = await loadAuthUser(uid);
    if (user.disabled === true) throw new AuthRejectedError();
    return uid;
  } catch (err: unknown) {
    if (isAuthRejected(err) || classifyGetUserError(err) === 'rejected') throw new AuthRejectedError();
    if (classifyGetUserError(err) === 'missing') return null;
    console.error('Authユーザー確認に失敗:', authErrorCode(err) || 'unknown');
    throw new AuthUnavailableError();
  }
}

export function authUnavailableResponse(err: unknown): NextResponse | null {
  if (!isAuthUnavailable(err)) return null;
  return NextResponse.json(
    { error: AUTH_UNAVAILABLE_MESSAGE },
    { status: 503, headers: { 'Cache-Control': 'private, no-store' } }
  );
}

export function authRejectedResponse(err: unknown): NextResponse | null {
  if (!isAuthRejected(err)) return null;
  return NextResponse.json(
    { error: AUTH_REJECTED_MESSAGE },
    { status: 403, headers: { 'Cache-Control': 'private, no-store' } }
  );
}
