'use client';

import React from 'react';

type Props = {
  uid: string;
  name?: string;
};

const XShareButton: React.FC<Props> = ({ uid, name }) => {
  const shareOnX = () => {
    const text = encodeURIComponent(
      name
        ? `${name}さんのProcomプロフィールをぜひご覧ください！`
        : 'Procomでプロフィールを公開しました！ぜひ見てください！'
    );
    const url = encodeURIComponent(`https://procom.jp/user/${uid}`);
    const hashtags = 'Procom';
    const xShareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}&hashtags=${hashtags}`;
    window.open(xShareUrl, '_blank');
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '1rem' }}>
      <button
        onClick={shareOnX}
        className="bg-[#1DA1F2] hover:bg-[#0c85d0] text-white font-bold py-2 px-4 rounded-full shadow-md transition duration-200"
      >
        🚀 このページをXでシェアする
      </button>
    </div>
  );
};

export default XShareButton;
