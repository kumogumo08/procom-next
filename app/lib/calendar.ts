let currentDate: Date = new Date();

export let events: Record<string, string[]> = {};

// ✅ Firestore から予定を取得
async function fetchCalendarEventsFromServer(uid: string) {
  try {
    const res = await fetch(`/api/user/${uid}`);
    const data = await res.json();
    const eventsArray = data.profile?.calendarEvents || [];
    events = {};
    eventsArray.forEach((entry: { date: string; events: string[] }) => {
      if (entry.date && Array.isArray(entry.events)) {
        events[entry.date] = entry.events;
      }
    });
  } catch (err) {
    console.error('❌ カレンダー予定の取得に失敗:', err);
    events = {};
  }
}

// ✅ Firestore に予定を保存
async function saveCalendarEventsToServer(uid: string) {
  try {
    const eventsArray = Object.entries(events).map(([date, evts]) => ({
      date,
      events: evts,
    }));

    await fetch(`/api/user/${uid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: {
          calendarEvents: eventsArray, // ✅ profileの中に入れる
        },
      }),
    });
  } catch (err) {
    console.error('❌ カレンダー予定の保存に失敗:', err);
  }
}

// ✅ カレンダー作成・表示（メイン関数）
export async function createCalendar(
  date: Date = currentDate,
  isEditable: boolean = false,
  reloadEvents = false,
  uid: string
): Promise<void> {

  if (reloadEvents) {
    await fetchCalendarEventsFromServer(uid);
  }

  const calendar = document.getElementById('calendar') as HTMLElement;
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDay = firstDay.getDay();

  calendar.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'calendar-header';
  header.innerHTML = `
    <button id="prev-month">&lt;</button>
    <span>${year}年 ${month + 1}月</span>
    <button id="next-month">&gt;</button>
  `;
  calendar.appendChild(header);

  const daysHeader = ['日', '月', '火', '水', '木', '金', '土'];
  const daysRow = document.createElement('div');
  daysRow.className = 'calendar-row header';
  daysHeader.forEach(day => {
    const cell = document.createElement('div');
    cell.className = 'calendar-cell header-cell';
    cell.textContent = day;
    daysRow.appendChild(cell);
  });
  calendar.appendChild(daysRow);

  let row = document.createElement('div');
  row.className = 'calendar-row';

  for (let i = 0; i < startDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-cell empty';
    row.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const fullDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';
    cell.textContent = String(day);

    cell.addEventListener('click', () => {
      const dateInput = document.getElementById('event-date') as HTMLInputElement | null;
      if (dateInput) {
        dateInput.value = fullDate;
      }
    });


    if (events[fullDate]) {
      cell.classList.add('event-day');

      const popup = document.createElement('div');
      popup.className = 'popup';

      events[fullDate].forEach((e: string, idx: number) => {
        const item = document.createElement('div');
        item.innerHTML = `・${e}`;
        if (isEditable) {
          const delBtn = document.createElement('button');
          delBtn.textContent = '×';
          delBtn.className = 'delete-btn';
          delBtn.dataset.date = fullDate;
          delBtn.dataset.index = String(idx);
          delBtn.addEventListener('click', async (e: MouseEvent) => {
            e.stopPropagation();
            await deleteEvent(fullDate, idx, isEditable, uid);
          });
          item.appendChild(delBtn);
        }
        popup.appendChild(item);
      });

      cell.appendChild(popup);
      cell.addEventListener('mouseenter', () => {
        popup.style.display = 'block';
      });
      cell.addEventListener('mouseleave', () => {
        popup.style.display = 'none';
      });
    }

    row.appendChild(cell);

    if ((startDay + day) % 7 === 0 || day === daysInMonth) {
      calendar.appendChild(row);
      row = document.createElement('div');
      row.className = 'calendar-row';
    }
  }

  const prevBtn = document.getElementById('prev-month') as HTMLButtonElement;
  const nextBtn = document.getElementById('next-month') as HTMLButtonElement;

  prevBtn.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    createCalendar(new Date(), isEditable, true, uid);
  };

  nextBtn.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    createCalendar(currentDate, isEditable, false, uid);
  };

  const dateInput = document.getElementById('event-date') as HTMLInputElement | null;
  const textInput = document.getElementById('event-text') as HTMLInputElement | null;
  const addBtn = document.getElementById('add-event-btn') as HTMLButtonElement | null;

  if (addBtn && dateInput && textInput && isEditable) {
    addBtn.onclick = async () => {
      const date = dateInput.value;
      const text = textInput.value.trim();
      if (!date || !text) return alert('日付と内容を入力してください');
      if (!events[date]) events[date] = [];
      events[date].push(text);
      await saveCalendarEventsToServer(uid);
      textInput.value = '';
      await createCalendar(currentDate, isEditable, false, uid);
    };
  }
}

// ✅ イベント削除（×ボタン押下時）
async function deleteEvent(date: string, index: number, isEditable: boolean, uid: string) {
  if (events[date]) {
    events[date].splice(index, 1);
    if (events[date].length === 0) {
      delete events[date];
    }

    await saveCalendarEventsToServer(uid);
    await fetchCalendarEventsFromServer(uid); // ✅ 明示的に再取得
    await createCalendar(currentDate, isEditable, false, uid); // ✅ reloadEvents = false に
  }
}
// ✅ URL から uid を取得
function getUidFromURL(): string | null {
  const match = window.location.pathname.match(/\/user\/(.+?)\/?$/);
  return match ? match[1] : null;
}
