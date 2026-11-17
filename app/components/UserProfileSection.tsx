'use client';

import CalendarBlock from './CalendarBlock';
import { cardBase } from '@/components/ui/cardStyles';

export default function UserProfileSection({
  uid,
  isEditable,
  showFixedCalendar = true,
}: {
  uid: string;
  isEditable: boolean;
  showFixedCalendar?: boolean;
}) {
  if (!showFixedCalendar) return null;

  return (
    <section className="profile" style={{ ...cardBase, marginBottom: 24 }}>
      <div className="profile-wrapper">
        <div id="calendar-container">
          <CalendarBlock isEditable={isEditable} uid={uid} />
        </div>
      </div>
    </section>
  );
}
