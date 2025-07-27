'use client';

import ProfileEditor from './ProfileEditor';
import CalendarBlock from './CalendarBlock';
import ContactButtonBlock from './ContactButtonBlock';
import { useEffect, useState } from 'react';

export default function UserProfileSection({
  uid,
  isEditable,
}: {
  uid: string;
  isEditable: boolean;
}) {
  const [emailForContact, setEmailForContact] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEmail() {
      try {
        const res = await fetch(`/api/user/${uid}`);
        const data = await res.json();
        const email = data?.profile?.emailForContact ?? null;
        setEmailForContact(email);
      } catch (err) {
        console.error('連絡先メールの取得に失敗:', err);
      }
    }

    fetchEmail();
  }, [uid]);

  return (
    <section className="profile">
      <div className="profile-wrapper" style={{ display: 'flex', gap: '2rem' }}>
        <div className="profile-info">
          <ProfileEditor uid={uid} isEditable={isEditable} />
        </div>
        <div id="calendar-container">
          {/* ✅ カレンダーの上に移動！ */}
          {(isEditable || emailForContact) && (
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <ContactButtonBlock
                uid={uid}
                isEditable={isEditable}
                initialEmail={emailForContact ?? undefined}
              />
            </div>
          )}

          <CalendarBlock isEditable={isEditable} uid={uid} />
        </div>
      </div>
    </section>
  );
}
