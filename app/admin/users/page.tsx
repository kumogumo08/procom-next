'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type AdminUserRow = {
  uid: string;
  name: string;
  title: string;
  createdAt: string | null;
  photoUrl: string | null;
  hasPhoto: boolean;
  hasBio: boolean;
  linkCount: number;
  isPublic: boolean;
};

function formatCreatedAtJa(iso: string | null): string {
  if (!iso) return '登録日時不明';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '登録日時不明';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

function UserThumb({ photoUrl }: { photoUrl: string | null }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [photoUrl]);

  if (!photoUrl || failed) {
    return (
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-200"
        aria-hidden
      >
        <span className="block h-5 w-5 rounded-full bg-neutral-400" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 外部ストレージ URL
    <img
      src={photoUrl}
      alt=""
      className="h-10 w-10 shrink-0 rounded-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export default function AdminUsersPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const sessionRes = await fetch('/api/session', { cache: 'no-store' });
        const session = (await sessionRes.json()) as { isAdmin?: boolean };
        if (!session?.isAdmin) {
          alert('権限がありません。トップへ戻ります。');
          window.location.href = '/';
          return;
        }
        setIsAdmin(true);

        const res = await fetch('/api/admin/users', {
          cache: 'no-store',
          credentials: 'include',
        });
        if (res.status === 403 || res.status === 401) {
          alert('権限がありません。トップへ戻ります。');
          window.location.href = '/';
          return;
        }
        if (!res.ok) {
          throw new Error('一覧の取得に失敗しました');
        }
        const data = (await res.json()) as { users?: AdminUserRow[] };
        setUsers(Array.isArray(data.users) ? data.users : []);
      } catch {
        setError('一覧の取得に失敗しました。時間をおいて再度お試しください。');
        setUsers([]);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  if (checking) {
    return <main className="mx-auto max-w-5xl p-6">確認中…</main>;
  }
  if (!isAdmin) return null;

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">新規登録者一覧</h1>
          <p className="mt-1 text-sm text-neutral-600">登録日時の新しい順（最新50件）</p>
        </div>
        <Link href="/admin/news" className="text-sm text-blue-600 underline hover:text-blue-800">
          NEWS管理へ
        </Link>
      </div>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {users === null ? (
        <p className="text-sm text-neutral-600">読み込み中…</p>
      ) : users.length === 0 && !error ? (
        <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-4 text-sm text-neutral-700">
          表示できる登録者がいません。
        </p>
      ) : users.length > 0 ? (
        <>
          {/* モバイル: カード */}
          <ul className="space-y-3 md:hidden">
            {users.map((user) => (
              <li key={user.uid} className="rounded-lg border border-neutral-200 bg-white p-3">
                <div className="flex gap-3">
                  <UserThumb photoUrl={user.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {user.name || '（名前未設定）'}
                    </p>
                    {user.title ? (
                      <p className="truncate text-sm text-neutral-600">{user.title}</p>
                    ) : null}
                    <p className="mt-1 font-mono text-xs break-all text-neutral-500">{user.uid}</p>
                    <p className="mt-1 text-sm">{formatCreatedAtJa(user.createdAt)}</p>
                    <p className="mt-1 text-xs text-neutral-600">
                      {user.isPublic ? '公開' : '非公開'}
                      {' · '}
                      画像{user.hasPhoto ? 'あり' : 'なし'}
                      {' · '}
                      自己紹介{user.hasBio ? 'あり' : 'なし'}
                      {' · '}
                      リンク{user.linkCount}件
                    </p>
                    <Link
                      href={`/user/${user.uid}`}
                      className="mt-2 inline-block text-sm text-blue-600 underline hover:text-blue-800"
                    >
                      プロフィールを見る
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* PC: テーブル */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-neutral-600">
                  <th className="px-2 py-2 font-semibold">ユーザー</th>
                  <th className="px-2 py-2 font-semibold">UID</th>
                  <th className="px-2 py-2 font-semibold">登録日時</th>
                  <th className="px-2 py-2 font-semibold">公開</th>
                  <th className="px-2 py-2 font-semibold">補足</th>
                  <th className="px-2 py-2 font-semibold">リンク</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.uid} className="border-b border-neutral-100 align-top">
                    <td className="px-2 py-3">
                      <div className="flex max-w-[240px] items-center gap-2">
                        <UserThumb photoUrl={user.photoUrl} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {user.name || '（名前未設定）'}
                          </p>
                          {user.title ? (
                            <p className="truncate text-xs text-neutral-500">{user.title}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3 font-mono text-xs break-all text-neutral-600">
                      {user.uid}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3">
                      {formatCreatedAtJa(user.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3">
                      {user.isPublic ? '公開' : '非公開'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-neutral-600">
                      画像{user.hasPhoto ? 'あり' : 'なし'} / 自己紹介
                      {user.hasBio ? 'あり' : 'なし'} / リンク{user.linkCount}
                    </td>
                    <td className="px-2 py-3">
                      <Link
                        href={`/user/${user.uid}`}
                        className="text-blue-600 underline hover:text-blue-800"
                      >
                        開く
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </main>
  );
}
