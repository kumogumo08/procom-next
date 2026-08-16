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
    showApps?: boolean;
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
  profile,
  isEditable,
  onChange,
}: SNSButtonBlockClientWrapperProps) {
  const [links, setLinks] = useState<CustomSNSLink[]>(profile.customLinks || []);

  useEffect(() => {
    setLinks(profile.customLinks || []);
  }, [profile.customLinks]);

  const handleChange = (updatedLinks: CustomSNSLink[]) => {
    if (updatedLinks.length > 6) {
      alert('SNSボタンは最大6個までです');
      return;
    }

    setLinks(updatedLinks);
    onChange?.(updatedLinks);
  };

  return (
    <SNSButtonBlock
      customLinks={links}
      isEditable={isEditable}
      onChange={handleChange}
    />
  );
}
