/** お仕事用メールアドレス。空文字はボタン非表示。実在確認はしない。 */
export const CONTACT_EMAIL_MAX = 254;
export const CONTACT_EMAIL_ERROR = 'お仕事用メールアドレスの形式を確認してください';

const CONTROL = /[\u0000-\u001F\u007F\u2028\u2029]/;
const ADDRESS =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/**
 * 前後の空白だけ除く。空文字は許可。
 * 改行・タブ・制御文字、?、mailto:、複数アドレス、URL、長すぎる値は null。
 */
export function normalizeContactEmail(value: string): string | null {
  if (CONTROL.test(value)) return null;
  const email = value.trim();
  if (email.length === 0) return '';
  if (email.length > CONTACT_EMAIL_MAX) return null;
  if (/[?,\s;<>"'\\]/.test(email) || email.includes('/')) return null;
  if (/mailto\s*:/i.test(email) || /:\/\//i.test(email)) return null;
  if (!ADDRESS.test(email)) return null;
  return email;
}

/** リクエストに項目があるときだけ検証し、通った値は trim 済みに揃える。 */
export function rejectContactEmail(profile: object): string | null {
  const record = profile as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, 'emailForContact')) return null;
  if (record.emailForContact === undefined) return null;
  const raw = record.emailForContact;
  if (raw !== null && typeof raw !== 'string') return CONTACT_EMAIL_ERROR;
  const normalized = normalizeContactEmail(raw === null ? '' : raw);
  if (normalized == null) return CONTACT_EMAIL_ERROR;
  record.emailForContact = normalized;
  return null;
}
