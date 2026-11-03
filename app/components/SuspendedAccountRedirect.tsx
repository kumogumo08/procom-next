'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { ACCOUNT_SUSPENDED_PATH } from '@/lib/accountSuspension';

const OPEN_PATHS = ['/help', '/deleted', '/privacy', '/terms', '/owner', '/withdraw'];

function staysOpen(pathname: string): boolean {
  if (pathname === ACCOUNT_SUSPENDED_PATH || pathname.startsWith(`${ACCOUNT_SUSPENDED_PATH}/`)) return true;
  return OPEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** 画面遷移の案内。操作の拒否は各 API が行う。 */
export default function SuspendedAccountRedirect() {
  const pathname = usePathname() ?? '';
  const router = useRouter();

  useEffect(() => {
    if (staysOpen(pathname)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/session', { credentials: 'include', cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { suspended?: boolean };
        if (!cancelled && data.suspended === true) router.replace(ACCOUNT_SUSPENDED_PATH);
      } catch {
        // セッション確認に失敗しても、API 側の拒否は残る。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
