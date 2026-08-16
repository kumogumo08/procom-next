'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buttonPrimary, cardBase, cardTitle } from '@/components/ui/cardStyles';

type PendingNavigation =
  | { kind: 'url'; href: string }
  | { kind: 'form'; form: HTMLFormElement }
  | { kind: 'back' };

type Props = {
  isDirty: boolean;
  isSaving: boolean;
  saveDraftProfile: () => Promise<boolean>;
};

const buttonSecondary = {
  height: 40,
  padding: '0 14px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#0f172a',
  fontWeight: 700,
  cursor: 'pointer',
} as const;

const buttonGhost = {
  height: 40,
  padding: '0 14px',
  borderRadius: 10,
  border: 'none',
  background: 'transparent',
  color: '#64748b',
  fontWeight: 700,
  cursor: 'pointer',
} as const;

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function isIgnorableHref(href: string) {
  const trimmed = href.trim();
  if (!trimmed || trimmed === '#') return true;
  const lower = trimmed.toLowerCase();
  return (
    lower.startsWith('javascript:') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('sms:')
  );
}

function isSameDocumentUrl(url: URL) {
  return (
    url.origin === window.location.origin &&
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  );
}

function resolveFormUrl(form: HTMLFormElement): string | null {
  try {
    const url = new URL(form.action || window.location.href, window.location.href);
    const method = (form.method || 'get').toLowerCase();
    if (method === 'get') {
      const params = new URLSearchParams();
      const data = new FormData(form);
      data.forEach((value, key) => {
        if (typeof value === 'string') params.append(key, value);
      });
      url.search = params.toString();
    }
    return url.href;
  } catch {
    return null;
  }
}

type NavigationAPI = {
  addEventListener: (type: 'navigate', listener: (event: NavigateEventLike) => void) => void;
  removeEventListener: (type: 'navigate', listener: (event: NavigateEventLike) => void) => void;
};

type NavigateEventLike = Event & {
  navigationType?: string;
  hashChange?: boolean;
  downloadRequest?: string | null;
};

export default function UnsavedChangesLeaveGuard({
  isDirty,
  isSaving,
  saveDraftProfile,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const allowNavigationRef = useRef(false);
  const pendingRef = useRef<PendingNavigation | null>(null);
  const isDirtyRef = useRef(isDirty);
  const isSavingRef = useRef(isSaving);
  const saveDraftProfileRef = useRef(saveDraftProfile);

  isDirtyRef.current = isDirty;
  isSavingRef.current = isSaving;
  saveDraftProfileRef.current = saveDraftProfile;

  const closeModal = useCallback(() => {
    pendingRef.current = null;
    setOpen(false);
  }, []);

  const openModal = useCallback((pending: PendingNavigation) => {
    pendingRef.current = pending;
    setOpen(true);
  }, []);

  const proceedPending = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setOpen(false);
    allowNavigationRef.current = true;

    if (!pending) {
      window.setTimeout(() => {
        allowNavigationRef.current = false;
      }, 500);
      return;
    }

    if (pending.kind === 'back') {
      window.history.back();
    } else if (pending.kind === 'form') {
      pending.form.submit();
    } else {
      try {
        const url = new URL(pending.href, window.location.href);
        const sameOriginPage =
          url.origin === window.location.origin && !url.pathname.startsWith('/api/');
        if (sameOriginPage) {
          router.push(`${url.pathname}${url.search}${url.hash}`);
        } else {
          window.location.assign(url.href);
        }
      } catch {
        window.location.assign(pending.href);
      }
    }

    window.setTimeout(() => {
      allowNavigationRef.current = false;
    }, 500);
  }, [router]);

  const handleSaveAndLeave = useCallback(async () => {
    if (isSavingRef.current) return;
    const ok = await saveDraftProfileRef.current();
    if (!ok) return;
    proceedPending();
  }, [proceedPending]);

  const handleLeaveWithoutSave = useCallback(() => {
    if (isSavingRef.current) return;
    proceedPending();
  }, [proceedPending]);

  useEffect(() => {
    if (isDirty || !open || isSaving) return;
    closeModal();
  }, [closeModal, isDirty, isSaving, open]);

  useEffect(() => {
    if (!isDirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const onClick = (event: MouseEvent) => {
      if (allowNavigationRef.current) return;
      if (!isDirtyRef.current) return;
      if (isModifiedClick(event)) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a');
      if (!anchor) return;
      if (anchor.target === '_blank') return;
      if (anchor.hasAttribute('download')) return;

      const hrefAttr = anchor.getAttribute('href');
      if (hrefAttr && isIgnorableHref(hrefAttr)) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (isSameDocumentUrl(url)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (isSavingRef.current) return;
      openModal({ kind: 'url', href: url.href });
    };

    const onSubmit = (event: Event) => {
      if (allowNavigationRef.current) return;
      if (!isDirtyRef.current) return;
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.target === '_blank') return;

      const href = resolveFormUrl(form);
      if (!href) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (isSameDocumentUrl(url)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (isSavingRef.current) return;
      const method = (form.method || 'get').toLowerCase();
      if (method === 'get') {
        openModal({ kind: 'url', href: url.href });
      } else {
        openModal({ kind: 'form', form });
      }
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
    };
  }, [isDirty, openModal]);

  useEffect(() => {
    if (!isDirty) return;
    const navigation = (window as Window & { navigation?: NavigationAPI }).navigation;
    if (!navigation?.addEventListener) return;

    const onNavigate = (event: NavigateEventLike) => {
      if (allowNavigationRef.current) return;
      if (!isDirtyRef.current) return;
      if (event.hashChange) return;
      if (event.downloadRequest) return;
      if (event.navigationType !== 'traverse') return;
      if (!event.cancelable) return;

      event.preventDefault();
      if (isSavingRef.current) return;
      openModal({ kind: 'back' });
    };

    navigation.addEventListener('navigate', onNavigate);
    return () => {
      navigation.removeEventListener('navigate', onNavigate);
    };
  }, [isDirty, openModal]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSavingRef.current) closeModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeModal, open]);

  if (!open) return null;

  const busy = isSaving;

  return (
    <div
      className="unsaved-leave-overlay"
      role="presentation"
      onClick={() => {
        if (!busy) closeModal();
      }}
    >
      <div
        className="unsaved-leave-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-leave-title"
        style={cardBase}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="unsaved-leave-title" style={{ ...cardTitle, marginBottom: 8 }}>
          変更が保存されていません
        </h2>
        <p className="unsaved-leave-modal__body">
          このページを離れると、保存していない変更は失われます。
        </p>
        <div className="unsaved-leave-modal__actions">
          <button
            type="button"
            onClick={() => void handleSaveAndLeave()}
            disabled={busy}
            style={{
              ...buttonPrimary,
              ...(busy ? { opacity: 0.65, cursor: 'wait' } : {}),
            }}
          >
            {busy ? '保存中...' : '保存して移動'}
          </button>
          <button
            type="button"
            onClick={handleLeaveWithoutSave}
            disabled={busy}
            style={buttonSecondary}
          >
            保存せず移動
          </button>
          <button type="button" onClick={closeModal} disabled={busy} style={buttonGhost}>
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
