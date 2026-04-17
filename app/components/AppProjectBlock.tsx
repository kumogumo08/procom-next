'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AppProject, AppProjectReleaseStatus } from '@/lib/appProjects';
import SnsVisibilityToggle from '@/components/SnsVisibilityToggle';
import SnsHelpTooltip from '@/components/SnsHelpTooltip';
import {
  filterAppsForPublicView,
  isValidAppStoreUrl,
  isValidGooglePlayUrl,
  MAX_APP_PROJECTS_PER_PROFILE,
} from '@/lib/appProjects';
import { formatStoreDescription } from '@/lib/storeDescriptionDisplay';
import { cardActions, cardBase } from '@/components/ui/cardStyles';
import styles from './AppProjectBlock.module.css';

type AppFieldErrors = {
  title?: string;
  storeUrl?: string;
  appStoreUrl?: string;
  googlePlayUrl?: string;
};

type FieldErrorsByApp = Record<string, AppFieldErrors>;

const MSG_BOTH_REQUIRED = 'App Store または Google Play のどちらかを入力してください';
const MSG_APP_STORE_SHAPE = 'App Store のURLを入力してください';
const MSG_GOOGLE_PLAY_SHAPE = 'Google Play のURLを入力してください';
const MSG_TITLE_REQUIRED = 'アプリ名を入力してください';

/** title / 説明 / URL 類がすべて未入力（trim 後）か（未保存の新規カードをキャンセルで消す判定） */
function isEmptyApp(app: AppProject): boolean {
  const t = (app.title ?? '').trim();
  if (t !== '') return false;
  const store = (app.appStoreUrl ?? '').trim();
  const play = (app.googlePlayUrl ?? '').trim();
  const web = (app.websiteUrl ?? '').trim();
  return !store && !play && !web;
}

function buildAppFieldErrors(apps: AppProject[]): FieldErrorsByApp {
  const out: FieldErrorsByApp = {};
  for (const a of apps) {
    const asu = (a.appStoreUrl ?? '').trim();
    const gpu = (a.googlePlayUrl ?? '').trim();
    const fe: AppFieldErrors = {};
    if (!(a.title ?? '').trim()) {
      fe.title = MSG_TITLE_REQUIRED;
    }
    if (asu && !isValidAppStoreUrl(asu)) {
      fe.appStoreUrl = MSG_APP_STORE_SHAPE;
    }
    if (gpu && !isValidGooglePlayUrl(gpu)) {
      fe.googlePlayUrl = MSG_GOOGLE_PLAY_SHAPE;
    }
    if (!asu && !gpu) {
      fe.storeUrl = MSG_BOTH_REQUIRED;
    }
    if (Object.keys(fe).length > 0) out[a.id] = fe;
  }
  return out;
}

// TODO(アイコン自動取得): 保存時に appStoreUrl / googlePlayUrl からアイコンを解決するなら
// `app/lib/appProjects.ts` の sanitizeAppsArray（または専用ヘルパー）で
// iTunes Lookup API / Google Play 情報に基づき `iconUrl` を設定するのが自然。
// UI は表示のみ（既存 iconUrl をそのまま利用）。

type Props = {
  uid: string;
  initialApps?: AppProject[];
  initialShowApps?: boolean;
  isEditable: boolean;
  onChange?: (apps: AppProject[]) => void;
  /** persist 成功時に親の profile.settings.showApps を同期する（Facebook 等と同様、保存後の巻き戻り防止） */
  onShowAppsSaved?: (showApps: boolean) => void;
};

function releaseStatusLabel(s: AppProjectReleaseStatus | undefined): string {
  switch (s) {
    case 'review':
      return '審査中';
    case 'coming_soon':
      return 'Coming soon';
    case 'published':
    default:
      return '公開中';
  }
}

function StoreLink({
  href,
  label,
  bg,
  variant = 'solid',
}: {
  href: string;
  label: string;
  bg: string;
  variant?: 'solid' | 'outline';
}) {
  const base = {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 40,
    padding: '10px 18px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    textDecoration: 'none' as const,
    textAlign: 'center' as const,
    boxSizing: 'border-box' as const,
  };
  if (variant === 'outline') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          ...base,
          border: '1px solid #cbd5e1',
          background: '#fff',
          color: '#475569',
          fontWeight: 600,
        }}
      >
        {label}
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        ...base,
        background: bg,
        color: '#fff',
        border: 'none',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.15)',
      }}
    >
      {label}
    </a>
  );
}

export default function AppProjectBlock({
  uid,
  initialApps = [],
  initialShowApps,
  isEditable,
  onChange,
  onShowAppsSaved,
}: Props) {
  const [apps, setApps] = useState<AppProject[]>(initialApps);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showApps, setShowApps] = useState<boolean>(initialShowApps ?? true);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [editSnapshot, setEditSnapshot] = useState<AppProject | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrorsByApp>({});
  /** このセッションで「＋追加」したが、まだ保存成功していない app id（キャンセルで空なら取り除く判定用） */
  const pendingNewAppIdsRef = useRef<Set<string>>(new Set());
  /** 未保存の新規が1件でもあると「＋追加」を抑止する（再描画用） */
  const [hasUnsavedNewApp, setHasUnsavedNewApp] = useState(false);

  useEffect(() => {
    setApps(initialApps);
  }, [initialApps]);

  const displayApps = useMemo(() => {
    if (isEditable) return apps;
    return filterAppsForPublicView(apps);
  }, [apps, isEditable]);

  const persist = useCallback(
    async (
      next: AppProject[],
      opts?: {
        skipStoreValidation?: boolean;
        rollback?: () => void;
        closeEditorOnSuccess?: boolean;
      }
    ) => {
      if (!opts?.skipStoreValidation) {
        const fe = buildAppFieldErrors(next);
        if (Object.keys(fe).length > 0) {
          setFieldErrors(fe);
          setMessage(null);
          return;
        }
        setFieldErrors({});
      }

      const payload = {
        profile: { apps: next, settings: { showApps } },
        ...(opts?.skipStoreValidation ? { skipStoreUrlValidation: true as const } : {}),
      };
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AppProjectBlock] persist payload profile.apps.length', next.length);
      }

      setSaving(true);
      setMessage(null);
      try {
        const res = await fetch(`/api/user/${uid}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const responseText = await res.text().catch(() => '');
        if (process.env.NODE_ENV !== 'production') {
          console.log('[AppProjectBlock] persist response', res.status, responseText.slice(0, 200));
        }
        if (!res.ok) {
          opts?.rollback?.();
          let errMsg = '保存に失敗しました';
          try {
            const data = JSON.parse(responseText) as { error?: string };
            if (typeof data.error === 'string') errMsg = data.error;
          } catch {
            /* ignore */
          }
          setMessage(errMsg);
          return;
        }
        let applied = next;
        try {
          const data = JSON.parse(responseText) as { apps?: AppProject[] };
          if (Array.isArray(data.apps)) {
            applied = data.apps;
          }
        } catch {
          /* ignore */
        }
        setApps(applied);
        applied.forEach((a) => pendingNewAppIdsRef.current.delete(a.id));
        setHasUnsavedNewApp(pendingNewAppIdsRef.current.size > 0);
        onChange?.(applied);
        setFieldErrors({});
        if (opts?.closeEditorOnSuccess) {
          setEditingAppId(null);
          setEditSnapshot(null);
        }
        setMessage('保存しました');
        onShowAppsSaved?.(showApps);
      } catch {
        opts?.rollback?.();
        setMessage('保存に失敗しました');
      } finally {
        setSaving(false);
      }
    },
    [uid, onChange, showApps, onShowAppsSaved]
  );

  const cloneApp = (a: AppProject): AppProject => structuredClone(a);

  const updateApp = (id: string, patch: Partial<AppProject>) => {
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    if ('title' in patch || 'appStoreUrl' in patch || 'googlePlayUrl' in patch) {
      setFieldErrors((prev) => {
        if (!prev[id]) return prev;
        const sub = { ...prev[id] };
        if ('title' in patch) delete sub.title;
        if ('appStoreUrl' in patch || 'googlePlayUrl' in patch) {
          delete sub.storeUrl;
          delete sub.appStoreUrl;
          delete sub.googlePlayUrl;
        }
        if (Object.keys(sub).length === 0) {
          const next = { ...prev };
          delete next[id];
          return next;
        }
        return { ...prev, [id]: sub };
      });
    }
  };

  const openEditor = useCallback(
    (app: AppProject) => {
      if (editingAppId === app.id) return;
      setApps((prev) => {
        if (editingAppId && editingAppId !== app.id && editSnapshot) {
          return prev.map((a) => (a.id === editingAppId ? editSnapshot : a));
        }
        return prev;
      });
      setEditingAppId(app.id);
      setEditSnapshot(cloneApp(app));
      setFieldErrors((prev) => {
        const n = { ...prev };
        delete n[app.id];
        return n;
      });
    },
    [editingAppId, editSnapshot]
  );

  const cancelEdit = useCallback(() => {
    const id = editingAppId;
    if (!id) return;

    setApps((prev) => {
      const current = prev.find((a) => a.id === id);
      if (
        current &&
        pendingNewAppIdsRef.current.has(id) &&
        isEmptyApp(current)
      ) {
        pendingNewAppIdsRef.current.delete(id);
        return prev.filter((a) => a.id !== id);
      }
      if (editSnapshot) {
        return prev.map((a) => (a.id === id ? editSnapshot : a));
      }
      return prev;
    });
    setHasUnsavedNewApp(pendingNewAppIdsRef.current.size > 0);

    setEditingAppId(null);
    setEditSnapshot(null);
    setFieldErrors((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
  }, [editingAppId, editSnapshot]);

  const addApp = () => {
    if (apps.length >= MAX_APP_PROJECTS_PER_PROFILE) return;
    if (pendingNewAppIdsRef.current.size > 0) {
      setMessage('保存またはキャンセルをしてから次のアプリを追加してください');
      return;
    }
    const now = new Date().toISOString();
    const next: AppProject = {
      id: `app_${uuidv4()}`,
      title: '',
      displayOrder: apps.length,
      releaseStatus: 'published',
      createdAt: now,
      updatedAt: now,
      testerRecruiting: { enabled: false },
    };
    setApps((prev) => {
      let base = prev;
      if (editingAppId && editSnapshot) {
        base = prev.map((a) => (a.id === editingAppId ? editSnapshot : a));
      }
      return [...base, next];
    });
    pendingNewAppIdsRef.current.add(next.id);
    setHasUnsavedNewApp(true);
    setEditingAppId(next.id);
    setEditSnapshot(cloneApp(next));
    setFieldErrors((prev) => {
      const n = { ...prev };
      if (editingAppId) delete n[editingAppId];
      delete n[next.id];
      return n;
    });
    setMessage(null);
  };

  const removeApp = (id: string) => {
    const beforeLen = apps.length;
    const list = apps.filter((a) => a.id !== id);
    const prev = apps;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[AppProjectBlock] removeApp', {
        id,
        beforeLen,
        afterLen: list.length,
      });
    }
    if (editingAppId === id) {
      setEditingAppId(null);
      setEditSnapshot(null);
    }
    pendingNewAppIdsRef.current.delete(id);
    setHasUnsavedNewApp(pendingNewAppIdsRef.current.size > 0);
    setFieldErrors((errs) => {
      const n = { ...errs };
      delete n[id];
      return n;
    });
    setApps(list);
    void persist(list, {
      skipStoreValidation: true,
      rollback: () => setApps(prev),
    });
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = apps.findIndex((a) => a.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= apps.length) return;
    const copy = [...apps];
    const [removed] = copy.splice(idx, 1);
    copy.splice(j, 0, removed);
    copy.forEach((a, i) => {
      a.displayOrder = i;
    });
    void persist(copy);
  };

  const saveRow = () => {
    void persist(apps, { closeEditorOnSuccess: true });
  };

  if (!isEditable && (showApps === false || displayApps.length === 0)) {
    return null;
  }

  return (
    <section className="app-project-block" style={{ ...cardBase, maxWidth: 720, margin: '0 auto 32px' }}>
      <h2 style={{ textAlign: 'center', fontSize: '1.25rem', marginBottom: 16, fontWeight: 800 }}>
        アプリ
      </h2>

      {isEditable && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <button
            type="button"
            onClick={addApp}
            disabled={
              saving || apps.length >= MAX_APP_PROJECTS_PER_PROFILE || hasUnsavedNewApp
            }
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: 'none',
              background:
                saving || apps.length >= MAX_APP_PROJECTS_PER_PROFILE || hasUnsavedNewApp
                  ? '#9ca3af'
                  : '#0ea5e9',
              color: '#fff',
              fontWeight: 700,
              cursor:
                saving || apps.length >= MAX_APP_PROJECTS_PER_PROFILE || hasUnsavedNewApp
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {apps.length >= MAX_APP_PROJECTS_PER_PROFILE
              ? `アプリは最大${MAX_APP_PROJECTS_PER_PROFILE}件まで追加できます`
              : '＋ アプリを追加'}
          </button>
          {hasUnsavedNewApp && apps.length < MAX_APP_PROJECTS_PER_PROFILE ? (
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8, marginBottom: 0 }}>
              保存またはキャンセルをしてから次のアプリを追加してください
            </p>
          ) : null}
          {message ? (
            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                color: message === '保存しました' ? '#15803d' : '#b91c1c',
              }}
            >
              {message}
            </div>
          ) : null}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {displayApps.map((app) => {
          const isEditing = isEditable && editingAppId === app.id;
          const fe = fieldErrors[app.id];
          const editDisabled = saving || (editingAppId !== null && editingAppId !== app.id);
          const descriptionSource =
            (app.storeDescription ?? '').trim() || (app.shortDescription ?? '').trim();
          const descriptionDisplay = formatStoreDescription(descriptionSource || undefined);

          return (
            <article
              key={app.id}
              style={{
                position: 'relative',
                border: isEditing ? '2px solid #7dd3fc' : '1px solid #e5eaf0',
                borderRadius: 20,
                padding: 22,
                background: isEditing ? '#fff' : '#fafbfc',
                boxShadow: isEditing
                  ? '0 4px 24px rgba(14, 165, 233, 0.12)'
                  : '0 10px 40px rgba(15, 23, 42, 0.06)',
              }}
            >
              {isEditing ? (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#0369a1',
                    marginBottom: 12,
                    letterSpacing: 0.02,
                  }}
                >
                  編集中
                </div>
              ) : null}

              {!isEditing && isEditable ? (
                <button
                  type="button"
                  onClick={() => {
                    const current = apps.find((a) => a.id === app.id);
                    if (current) openEditor(current);
                  }}
                  disabled={editDisabled}
                  style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    zIndex: 2,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: editDisabled ? '1px solid #f1f5f9' : '1px solid #e2e8f0',
                    background: editDisabled ? '#f8fafc' : '#fff',
                    color: editDisabled ? '#94a3b8' : '#64748b',
                    cursor: editDisabled ? 'not-allowed' : 'pointer',
                    opacity: editDisabled ? 0.55 : 1,
                    boxShadow: editDisabled ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.05)',
                  }}
                >
                  編集
                </button>
              ) : null}

              {!isEditing ? (
                <div className={styles.appCardGrid}>
                  <div>
                    {app.iconUrl ? (
                      <img
                        src={app.iconUrl}
                        alt=""
                        width={88}
                        height={88}
                        className={styles.appCardIcon}
                        style={{
                          width: 'clamp(64px, 19vw, 88px)',
                          height: 'clamp(64px, 19vw, 88px)',
                          borderRadius: 18,
                          objectFit: 'cover',
                          boxShadow: '0 2px 12px rgba(15, 23, 42, 0.08)',
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div
                        className={styles.appCardIconPlaceholder}
                        style={{
                          width: 'clamp(64px, 19vw, 88px)',
                          height: 'clamp(64px, 19vw, 88px)',
                          borderRadius: 18,
                          background: 'linear-gradient(145deg, #f1f5f9, #e8eef4)',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
                        }}
                      />
                    )}
                  </div>

                  <div className={styles.appCardHeader} style={{ paddingRight: isEditable ? 76 : 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        flexWrap: 'wrap',
                        marginBottom: 10,
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 'clamp(1.05rem, 2.8vw, 1.25rem)',
                          fontWeight: 800,
                          color: '#0f172a',
                          letterSpacing: '-0.02em',
                          lineHeight: 1.35,
                        }}
                      >
                        {app.title.trim() || '\u3000'}
                      </h3>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {releaseStatusLabel(app.releaseStatus)}
                      </span>
                    </div>
                  </div>

                  <div className={styles.appCardDescription}>
                    {fe?.title ? (
                      <p style={{ marginTop: 6, marginBottom: 0, fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>
                        {fe.title}
                      </p>
                    ) : null}
                    {descriptionDisplay ? (
                      <p
                        style={{
                          margin: 0,
                          marginTop: 4,
                          fontSize: 15,
                          color: '#475569',
                          lineHeight: 1.7,
                          whiteSpace: 'pre-line',
                          wordBreak: 'break-word',
                          maxHeight: '8.5em',
                          overflow: 'hidden',
                        }}
                      >
                        {descriptionDisplay}
                      </p>
                    ) : null}
                  </div>

                  <div className={styles.appCardLinks}>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 10,
                        marginTop: 16,
                        alignItems: 'stretch',
                      }}
                    >
                      {app.appStoreUrl ? (
                        <StoreLink href={app.appStoreUrl} label="App Store" bg="#111827" />
                      ) : null}
                      {app.googlePlayUrl ? (
                        <StoreLink href={app.googlePlayUrl} label="Google Play" bg="#16a34a" />
                      ) : null}
                      {app.websiteUrl ? (
                        <StoreLink href={app.websiteUrl} label="公式サイト" bg="#0ea5e9" variant="outline" />
                      ) : null}
                    </div>
                  </div>

                  {fe?.appStoreUrl ? (
                    <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>
                      {fe.appStoreUrl}
                    </p>
                  ) : null}
                  {fe?.googlePlayUrl ? (
                    <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>
                      {fe.googlePlayUrl}
                    </p>
                  ) : null}
                  {fe?.storeUrl ? (
                    <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>
                      {fe.storeUrl}
                    </p>
                  ) : null}

                  {app.screenshotUrls && app.screenshotUrls.length > 0 ? (
                    <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                      {app.screenshotUrls.map((src, i) => (
                        <img
                          key={`${app.id}-ss-${i}`}
                          src={src}
                          alt=""
                          style={{
                            width: 120,
                            height: 213,
                            objectFit: 'cover',
                            borderRadius: 10,
                            border: '1px solid #e8ecf1',
                            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {app.iconUrl ? (
                    <img
                      src={app.iconUrl}
                      alt=""
                      width={88}
                      height={88}
                      style={{
                        width: 'clamp(64px, 19vw, 88px)',
                        height: 'clamp(64px, 19vw, 88px)',
                        borderRadius: 18,
                        objectFit: 'cover',
                        flexShrink: 0,
                        boxShadow: '0 2px 12px rgba(15, 23, 42, 0.08)',
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 'clamp(64px, 19vw, 88px)',
                        height: 'clamp(64px, 19vw, 88px)',
                        borderRadius: 18,
                        background: 'linear-gradient(145deg, #f1f5f9, #e8eef4)',
                        flexShrink: 0,
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>
                        編集（本人のみ）
                      </div>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 12 }}>アプリ名</span>
                        <input
                          value={app.title}
                          onChange={(e) => updateApp(app.id, { title: e.target.value })}
                          style={{ padding: 8, borderRadius: 8, border: '1px solid #d1d5db' }}
                        />
                      </label>
                      {fe?.title ? (
                        <p style={{ margin: 0, fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>{fe.title}</p>
                      ) : null}
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 12 }}>App Store URL</span>
                        <input
                          value={app.appStoreUrl ?? ''}
                          onChange={(e) => updateApp(app.id, { appStoreUrl: e.target.value })}
                          style={{ padding: 8, borderRadius: 8, border: '1px solid #d1d5db' }}
                        />
                      </label>
                      {fe?.appStoreUrl ? (
                        <p style={{ margin: 0, fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>{fe.appStoreUrl}</p>
                      ) : null}
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 12 }}>Google Play URL</span>
                        <input
                          value={app.googlePlayUrl ?? ''}
                          onChange={(e) => updateApp(app.id, { googlePlayUrl: e.target.value })}
                          style={{ padding: 8, borderRadius: 8, border: '1px solid #d1d5db' }}
                        />
                      </label>
                      {fe?.googlePlayUrl ? (
                        <p style={{ margin: 0, fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>{fe.googlePlayUrl}</p>
                      ) : null}
                      {fe?.storeUrl ? (
                        <p style={{ margin: 0, fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>{fe.storeUrl}</p>
                      ) : null}
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 12 }}>公式サイト URL（任意）</span>
                        <input
                          value={app.websiteUrl ?? ''}
                          onChange={(e) => updateApp(app.id, { websiteUrl: e.target.value })}
                          style={{ padding: 8, borderRadius: 8, border: '1px solid #d1d5db' }}
                        />
                      </label>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
                        App Store または Google Play のどちらかを入力してください。
                        <br />
                        アイコンと説明文の冒頭はストア情報から自動取得されます（反映まで少し時間がかかる場合があります）。
                      </p>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 12 }}>リリース状態（将来拡張・表示用）</span>
                        <select
                          value={app.releaseStatus ?? 'published'}
                          onChange={(e) =>
                            updateApp(app.id, { releaseStatus: e.target.value as AppProjectReleaseStatus })
                          }
                          style={{ padding: 8, borderRadius: 8, border: '1px solid #d1d5db' }}
                        >
                          <option value="published">published（公開中）</option>
                          <option value="review">review（審査中）</option>
                          <option value="coming_soon">coming_soon</option>
                        </select>
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                        <button
                          type="button"
                          onClick={() => saveRow()}
                          disabled={saving}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#22c55e',
                            color: '#fff',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelEdit()}
                          disabled={saving}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: '1px solid #d1d5db',
                            background: '#fff',
                            fontWeight: 600,
                          }}
                        >
                          キャンセル
                        </button>
                        <button
                          type="button"
                          onClick={() => move(app.id, -1)}
                          disabled={saving}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: '1px solid #d1d5db',
                            background: '#fff',
                            fontWeight: 600,
                          }}
                        >
                          上へ
                        </button>
                        <button
                          type="button"
                          onClick={() => move(app.id, 1)}
                          disabled={saving}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: '1px solid #d1d5db',
                            background: '#fff',
                            fontWeight: 600,
                          }}
                        >
                          下へ
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('このアプリを削除しますか？')) removeApp(app.id);
                          }}
                          disabled={saving}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#fee2e2',
                            color: '#b91c1c',
                            fontWeight: 700,
                          }}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {isEditable && (
        <div style={cardActions}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <SnsVisibilityToggle label="アプリを表示する" checked={showApps} onChange={setShowApps} />
            <SnsHelpTooltip />
          </div>
        </div>
      )}
    </section>
  );
}
