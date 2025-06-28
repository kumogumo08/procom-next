// lib/session-types.ts
export type SessionData = {
  uid: string;
  username: string;
  user?: {
    name?: string;
    email?: string;
  };
};
