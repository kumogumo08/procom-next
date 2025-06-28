lib/iron-session.d.ts

import type { SessionData } from './session-types';

declare module 'iron-session' {
  interface IronSessionData extends SessionData {}
}