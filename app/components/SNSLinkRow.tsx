'use client';

import React from 'react';
import {
  resolveSnsIconColor,
  resolveSnsPlatform,
} from '@/lib/snsPlatform';

export type SNSLinkRowProps = {
  label: string;
  url: string;
  color?: string;
  /** Font Awesome クラス上書き（未指定時は URL から自動判定） */
  icon?: string;
};

/**
 * 細長い SNS リンクリスト行。
 * リンク挙動（新規タブ・rel）は既存 SNS ボタンと同じ。
 */
export default function SNSLinkRow({
  label,
  url,
  color,
  icon,
}: SNSLinkRowProps) {
  const platform = resolveSnsPlatform(url);
  const iconClass = icon?.trim() || platform.iconClass;
  const iconColor = resolveSnsIconColor(color, platform.brandColor);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex w-full items-center gap-3 border-b border-neutral-200/80 px-3 transition-colors hover:bg-neutral-100/90 focus-visible:bg-neutral-100/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-inset"
      style={{ minHeight: 52 }}
      aria-label={`${label}（外部リンク）`}
    >
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-xl leading-none"
        style={{ color: iconColor }}
        aria-hidden
      >
        <i className={iconClass} />
      </span>

      <span className="min-w-0 flex-1 truncate text-[0.95rem] font-medium text-neutral-800 group-hover:text-neutral-950">
        {label}
      </span>

      <span
        className="shrink-0 text-sm text-neutral-400 transition-colors group-hover:text-neutral-600"
        aria-hidden
      >
        <i className="fa-solid fa-arrow-up-right-from-square" />
      </span>
    </a>
  );
}
