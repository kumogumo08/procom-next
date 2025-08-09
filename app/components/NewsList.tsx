"use client";
import { useEffect, useState } from "react";

type NewsItem = {
  id: string;
  date: string;      // "YYYY-MM-DD"
  body: string;
  isPinned?: boolean;
  createdAt?: string;
};

export default function NewsList({ limit = 5 }: { limit?: number }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // isAdmin 判定
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/session", { cache: "no-store" });
        const s = await r.json();
        setIsAdmin(!!s?.isAdmin);
      } catch {}
    })();
  }, []);

  // NEWS取得
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/news?limit=${limit}`, { cache: "no-store" });
        const text = await res.text();
        const data = text ? JSON.parse(text) : { items: [] };
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [limit]);

  const isNew = (n: NewsItem) => {
    const base = n.createdAt ? new Date(n.createdAt) : new Date(n.date);
    return Date.now() - base.getTime() < 7 * 24 * 60 * 60 * 1000;
  };

  // 削除
  const handleDelete = async (id: string) => {
    if (!confirm("このNEWSを削除しますか？")) return;
    // 楽観的更新
    const prev = items;
    setItems((arr) => arr.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/news/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      alert("削除に失敗しました");
      setItems(prev); // 戻す
    }
  };

  return (
    <section className="mx-auto max-w-4xl rounded-2xl bg-[rgba(250,250,250,0.9)] shadow-[0_6px_20px_rgba(0,0,0,.06)] px-5 py-6">
      <h2 className="text-center text-[1.05rem] font-bold tracking-wide text-neutral-800">
        NEWS
        <span className="mx-auto mt-2 block h-[3px] w-14 rounded bg-gradient-to-r from-pink-500 to-amber-300" />
      </h2>

      {loading && (
        <div className="mt-6 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-neutral-200/70 pb-3">
              <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
              <div className="h-4 flex-1 animate-pulse rounded bg-neutral-200" />
            </div>
          ))}
        </div>
      )}

      {!loading && !items.length && (
        <p className="mt-6 text-center text-sm text-neutral-500">まだお知らせはありません</p>
      )}

      {!loading && items.length > 0 && (
        <ul className="mt-3 divide-y divide-neutral-200/70">
          {items.map((n) => (
            <li key={n.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex min-w-[7.2rem] items-center gap-2">
                {n.isPinned && (
                  <span className="rounded border border-neutral-400 px-2 py-[2px] text-[10px] font-semibold text-neutral-600">
                    PIN
                  </span>
                )}
                {isNew(n) && (
                  <span className="rounded bg-pink-500 px-[6px] py-[2px] text-[10px] font-semibold text-white">
                    NEW
                  </span>
                )}
                <time className="text-[0.85rem] font-semibold text-pink-600">{n.date}</time>
              </div>

              <p className="flex-1 text-[0.92rem] leading-relaxed text-neutral-700">{n.body}</p>

              {isAdmin && (
                <button
                  onClick={() => handleDelete(n.id)}
                  className="self-start rounded border border-red-300 px-2 py-1 text-[12px] font-semibold text-red-600 hover:bg-red-50"
                  title="このNEWSを削除"
                >
                  削除
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
