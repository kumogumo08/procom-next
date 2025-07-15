// app/components/SnsVisibilityToggle.tsx
'use client';

type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean; // ← 追加
};

export default function SnsVisibilityToggle({ label, checked, onChange, disabled }: Props) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: '12px',
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled} // ← 追加
        style={{ marginRight: '6px' }}
      />
      {label}
    </label>
  );
}
