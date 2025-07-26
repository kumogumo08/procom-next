'use client';

import React, { useState, useEffect } from 'react';
import SNSButtonBlock from './SNSButtonBlock';

interface CustomSNSLink {
  label: string;
  url: string;
  icon?: string;
  color?: string;
}

type Profile = {
  customLinks?: CustomSNSLink[];
  settings?: {
    showX?: boolean;
    showInstagram?: boolean;
    showTikTok?: boolean;
    showFacebook?: boolean;
    showCustomLinks?: boolean;
  };
};

interface SNSButtonBlockClientWrapperProps {
  uid: string;
  profile: Profile;
  isEditable: boolean;
  onChange?: (links: CustomSNSLink[]) => void;
}

export default function SNSButtonBlockClientWrapper({
  uid,
  profile,
  isEditable,
  onChange,
}: SNSButtonBlockClientWrapperProps) {
  const [links, setLinks] = useState<CustomSNSLink[]>(profile.customLinks || []);

  useEffect(() => {
    setLinks(profile.customLinks || []);
  }, [profile.customLinks]);

 const handleChange = async (updatedLinks: CustomSNSLink[]) => {
  if (updatedLinks.length > 6) {
    alert('SNSボタンは最大6個までです');
    return;
  }

  setLinks(updatedLinks);
  onChange?.(updatedLinks);

  if (isEditable) {
    try {
      const res = await fetch(`/api/user/${uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customLinks: updatedLinks }),
      });

      if (!res.ok) {
        console.error('SNSリンクの保存に失敗しました');
      }
    } catch (err) {
      console.error('保存中にエラーが発生しました:', err);
    }
  }
};


  return (
    <SNSButtonBlock
      customLinks={links}
      isEditable={isEditable}
      onChange={handleChange}
    />
  );
}
