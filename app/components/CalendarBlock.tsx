'use client';

import { useEffect } from 'react';
import { createCalendar } from '@/lib/calendar';

export default function CalendarBlock({
  isEditable,
  uid,
}: {
  isEditable: boolean;
  uid?: string;
}) {
  useEffect(() => {
    createCalendar(new Date(), isEditable, true);
  }, [isEditable]);

  return (
    <div id="calendar-container">
      <div id="calendar" className="calendar"></div>

      {isEditable && (
        <div id="event-form" className="auth-only">
          <h3>予定を追加</h3>
          <label>日付: <input type="date" id="event-date" /></label><br />
          <label>内容: <input type="text" id="event-text" placeholder="イベント内容" /></label><br />
          <button id="add-event-btn">追加</button>
        </div>
      )}
    </div>
  );
}
