'use client';

import ProfileEditor from './ProfileEditor';
import CalendarBlock from './CalendarBlock';

export default function UserProfileSection({
  uid,
  isEditable,
}: {
  uid: string;
  isEditable: boolean;
}) {
  return (
    <section className="profile">
      <div className="profile-wrapper" style={{ display: 'flex', gap: '2rem' }}>
        <div className="profile-info">
          <ProfileEditor uid={uid} isEditable={isEditable} />
        </div>
        <div id="calendar-container">
          <CalendarBlock isEditable={isEditable} uid={uid} />
        </div>
      </div>
    </section>
  );
}
