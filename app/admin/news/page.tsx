"use client";

import { useEffect, useState } from "react";

export default function NewsAdminPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/session", { cache: "no-store" });
      const s = await r.json();
      if (s?.isAdmin) setIsAdmin(true);
      else {
        alert("権限がありません。トップへ戻ります。");
        window.location.href = "/";
        return;
      }
      setChecking(false);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !body) return setMsg("日付と本文は必須です");
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, date, isPublished, isPinned }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTitle(""); setBody(""); setDate(""); setIsPinned(false); setIsPublished(true);
      setMsg("登録しました ✅");
    } catch (e: any) {
      setMsg(e.message || "登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) return <main className="mx-auto max-w-xl p-6">確認中…</main>;
  if (!isAdmin) return null;

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-5 text-2xl font-bold">NEWS管理</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold">タイトル（任意）</label>
          <input className="w-full rounded border px-3 py-2" value={title} onChange={e=>setTitle(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">本文（必須）</label>
          <textarea className="h-28 w-full rounded border px-3 py-2" value={body} onChange={e=>setBody(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">日付（必須）</label>
          <input type="date" className="w-full rounded border px-3 py-2" value={date} onChange={e=>setDate(e.target.value)} />
        </div>
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={isPublished} onChange={e=>setIsPublished(e.target.checked)} />公開する</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={isPinned} onChange={e=>setIsPinned(e.target.checked)} />ピン留め</label>
        </div>
        <button disabled={submitting} className="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {submitting ? "送信中…" : "登録する"}
        </button>
        {msg && <p className="text-sm text-neutral-700">{msg}</p>}
      </form>
    </main>
  );
}
