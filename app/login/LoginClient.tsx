'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function LoginClient() {
  const params = useSearchParams();
  const error = params.get('error');

  return (
    <div style={{ padding: 40 }}>
      <h1>ログイン</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {/* ログインフォームなどここに追加 */}
    </div>
  );
}
