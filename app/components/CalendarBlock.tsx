'use client';

import { useEffect, useState } from 'react';
import { createCalendar } from '@/lib/calendar';

type CalendarEvent = { text: string };

export default function CalendarBlock({
  isEditable,
  uid,
}: {
  isEditable: boolean;
  uid?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [newText, setNewText] = useState('');

  useEffect(() => {
    if (uid) {
      createCalendar(new Date(), isEditable, true, uid);
    }
  }, [isEditable, uid]);

  // 🔽 追加：lib側のカスタムイベントを受けてモーダルを開く
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { date: string; events: string[] };
      setSelectedDate(detail.date);
      setEvents((detail.events || []).map((t) => ({ text: t })));
      setOpen(true);
    };
    window.addEventListener('calendar:dayClick', handler as EventListener);
    return () => window.removeEventListener('calendar:dayClick', handler as EventListener);
  }, []);

  const handleAdd = async () => {
    if (!uid || !selectedDate || !newText.trim()) return;
    // ここでは簡易にフロント側のフォームも使いつつ、モーダル上でも追加できるように
    const dateInput = document.getElementById('event-date') as HTMLInputElement | null;
    const textInput = document.getElementById('event-text') as HTMLInputElement | null;
    if (dateInput) dateInput.value = selectedDate;
    if (textInput) textInput.value = newText.trim();

    // 既存の「追加」ボタンをそのまま流用するなら click を飛ばすだけでもOK
    const addBtn = document.getElementById('add-event-btn') as HTMLButtonElement | null;
    if (addBtn) addBtn.click();

    // UI側反映（暫定）
    setEvents((prev) => [...prev, { text: newText.trim() }]);
    setNewText('');
  };

  return (
    <div id="calendar-container">
      <div id="calendar" className="calendar"></div>

      {isEditable && (
        <div id="event-form" className="auth-only">
          <h3>予定を編集</h3>
          <label>
            日付: <input type="date" id="event-date" />
          </label>
          <br />
          <label>
            内容: <input type="text" id="event-text" placeholder="イベント内容" />
          </label>
          <br />
          <button id="add-event-btn">追加</button>
        </div>
      )}

      {/* ===== モーダル ===== */}
      {open && (
        <div
          className="calendar-modal-backdrop"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        >
          <div
            className="calendar-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="calendar-modal-header">
              <h2>{selectedDate} の予定</h2>
              <button className="close-btn" onClick={() => setOpen(false)} aria-label="閉じる">×</button>
            </div>

            <ul className="event-list">
              {events.length === 0 && <li className="muted">この日は予定がありません</li>}
              {events.map((ev, i) => (
                <li key={i} className="event-item">
                  <span className="dot" />
                  <span className="text">{ev.text}</span>
                </li>
              ))}
            </ul>

            {isEditable && (
              <div className="add-row">
                <input
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="イベント内容を入力"
                />
                <button onClick={handleAdd}>追加</button>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .calendar-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: grid;
          place-items: center;
          z-index: 1000;
        }
        .calendar-modal {
          width: min(900px, 92vw);
          max-height: 90vh;
          overflow: auto;
          background: #fff;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .calendar-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .close-btn {
          font-size: 20px;
          border: none;
          background: transparent;
          cursor: pointer;
          line-height: 1;
        }
        .event-list {
          list-style: none;
          padding: 0;
          margin: 0 0 16px 0;
          display: grid;
          gap: 10px;
        }
        .event-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: #f7f7f9;
          border-radius: 10px;
        }
        .event-item .dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #4b9cff;
          flex: 0 0 auto;
        }
        .event-item .text {
          flex: 1 1 auto;
        }
        .add-row {
          display: flex;
          gap: 10px;
          margin-top: 8px;
        }
        .add-row input {
          flex: 1;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 10px;
        }
        .add-row button {
          padding: 10px 14px;
          border-radius: 8px;
          border: none;
          background: #4b9cff;
          color: white;
          cursor: pointer;
        }
        @media (max-width: 520px) {
          .calendar-modal { padding: 16px; }
          .add-row { flex-direction: column; }
          .add-row button { width: 100%; }
        }
      `}</style>
    </div>
  );
}
