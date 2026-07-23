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
 * レイアウトは globals.css の .sns-link-row で親幅いっぱいに固定する。
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
      className="sns-link-row"
      aria-label={`${label}（外部リンク）`}
    >
      <span className="sns-link-row__icon" style={{ color: iconColor }} aria-hidden>
        <i className={iconClass} />
      </span>

      <span className="sns-link-row__label">{label}</span>

      <span className="sns-link-row__external" aria-hidden>
        <i className="fa-solid fa-arrow-up-right-from-square" />
      </span>
    </a>
  );
}
