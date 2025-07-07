// lib/getSessionServer.ts
'use server';

import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from './sessionOptions';

export async function getSessionServer() {
  const cookieStore = await cookies(); 
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  return session;
}
