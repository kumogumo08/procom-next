/**
 * アカウント停止。true のときだけ停止。未設定と false は通常ユーザー。
 * spotlightOff・isPublic・onboardingStatus はここでは変更しない。
 */
import { isProfilePublicWithOnboarding } from '@/lib/onboarding';
import { isAdmin } from '@/lib/isAdmin';
import { isAdminTargetUid, isTrustedOrigin } from '@/lib/spotlightModeration';

export const SUSPENSION_REASON_MAX = 200;
export const ACCOUNT_SUSPENDED_PATH = '/account/suspended';

export class AccountSuspendedError extends Error {
  constructor() {
    super('account-suspended');
    this.name = 'AccountSuspendedError';
  }
}

export function isAccountSuspendedError(err: unknown): boolean {
  return err instanceof AccountSuspendedError || (err instanceof Error && err.name === 'AccountSuspendedError');
}

export function readSuspensionReason(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const moderation = (data as { moderation?: unknown }).moderation;
  if (!moderation || typeof moderation !== 'object' || Array.isArray(moderation)) return '';
  const reason = (moderation as { suspensionReason?: unknown }).suspensionReason;
  return typeof reason === 'string' ? reason : '';
}

export function readUserSuspended(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const moderation = (data as { moderation?: unknown }).moderation;
  if (!moderation || typeof moderation !== 'object' || Array.isArray(moderation)) return false;
  return (moderation as { suspended?: unknown }).suspended === true;
}

/** 掲載してよいか。停止と退会中は、公開フラグが true でも掲載しない。 */
export function isPublicListingEligible(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const record = data as { deletionPending?: unknown; profile?: unknown };
  if (record.deletionPending === true) return false;
  if (readUserSuspended(data)) return false;
  return isProfilePublicWithOnboarding(record.profile);
}

export function blocksSuspensionChange(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  return (data as { deletionPending?: unknown }).deletionPending === true;
}

/** 解除は suspended だけを false にする。他の moderation 項目は残す。 */
export function suspensionFieldUpdate(
  input: { suspended: false } | { suspended: true; reason: string; actorUid: string }
): Record<string, string | boolean> {
  if (!input.suspended) return { 'moderation.suspended': false };
  return {
    'moderation.suspended': true,
    'moderation.suspensionReason': input.reason,
    'moderation.suspendedBy': input.actorUid,
  };
}

export type SuspensionDecision =
  | { ok: false; status: 400 | 403; error: 'unauthorized' | 'bad-origin' | 'bad-request' | 'forbidden-target' }
  | { ok: true; suspended: true; reason: string }
  | { ok: true; suspended: false };

export function parseSuspensionBody(
  body: unknown
): { suspended: true; reason: string } | { suspended: false } | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  if (record.suspended === false) {
    if (keys.length !== 1 || keys[0] !== 'suspended') return null;
    return { suspended: false };
  }
  if (record.suspended !== true) return null;
  if (keys.length !== 2 || !Object.prototype.hasOwnProperty.call(record, 'reason')) return null;
  if (typeof record.reason !== 'string') return null;
  const reason = record.reason.trim();
  if (reason.length < 1 || reason.length > SUSPENSION_REASON_MAX) return null;
  return { suspended: true, reason };
}

/** 管理者・Origin・UID・対象が管理者でないこと・入力の順。 */
export function decideAdminSuspension(input: {
  isAdmin: boolean;
  origin: string | null;
  dev: boolean;
  actorUid: string;
  uid: string;
  body: unknown;
}): SuspensionDecision {
  if (!input.isAdmin) return { ok: false, status: 403, error: 'unauthorized' };
  if (!isTrustedOrigin(input.origin, input.dev)) {
    return { ok: false, status: 403, error: 'bad-origin' };
  }
  if (!isAdminTargetUid(input.uid)) return { ok: false, status: 400, error: 'bad-request' };
  if (!input.actorUid || input.uid === input.actorUid || isAdmin(input.uid)) {
    return { ok: false, status: 403, error: 'forbidden-target' };
  }
  const parsed = parseSuspensionBody(input.body);
  if (!parsed) return { ok: false, status: 400, error: 'bad-request' };
  return parsed.suspended
    ? { ok: true, suspended: true, reason: parsed.reason }
    : { ok: true, suspended: false };
}
