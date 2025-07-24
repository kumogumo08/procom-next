'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const SNSButtonBlockClient = dynamic(
  () => import('@/components/SNSButtonBlockWrapper'),
  { ssr: false }
);

interface CustomSNSLink {
  label: string;
  url: string;
  icon?: string;
  color?: string;
}

interface Profile {
  customLinks?: CustomSNSLink[];
  settings?: {
    showX?: boolean;
    showInstagram?: boolean;
    showTikTok?: boolean;
    showFacebook?: boolean;
    showCustomLinks?: boolean;
  };
  [key: string]: any;
}

interface Props {
  uid: string;
  profile: Profile;
  isEditable: boolean;
}

export default function UserPageClientWrapper({ uid, profile, isEditable }: Props) {
  return (
    <SNSButtonBlockClient
      uid={uid}
      profile={profile}
      isEditable={isEditable}
    />
  );
}
