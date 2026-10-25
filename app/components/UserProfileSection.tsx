'use client';

import ProfileEditor from './ProfileEditor';
import CalendarBlock from './CalendarBlock';
import ContactButtonBlock from './ContactButtonBlock';
import { cardBase } from '@/components/ui/cardStyles';

export default function UserProfileSection({
  uid,
  isEditable,
  initialProfile,
  onBasicDraftChange,
  onContactDraftChange,
  showFixedCalendar = true,
}: {
  uid: string;
  isEditable: boolean;
  showFixedCalendar?: boolean;
  initialProfile?: {
    name?: string;
    title?: string;
    bio?: string;
    emailForContact?: string | null;
  };
  onBasicDraftChange?: (draft: { name?: string; title?: string; bio?: string }) => void;
  onContactDraftChange?: (emailForContact: string) => void;
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
        {isEditable || showFixedCalendar ? (
          <div id="calendar-container">
            {isEditable ? (
              <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                <ContactButtonBlock
                  uid={uid}
                  isEditable={isEditable}
                  initialEmail={initialProfile?.emailForContact ?? undefined}
                  onDraftChange={onContactDraftChange}
                />
              </div>
            ) : null}
            {showFixedCalendar ? <CalendarBlock isEditable={isEditable} uid={uid} /> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
