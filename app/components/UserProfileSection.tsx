'use client';

import ProfileEditor from './ProfileEditor';
import CalendarBlock from './CalendarBlock';
import ContactButtonBlock from './ContactButtonBlock';
import { useState } from 'react';
import { cardBase } from '@/components/ui/cardStyles';

export default function UserProfileSection({
  uid,
  isEditable,
  initialProfile,
  onBasicDraftChange,
  onContactDraftChange,
}: {
  uid: string;
  isEditable: boolean;
  initialProfile?: {
    name?: string;
    title?: string;
    bio?: string;
    emailForContact?: string | null;
  };
  onBasicDraftChange?: (draft: { name?: string; title?: string; bio?: string }) => void;
  onContactDraftChange?: (emailForContact: string) => void;
}) {
  const [emailForContact] = useState<string | null>(
    initialProfile?.emailForContact ?? null
  );

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
        <div id="calendar-container">
          {/* ✅ カレンダーの上に移動！ */}
          {(isEditable || emailForContact) && (
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <ContactButtonBlock
                uid={uid}
                isEditable={isEditable}
                initialEmail={emailForContact ?? undefined}
                onDraftChange={onContactDraftChange}
              />
            </div>
          )}

          <CalendarBlock isEditable={isEditable} uid={uid} />
        </div>
      </div>
    </section>
  );
}
