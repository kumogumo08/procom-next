'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  applySpotlightToggle,
  canStartSave,
  commitSpotlightSaves,
  dirtySpotlightRows,
  discardSpotlightDraft,
} from '@/lib/adminSpotlightDraft';

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
  spotlightOff: boolean;
};

type Notice = {
  tone: 'ok' | 'err';
  text: string;
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

function SpotlightToggle({
  on,
  dirty,
  disabled,
  onChange,
}: {
  on: boolean;
  dirty: boolean;
  disabled: boolean;
  onChange: (nextOn: boolean) => void;
}) {
  return (
    <label className="inline-flex min-h-11 items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="h-5 w-5"
        checked={on}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>TOP掲載：{on ? 'ON' : 'OFF'}</span>
      {dirty ? <span className="text-xs font-medium text-amber-800">未保存</span> : null}
    </label>
  );
}

export default function AdminUsersPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [savedOff, setSavedOff] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const sessionRes = await fetch('/api/session', { cache: 'no-store' });
        if (sessionRes.status === 503) {
          setError('認証サービスが一時的に利用できません。時間をおいて再度お試しください。');
          return;
        }
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
        const rows = Array.isArray(data.users)
          ? data.users.map((user) => ({ ...user, spotlightOff: user.spotlightOff === true }))
          : [];
        setUsers(rows);
        setSavedOff(Object.fromEntries(rows.map((user) => [user.uid, user.spotlightOff])));
      } catch {
        setError('一覧の取得に失敗しました。時間をおいて再度お試しください。');
        setUsers([]);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const dirtyRows = useMemo(
    () => (users ? dirtySpotlightRows(users, savedOff) : []),
    [users, savedOff]
  );
  const dirtyUids = useMemo(() => new Set(dirtyRows.map((row) => row.uid)), [dirtyRows]);

  useEffect(() => {
    if (dirtyRows.length === 0) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirtyRows.length]);

  function changeDraft(uid: string, nextOn: boolean) {
    if (savingRef.current) return;
    setUsers((prev) => (prev ? applySpotlightToggle(prev, uid, nextOn) : prev));
  }

  function discardChanges() {
    if (savingRef.current) return;
    setUsers((prev) => (prev ? discardSpotlightDraft(prev, savedOff) : prev));
    setNotice(null);
  }

  function confirmLeave(event: { preventDefault: () => void }) {
    if (dirtyRows.length === 0) return;
    if (!window.confirm('未保存の変更があります。保存せずに移動しますか？')) {
      event.preventDefault();
    }
  }

  async function saveChanges() {
    if (!users || !canStartSave(savingRef.current, dirtyRows.length)) return;
    savingRef.current = true;
    setSaving(true);
    setNotice(null);
    const targets = dirtyRows;
    const succeeded: string[] = [];
    let sawForbidden = false;
    try {
      for (const user of targets) {
        try {
          const res = await fetch(`/api/admin/users/${encodeURIComponent(user.uid)}`, {
            method: 'PATCH',
            cache: 'no-store',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spotlightOff: user.spotlightOff }),
          });
          if (!res.ok) {
            if (res.status === 403) sawForbidden = true;
            continue;
          }
          succeeded.push(user.uid);
        } catch {
          continue;
        }
      }
      setSavedOff((prev) => commitSpotlightSaves(prev, targets, succeeded));
      const failed = targets.length - succeeded.length;
      if (failed === 0) {
        setNotice({ tone: 'ok', text: `${succeeded.length}件の変更を保存しました。` });
      } else if (succeeded.length === 0) {
        setNotice({
          tone: 'err',
          text: sawForbidden
            ? '権限がないか、このページ以外からの更新は受け付けていません。変更は未保存のままです。'
            : '保存に失敗しました。変更は未保存のままです。',
        });
      } else {
        setNotice({
          tone: 'err',
          text: `${succeeded.length}件を保存しました。${failed}件は失敗したため、未保存のままです。`,
        });
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

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
        <Link
          href="/admin/news"
          onClick={confirmLeave}
          className="text-sm text-blue-600 underline hover:text-blue-800"
        >
          NEWS管理へ
        </Link>
      </div>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p
          className={
            notice.tone === 'ok'
              ? 'mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800'
              : 'mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'
          }
          role="status"
        >
          {notice.text}
        </p>
      ) : null}

      {dirtyRows.length > 0 ? (
        <div className="sticky top-0 z-10 mb-4 flex flex-col gap-3 rounded border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-950">未保存の変更 {dirtyRows.length}件</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={discardChanges}
              disabled={saving}
              className="inline-flex min-h-11 items-center rounded border border-neutral-300 bg-white px-4 text-sm disabled:opacity-60"
            >
              変更を破棄
            </button>
            <button
              type="button"
              onClick={() => {
                void saveChanges();
              }}
              disabled={saving}
              className="inline-flex min-h-11 items-center rounded bg-neutral-900 px-4 text-sm text-white disabled:opacity-60"
            >
              {saving ? '保存中…' : '変更を保存'}
            </button>
          </div>
        </div>
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
                    <div className="mt-2">
                      <SpotlightToggle
                        on={!user.spotlightOff}
                        dirty={dirtyUids.has(user.uid)}
                        disabled={saving}
                        onChange={(nextOn) => changeDraft(user.uid, nextOn)}
                      />
                    </div>
                    <Link
                      href={`/user/${user.uid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex min-h-11 items-center text-sm text-blue-600 underline hover:text-blue-800"
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
                      <div className="flex flex-col items-start">
                        <SpotlightToggle
                          on={!user.spotlightOff}
                          dirty={dirtyUids.has(user.uid)}
                          disabled={saving}
                          onChange={(nextOn) => changeDraft(user.uid, nextOn)}
                        />
                        <Link
                          href={`/user/${user.uid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center text-blue-600 underline hover:text-blue-800"
                        >
                          開く
                        </Link>
                      </div>
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
