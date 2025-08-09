"use client";

import { useState, useEffect } from "react";

export default function AdminNewsForm() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [date, setDate] = useState<string>("");
  const [body, setBody] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/session");
      const s = await r.json();
      if (!s?.uid) return;
      const admins = (process.env.NEXT_PUBLIC_ADMIN_UIDS || "").split(",").map(s => s.trim());
      setIsAdmin(admins.includes(s.uid));
    })();
  }, []);

  if (!isAdmin) return null;

  const submit = async () => {
    if (!date || !body) return alert("日付と本文は必須です");
    setLoading(true);
    const res = await fetch("/api/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, body, isPinned, isPublished: true }),
    });
    setLoading(false);
    if (!res.ok) return alert("失敗しました");
    setDate(""); setBody(""); setIsPinned(false);
    alert("投稿しました");
  };

  return (
    <div className="admin-news-form">
      <h3>NEWSを追加</h3>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <textarea placeholder="本文（何を更新したか）" value={body} onChange={(e) => setBody(e.target.value)} />
      <label><input type="checkbox" checked={isPinned} onChange={(e)=>setIsPinned(e.target.checked)} /> ピン留め</label>
      <button onClick={submit} disabled={loading}>{loading ? "投稿中..." : "投稿する"}</button>
    </div>
  );
}
