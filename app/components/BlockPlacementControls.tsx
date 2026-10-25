'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BLOCK_LABELS, isKnownBlockType, type BlockType } from '@/lib/blockLayout';

export const PALETTE_DRAG_PREFIX = 'palette:';
export const PROFILE_INSERT_COLUMN_ID = 'profile-insert-column';
export const PROFILE_ADD_PANEL_ID = 'profile-add-panel';

export function paletteDragId(block: string): string {
  return `${PALETTE_DRAG_PREFIX}${block}`;
}

export function blockIdFromPaletteDrag(id: string): string | null {
  if (!id.startsWith(PALETTE_DRAG_PREFIX)) return null;
  const block = id.slice(PALETTE_DRAG_PREFIX.length);
  return isKnownBlockType(block) ? block : null;
}

function focusableIn(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute('disabled'));
}

export function ProfileInsertColumn({
  empty,
  highlighted,
  children,
}: {
  empty: boolean;
  highlighted: boolean;
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: PROFILE_INSERT_COLUMN_ID });
  return (
    <div
      ref={setNodeRef}
      className={
        empty
          ? `profile-insert-column block-insert-empty${highlighted ? ' block-insert-empty--active' : ''}`
          : 'profile-insert-column'
      }
    >
      {empty ? <p className="block-insert-empty__label">ここにドロップしてブロックを追加</p> : null}
      {children}
    </div>
  );
}

function PaletteAddOption({
  block,
  canDrag,
  onAdd,
}: {
  block: BlockType;
  canDrag: boolean;
  onAdd: (block: BlockType) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef } = useDraggable({
    id: paletteDragId(block),
    disabled: !canDrag,
  });
  const label = BLOCK_LABELS[block];

  return (
    <div ref={setNodeRef} className="block-add-option-row">
      {canDrag ? (
        <button
          type="button"
          className="block-add-handle"
          aria-label={`${label}をドラッグして追加`}
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
        >
          <span aria-hidden="true">≡</span>
        </button>
      ) : null}
      <button
        type="button"
        className="block-placement-btn block-add-option"
        data-block-add-option
        onClick={() => onAdd(block)}
      >
        {block === 'Calendar' ? '📅 ' : ''}
        {label}
      </button>
    </div>
  );
}

export function BlockAddControl({
  available,
  onAdd,
  closeTick = 0,
  dragActive = false,
}: {
  available: readonly BlockType[];
  onAdd: (block: BlockType) => void;
  closeTick?: number;
  dragActive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [canDragAdd, setCanDragAdd] = useState(false);
  const panelId = useId();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const { setNodeRef: setPanelDropRef } = useDroppable({ id: PROFILE_ADD_PANEL_ID });
  const setPanelNodeRef = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node;
    setPanelDropRef(node);
  }, [setPanelDropRef]);
  const fabRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const closeTickRef = useRef(closeTick);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 641px) and (pointer: fine)');
    const update = () => setCanDragAdd(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (closeTickRef.current === closeTick) return;
    closeTickRef.current = closeTick;
    setOpen(false);
  }, [closeTick]);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) fabRef.current?.focus();
      wasOpenRef.current = false;
      return;
    }
    wasOpenRef.current = true;
    const option = panelRef.current?.querySelector<HTMLButtonElement>('[data-block-add-option]');
    const close = panelRef.current?.querySelector<HTMLButtonElement>('[data-block-add-close]');
    (option ?? close)?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusableIn(panelRef.current);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      {open ? (
        <div className="block-add-layer">
          <div
            className={`block-add-backdrop${dragActive ? ' block-add-backdrop--passthrough' : ''}`}
            onMouseDown={() => setOpen(false)}
          />
          <div
            id={panelId}
            ref={setPanelNodeRef}
            className="block-add-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="block-add-panel__header">
              <h2 id={titleId} className="block-add-panel__title">
                ブロックを追加
              </h2>
              <button
                type="button"
                className="block-placement-btn"
                data-block-add-close
                onClick={() => setOpen(false)}
              >
                閉じる
              </button>
            </div>
            <div className="block-add-panel__list">
              {available.length === 0 ? (
                <p className="block-placement-note">
                  追加できるブロックはありません。すべての種類が配置済みです。
                </p>
              ) : (
                available.map((block) => (
                  <PaletteAddOption
                    key={block}
                    block={block}
                    canDrag={canDragAdd}
                    onAdd={(next) => {
                      onAdd(next);
                      setOpen(false);
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
      <button
        ref={fabRef}
        type="button"
        className="block-add-fab"
        aria-label="ブロックを追加"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="block-add-fab__icon" aria-hidden="true">
          ＋
        </span>
        <span className="block-add-fab__label">ブロック追加</span>
      </button>
    </>
  );
}

export function SortableProfileBlock({
  id,
  label,
  onDetach,
  insertEdge = null,
  children,
}: {
  id: string;
  label: string;
  onDetach: () => void;
  insertEdge?: 'before' | 'after' | null;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const insertClass =
    insertEdge === 'before'
      ? ' block-edit-frame--insert-before'
      : insertEdge === 'after'
        ? ' block-edit-frame--insert-after'
        : '';

  return (
    <div
      ref={setNodeRef}
      className={`block-edit-frame${isDragging ? ' block-edit-frame--dragging' : ''}${insertClass}`}
      style={{
        // Overlay がある間、掴んでいる本体には移動 transform を載せない
        transform: isDragging ? undefined : CSS.Transform.toString(transform),
        transition: isDragging ? undefined : transition,
      }}
    >
      <button
        type="button"
        className="block-drag-handle"
        aria-label={`${label}を移動`}
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
      >
        <span aria-hidden="true">≡</span>
      </button>
      <BlockDetachControl label={label} onDetach={onDetach} />
      {children}
    </div>
  );
}

const BLOCK_DRAG_MARK: Record<BlockType, string> = {
  YouTube: '▶',
  X: 'X',
  Instagram: 'IG',
  TikTok: 'TT',
  Facebook: 'f',
  BannerLinks: 'URL',
  AppProjects: 'App',
  SNSButtons: 'SNS',
  Calendar: '📅',
};

export function BlockDragPreview({ id }: { id: string }) {
  const label = isKnownBlockType(id) ? BLOCK_LABELS[id] : id;
  const mark = isKnownBlockType(id) ? BLOCK_DRAG_MARK[id] : '≡';

  return (
    <div className="block-drag-preview" role="presentation">
      <span className="block-drag-preview__mark" aria-hidden="true">
        {mark}
      </span>
      <span className="block-drag-preview__label">{label}</span>
    </div>
  );
}

export function BlockDetachControl({ label, onDetach }: { label: string; onDetach: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const noteId = useId();

  const closeMenu = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setConfirming(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(true);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [closeMenu, open]);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLButtonElement>('[data-block-menu-action]')?.focus();
  }, [open, confirming]);

  return (
    <div className="block-edit-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="block-edit-menu__trigger"
        aria-label={`${label}の操作`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          if (open) closeMenu(false);
          else setOpen(true);
        }}
      >
        <span aria-hidden="true">…</span>
      </button>
      {open ? (
        <div id={menuId} className="block-edit-menu__panel" role="menu" aria-label={`${label}の操作`}>
          {confirming ? (
            <div role="group" aria-label={`${label}を外す確認`} aria-describedby={noteId}>
              <p id={noteId} className="block-placement-note">
                {label}を公開ページから外します。入力内容は残り、もう一度追加すると復元できます。
              </p>
              <div className="block-placement-confirm__actions">
                <button
                  type="button"
                  className="block-placement-btn"
                  data-block-menu-action
                  role="menuitem"
                  onClick={onDetach}
                >
                  ブロックを外す
                </button>
                <button
                  type="button"
                  className="block-placement-btn"
                  role="menuitem"
                  onClick={() => setConfirming(false)}
                >
                  やめる
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="block-placement-btn"
              data-block-menu-action
              role="menuitem"
              onClick={() => setConfirming(true)}
            >
              ブロックを外す
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
