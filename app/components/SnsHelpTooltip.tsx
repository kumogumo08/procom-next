'use client';

import { useState } from 'react';

export default function SnsHelpTooltip() {
  const [isOpen, setIsOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  const toggle = () => setIsOpen(!isOpen);

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ❓アイコン */}
      <span
        onClick={toggle}
        style={{
          cursor: 'pointer',
          marginLeft: '6px',
          color: '#1d72f3',
          background: '#eaf3ff',
          border: '1px solid #b3d4fc',
          borderRadius: '50%',
          width: '20px',
          height: '20px',
          display: 'inline-flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontWeight: 'bold',
          fontSize: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
        title="表示切替の説明"
      >
        ?
      </span>

      {/* ツールチップ */}
      {(hovered || isOpen) && (
        <div
          style={{
            position: 'absolute',
            top: '28px',
            left: 0,
            zIndex: 1000,
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: '6px',
            padding: '10px 14px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
            fontSize: '13px',
            color: '#333',
            width: '260px',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          ✅ このチェックを外して保存すると、他のユーザーのプロフィールから
          <strong>このSNS表示が非表示</strong>になります。<br />
          逆にチェックを入れて保存すると表示されます。必要に応じて切り替えてください。
        </div>
      )}
    </div>
  );
}
