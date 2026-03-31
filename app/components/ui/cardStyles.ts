'use client';

import type { CSSProperties } from 'react';

export const cardBase: CSSProperties = {
  borderRadius: 18,
  padding: 22,
  background: '#fff',
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
};

export const cardTitle: CSSProperties = {
  margin: 0,
  marginBottom: 12,
  fontSize: 17,
  fontWeight: 700,
  color: '#0f172a',
  letterSpacing: '-0.01em',
};

export const cardBody: CSSProperties = {
  display: 'grid',
  gap: 14,
};

export const inputBase: CSSProperties = {
  height: 40,
  borderRadius: 8,
  padding: '0 12px',
  border: '1px solid #e5e7eb',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

export const textareaBase: CSSProperties = {
  minHeight: 100,
  borderRadius: 8,
  padding: 12,
  border: '1px solid #e5e7eb',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  resize: 'vertical',
};

export const buttonRowRight: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  marginTop: 8,
  flexWrap: 'wrap',
};

export const buttonPrimary: CSSProperties = {
  height: 40,
  padding: '0 14px',
  borderRadius: 10,
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};

export const buttonDanger: CSSProperties = {
  height: 40,
  padding: '0 12px',
  borderRadius: 10,
  border: 'none',
  background: '#ef4444',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
};

