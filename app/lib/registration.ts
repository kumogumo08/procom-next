/** 新規登録の成否判断。秘密情報は持たない。Firestore には書かない。 */
import { BLOCK_LAYOUT_VERSION } from '@/lib/blockLayout';

export const PENDING_REGISTRATION = 'pending';
const PASSWORD_CLAIM = 'procomPasswordCheck';

export function isFirestoreAlreadyExists(code: unknown): boolean {
  return code === 6 || code === '6' || code === 'already-exists' || code === 'ALREADY_EXISTS';
}

/** このリクエストで作成した Auth ユーザーだけ、文書が無いとき削除する。 */
export function authCleanupDecision(input: {
  createdUid: string;
  failedUid: string;
  documentCreated: boolean;
}): 'delete-created-user' | 'keep' {
  if (input.documentCreated) return 'keep';
  if (!input.createdUid || input.createdUid !== input.failedUid) return 'keep';
  return 'delete-created-user';
}

/**
 * 再登録では文書を作らない。
 * 文書があるアカウントは拒否する。Auth だけでは新規にしない。
 */
export function repeatRegistrationAction(documentExists: boolean): 'reject-existing' | 'reject-auth-only' {
  return documentExists ? 'reject-existing' : 'reject-auth-only';
}

/**
 * ログイン時の再開。Firebase Auth の ID トークンで本人確認できたあとだけ使う。
 * 文書がある場合は何も作らない。pending 以外の Auth ユーザーも新規にしない。
 */
export function registrationResumeAction(input: {
  documentExists: boolean;
  claim: unknown;
}): 'keep' | 'create-missing-document' {
  if (input.documentExists) return 'keep';
  if (input.claim !== PENDING_REGISTRATION) return 'keep';
  return 'create-missing-document';
}

/** パスワード由来の claim は判定に使わず、次回ログインで消す。 */
export function claimsToPersist(
  claims: unknown,
  documentExists: boolean
): { changed: boolean; next: Record<string, unknown> | null } {
  if (!claims || typeof claims !== 'object') return { changed: false, next: null };
  const source = { ...(claims as Record<string, unknown>) };
  let changed = false;
  if (Object.prototype.hasOwnProperty.call(source, PASSWORD_CLAIM)) {
    delete source[PASSWORD_CLAIM];
    changed = true;
  }
  if (documentExists && source.procomRegistration === PENDING_REGISTRATION) {
    delete source.procomRegistration;
    changed = true;
  }
  if (!changed) return { changed: false, next: null };
  return { changed: true, next: Object.keys(source).length > 0 ? source : null };
}

export function initialNewUserProfile(name: string) {
  return {
    name,
    title: '',
    bio: '',
    photos: [] as unknown[],
    youtubeChannelId: '',
    instagramPostUrl: '',
    xUsername: '',
    tiktokUrls: [] as unknown[],
    calendarEvents: [] as unknown[],
    onboardingStatus: 'required' as const,
    settings: {
      blockLayoutVersion: BLOCK_LAYOUT_VERSION,
      sectionOrder: [] as string[],
      calendarLayout: 'section' as const,
    },
  };
}
