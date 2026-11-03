'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SuspendedAccountActions() {
  const router = useRouter();
  const [withdrawing, setWithdrawing] = useState(false);

  async function withdraw() {
    if (withdrawing) return;
    const confirmed = confirm('本当にアカウントを削除しますか？この操作は元に戻せません。');
    if (!confirmed) return;
    setWithdrawing(true);
    try {
      const res = await fetch('/api/account/delete', { method: 'DELETE' });
      if (res.ok) {
        await fetch('/api/logout').catch(() => undefined);
        router.push('/deleted');
        return;
      }
      alert('退会に失敗しました。時間をおいて再度お試しください。');
    } catch {
      alert('退会処理中にエラーが発生しました。');
    }
    setWithdrawing(false);
  }

  return (
    <div className="mt-8 flex flex-col gap-3">
      <button
        type="button"
        onClick={() => {
          void withdraw();
        }}
        disabled={withdrawing}
        className="inline-flex min-h-11 items-center justify-center rounded bg-red-700 px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        {withdrawing ? '退会処理中…' : 'アカウントを削除する'}
      </button>
      <form action="/api/logout" method="GET">
        <button
          type="submit"
          className="inline-flex min-h-11 w-full items-center justify-center rounded border border-neutral-300 bg-white px-4 text-sm"
        >
          ログアウト
        </button>
      </form>
    </div>
  );
}
