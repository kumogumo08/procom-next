// lib/sessionOptions.ts
import type { SessionOptions } from 'iron-session';

export type SessionData = {
  uid?: string;
  username?: string;
  loggedIn: boolean;
};

export const sessionOptions: SessionOptions = {
  cookieName: 'procom_session',
  password: process.env.SESSION_PASSWORD!,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};
