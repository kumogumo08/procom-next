// ✅ /lib/sessionOptions.ts
import type { SessionOptions } from 'iron-session';
export type SessionData = {
  uid?: string;
};

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_PASSWORD as string,
  cookieName: 'procom_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};
