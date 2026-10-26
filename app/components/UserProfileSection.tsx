'use client';

import ProfileEditor from './ProfileEditor';
import CalendarBlock from './CalendarBlock';
import { cardBase } from '@/components/ui/cardStyles';

export default function UserProfileSection({
  uid,
  isEditable,
  initialProfile,
  onBasicDraftChange,
  showFixedCalendar = true,
}: {
  uid: string;
  isEditable: boolean;
  showFixedCalendar?: boolean;
  initialProfile?: {
    name?: string;
    title?: string;
    bio?: string;
  };
  onBasicDraftChange?: (draft: { name?: string; title?: string; bio?: string }) => void;
}) {
  return (
    <section className="profile" style={{ ...cardBase, marginBottom: 24 }}>
      <div className="profile-wrapper">
        <div className="profile-info">
          <ProfileEditor
            uid={uid}
            isEditable={isEditable}
            initialName={initialProfile?.name}
            initialTitle={initialProfile?.title}
            initialBio={initialProfile?.bio}
            onDraftChange={onBasicDraftChange}
          />
        </div>
        {showFixedCalendar ? (
          <div id="calendar-container">
            <CalendarBlock isEditable={isEditable} uid={uid} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
