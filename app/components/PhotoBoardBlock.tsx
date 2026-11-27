'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { cardBase, cardTitle } from '@/components/ui/cardStyles';
import { PRODUCT_IMAGE_MAX_BYTES } from '@/lib/productGallery';
import {
  MAX_PHOTO_BOARD_ITEMS,
  MAX_PHOTO_BOARD_MEMO,
  MAX_PHOTO_BOARD_MEMO_LINES,
  limitPhotoBoardMemo,
  nextPhotoBoardPlacement,
  PHOTO_BOARD_THEMES,
  samePhotoBoardItems,
  type PhotoBoardItem,
  type PhotoBoardTheme,
} from '@/lib/photoBoard';
import styles from './PhotoBoardBlock.module.css';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_EDGE = 1600;
const PIN_COLORS = ['#dc2626', '#2563eb', '#16a34a', '#ca8a04', '#7c3aed', '#db2777', '#ea580c', '#0f766e', '#b91c1c', '#1d4ed8'];
const THEME_LABELS: Record<PhotoBoardTheme, string> = {
  simple: 'シンプル',
  cafe: 'カフェ',
  natural: 'ナチュラル',
  pink: 'ピンク',
  blue: 'ブルー',
  scrapbook: 'スクラップ',
  chalkboard: '黒板',
};
const EMPTY_ITEMS: PhotoBoardItem[] = [];
const MOTION_MS = 320;
const PHONE_BOARD_MEDIA = '(max-width: 767px), ((hover: none) and (pointer: coarse) and (max-height: 500px))';
const BOARD_INITIAL_WIDTH_RATIO = 1.65;
const BOARD_MAX_WIDTH_RATIO = 3.2;
const BOARD_FIT_MARGIN = 0.92;
const BOARD_PAN_THRESHOLD = 10;

type BoardView = { scale: number; x: number; y: number };

function boardScaleLimits(boardW: number, boardH: number, stageW: number, stageH: number) {
  const minScale = Math.min((stageW * BOARD_FIT_MARGIN) / boardW, (stageH * BOARD_FIT_MARGIN) / boardH);
  const maxScale = Math.max(minScale, (stageW * BOARD_MAX_WIDTH_RATIO) / boardW);
  return { minScale, maxScale };
}

function clampBoardView(view: BoardView, boardW: number, boardH: number, stageW: number, stageH: number): BoardView {
  const { minScale, maxScale } = boardScaleLimits(boardW, boardH, stageW, stageH);
  if (!Number.isFinite(minScale) || minScale <= 0) return { scale: 1, x: 0, y: 0 };
  const scale = Math.min(maxScale, Math.max(minScale, view.scale));
  const limitX = Math.max(0, (boardW * scale - stageW) / 2);
  const limitY = Math.max(0, (boardH * scale - stageH) / 2);
  return {
    scale,
    x: Math.min(limitX, Math.max(-limitX, view.x)),
    y: Math.min(limitY, Math.max(-limitY, view.y)),
  };
}

function initialBoardView(boardW: number, boardH: number, stageW: number, stageH: number): BoardView {
  return clampBoardView(
    { scale: (stageW * BOARD_INITIAL_WIDTH_RATIO) / boardW, x: 0, y: 0 },
    boardW,
    boardH,
    stageW,
    stageH
  );
}

function isPhoneBoard(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(PHONE_BOARD_MEDIA).matches;
}

type Phase = 'off' | 'in' | 'on' | 'out';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function enterAngle(rotation: number): number {
  const base = Math.abs(rotation) < 4 ? -8 : rotation;
  return Math.max(-12, Math.min(12, base));
}

const ROTATION_LIMIT = 30;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * 中心は表面の端（0〜100）まで。端では写真の一部がボードの外に出る。
 * 保存できる範囲が 0〜100 なので、それ以上は出さない。回転では範囲を狭めない。
 */
function clampPin(x: number, y: number, _rotation: number): { x: number; y: number } {
  return {
    x: round1(Math.min(100, Math.max(0, x))),
    y: round1(Math.min(100, Math.max(0, y))),
  };
}

function clampRotation(value: number): number {
  const next = Math.round(value);
  return Math.max(-ROTATION_LIMIT, Math.min(ROTATION_LIMIT, next));
}

/** 上方向を0度とし、時計回りを正にする。 */
function pointerAngle(clientX: number, clientY: number, centerX: number, centerY: number): number {
  return (Math.atan2(clientX - centerX, centerY - clientY) * 180) / Math.PI;
}

function shortestDelta(delta: number): number {
  return ((delta + 180) % 360 + 360) % 360 - 180;
}

/** 余白に収まらないときだけ小さくする。短いメモは通常のサイズのまま。 */
function fitMemoElement(node: HTMLElement) {
  const box = node.parentElement;
  if (!box) return;
  const maxHeight = box.clientHeight;
  if (maxHeight <= 0) return;
  const isField = node instanceof HTMLTextAreaElement;
  const overflows = () => {
    const line = parseFloat(getComputedStyle(node).lineHeight);
    const height = node.scrollHeight;
    const tooManyLines = Number.isFinite(line) && line > 0 && height > line * 2.35;
    return tooManyLines || height > maxHeight + 1;
  };
  node.style.fontSize = '';
  if (isField) node.style.height = 'auto';
  let size = parseFloat(getComputedStyle(node).fontSize);
  let guard = 0;
  while (overflows() && size > 6 && guard < 24) {
    size = Math.round((size - 0.5) * 10) / 10;
    node.style.fontSize = `${size}px`;
    if (isField) node.style.height = 'auto';
    guard += 1;
  }
  if (guard === 0) node.style.fontSize = '';
  if (isField) node.style.height = `${Math.min(node.scrollHeight, maxHeight)}px`;
}

/** すでに最前面なら並べ替えない。前面へ出すときも、その写真の zIndex だけを上げる。 */
function raisePhoto(items: readonly PhotoBoardItem[], id: string): PhotoBoardItem[] | null {
  const index = items.findIndex((item) => item.id === id);
  const target = items[index];
  if (!target) return null;
  let max = 0;
  let topIndex = 0;
  items.forEach((item, itemIndex) => {
    if (item.zIndex > max || (item.zIndex === max && itemIndex >= topIndex)) {
      max = item.zIndex;
      topIndex = itemIndex;
    }
  });
  if (topIndex === index) return null;
  const zIndex = Math.min(99, max + 1);
  if (zIndex === target.zIndex) return null;
  return items.map((item) => (item.id === id ? { ...item, zIndex } : item));
}

type PinDrag = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  rotation: number;
  x: number;
  y: number;
  moved: boolean;
};

type PinSpin = {
  id: string;
  pointerId: number;
  startPointer: number;
  startRotation: number;
};

function focusableIn(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  ).filter((element) => !element.hasAttribute('disabled'));
}

type Props = {
  isEditable: boolean;
  initialItems?: PhotoBoardItem[];
  initialTheme?: PhotoBoardTheme;
  onDraftChange?: (items: PhotoBoardItem[], theme: PhotoBoardTheme) => void;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像を読み込めませんでした'));
    };
    image.src = url;
  });
}

async function renderImage(image: HTMLImageElement, edge: number, type: string, quality: number): Promise<Blob> {
  const scale = Math.min(1, edge / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('画像を処理できませんでした');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error('画像を処理できませんでした');
  return blob;
}

/** 長い辺が1600pxを超える画像、または3MBを超える画像を縮小する。 */
async function preparePhoto(file: File): Promise<File> {
  if (!IMAGE_TYPES.includes(file.type)) {
    throw new Error('画像はJPEG、PNG、WebPにしてください');
  }
  const image = await loadImage(file);
  const tooWide = Math.max(image.width, image.height) > MAX_EDGE;
  if (!tooWide && file.size <= PRODUCT_IMAGE_MAX_BYTES) return file;

  const outputType = file.type === 'image/png' ? 'image/png' : file.type;
  let edge = MAX_EDGE;
  let quality = 0.85;
  let blob = await renderImage(image, edge, outputType, quality);
  while (blob.size > PRODUCT_IMAGE_MAX_BYTES && edge > 480) {
    if (outputType !== 'image/png' && quality > 0.55) quality -= 0.1;
    else edge = Math.round(edge * 0.8);
    blob = await renderImage(image, edge, outputType, quality);
  }
  if (blob.size > PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error('ファイルサイズが大きすぎます（3MB以下にしてください）');
  }
  const ext = outputType === 'image/png' ? 'png' : outputType === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `photo.${ext}`, { type: blob.type || outputType });
}

export default function PhotoBoardBlock({ isEditable, initialItems, initialTheme, onDraftChange }: Props) {
  const [items, setItems] = useState<PhotoBoardItem[]>(initialItems ?? EMPTY_ITEMS);
  const [theme, setTheme] = useState<PhotoBoardTheme>(initialTheme ?? 'simple');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [arranging, setArranging] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const memoInputRef = useRef<HTMLTextAreaElement>(null);
  const memoComposingRef = useRef(false);
  const memoBeforeCompositionRef = useRef<string | null>(null);
  const editingMemoIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [handleBox, setHandleBox] = useState<{ x: number; y: number; rotation: number } | null>(null);
  const echoRef = useRef<PhotoBoardItem[] | null>(null);
  const itemsRef = useRef(items);
  const initialRef = useRef(initialItems ?? EMPTY_ITEMS);
  const arrangingRef = useRef(false);
  const uploadingRef = useRef(false);
  const dragRef = useRef<PinDrag | null>(null);
  const rotateRef = useRef<PinSpin | null>(null);
  const rotateAnchorRef = useRef<HTMLSpanElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const blockTouchMove = useCallback((event: TouchEvent) => {
    if (!dragRef.current && !rotateRef.current) return;
    event.preventDefault();
  }, []);
  const fileRef = useRef<HTMLInputElement>(null);
  const enlargeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const boardDialogRef = useRef<HTMLDivElement>(null);
  const photoDialogRef = useRef<HTMLDivElement>(null);
  const boardCloseRef = useRef<HTMLButtonElement>(null);
  const photoCloseRef = useRef<HTMLButtonElement>(null);
  const boardRafRef = useRef<number | null>(null);
  const photoRafRef = useRef<number | null>(null);
  const boardTimerRef = useRef<number | null>(null);
  const photoTimerRef = useRef<number | null>(null);
  const boardPhaseRef = useRef<Phase>('off');
  const photoPhaseRef = useRef<Phase>('off');
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);
  const focusBoardCloseRef = useRef(false);
  const focusPhotoCloseRef = useRef(false);
  const [boardPhase, setBoardPhase] = useState<Phase>('off');
  const [photoPhase, setPhotoPhase] = useState<Phase>('off');
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [boardView, setBoardView] = useState<BoardView | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const boardElRef = useRef<HTMLDivElement>(null);
  const boardViewRef = useRef<BoardView | null>(null);
  const boardPointersRef = useRef(new Map<number, { x: number; y: number }>());
  const boardGestureRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    startScale: number;
    startDist: number;
    lx: number;
    ly: number;
    moved: boolean;
    pinched: boolean;
    photoId: string | null;
  } | null>(null);
  const blockPhotoClickRef = useRef(false);
  boardViewRef.current = boardView;
  itemsRef.current = items;
  initialRef.current = initialItems ?? EMPTY_ITEMS;
  arrangingRef.current = isEditable && arranging;
  editingMemoIdRef.current = editingMemoId;
  boardPhaseRef.current = boardPhase;
  photoPhaseRef.current = photoPhase;

  useEffect(() => {
    const incoming = initialItems ?? EMPTY_ITEMS;
    const incomingTheme = initialTheme ?? 'simple';
    if (echoRef.current && samePhotoBoardItems(echoRef.current, incoming)) {
      echoRef.current = null;
      setTheme(incomingTheme);
      return;
    }
    if (dragRef.current) return;
    setItems(incoming);
    setTheme(incomingTheme);
    setSelectedId((current) => (current && incoming.some((item) => item.id === current) ? current : null));
    setEditingMemoId((current) => (current && incoming.some((item) => item.id === current) ? current : null));
  }, [initialItems, initialTheme]);

  const commit = (next: PhotoBoardItem[], nextTheme: PhotoBoardTheme = theme) => {
    itemsRef.current = next;
    setItems(next);
    setTheme(nextTheme);
    if (samePhotoBoardItems(initialRef.current, next) && (initialTheme ?? 'simple') === nextTheme) return;
    echoRef.current = next;
    onDraftChange?.(next, nextTheme);
  };

  const releaseIfOrphan = async (url: string | undefined, nextItems: readonly PhotoBoardItem[]) => {
    if (!url || nextItems.some((item) => item.imageUrl === url)) return;
    await fetch('/api/photo-board/image', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: url }),
    }).catch(() => undefined);
  };

  const uploadOne = async (file: File): Promise<boolean> => {
    let imageUrl: string | undefined;
    try {
      const prepared = await preparePhoto(file);
      const body = new FormData();
      body.append('file', prepared);
      const res = await fetch('/api/photo-board/image', {
        method: 'POST',
        credentials: 'include',
        body,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; imageUrl?: string };
      if (!res.ok || typeof data.imageUrl !== 'string') return false;
      imageUrl = data.imageUrl;
      const slot = nextPhotoBoardPlacement(itemsRef.current);
      if (!slot) {
        void releaseIfOrphan(imageUrl, itemsRef.current);
        return false;
      }
      commit([
        ...itemsRef.current,
        {
          id: crypto.randomUUID(),
          imageUrl,
          x: slot.x,
          y: slot.y,
          rotation: slot.rotation,
          zIndex: slot.zIndex,
          memo: '',
        },
      ]);
      return true;
    } catch {
      if (imageUrl) void releaseIfOrphan(imageUrl, itemsRef.current);
      return false;
    }
  };

  const onFiles = async (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (fileRef.current) fileRef.current.value = '';
    if (files.length === 0 || uploadingRef.current) return;
    const room = MAX_PHOTO_BOARD_ITEMS - itemsRef.current.length;
    if (room <= 0) {
      setError(`写真は最大${MAX_PHOTO_BOARD_ITEMS}枚までです`);
      return;
    }
    const accepted = files.slice(0, room);
    const skipped = files.length - accepted.length;
    uploadingRef.current = true;
    setUploading(true);
    setError(null);
    setUploadProgress({ done: 1, total: accepted.length });
    let failed = 0;
    try {
      for (let index = 0; index < accepted.length; index += 1) {
        setUploadProgress({ done: index + 1, total: accepted.length });
        const file = accepted[index];
        if (!file || !(await uploadOne(file))) failed += 1;
      }
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      setUploadProgress(null);
    }
    const notices: string[] = [];
    if (skipped > 0) {
      notices.push(`${skipped}枚は追加していません。写真は最大${MAX_PHOTO_BOARD_ITEMS}枚までです`);
    }
    if (failed > 0) notices.push(`${failed}枚を追加できませんでした`);
    if (notices.length > 0) setError(notices.join('。'));
  };

  const removeItem = (id: string) => {
    if (uploadingRef.current) return;
    const current = itemsRef.current.find((item) => item.id === id);
    const next = itemsRef.current.filter((item) => item.id !== id);
    if (dragRef.current?.id === id) {
      releaseTouchBlock();
      dragRef.current = null;
    }
    setDraggingId((currentId) => (currentId === id ? null : currentId));
    setSelectedId((currentId) => (currentId === id ? null : currentId));
    setEditingMemoId((currentId) => (currentId === id ? null : currentId));
    if (next.length === 0) setArranging(false);
    commit(next);
    void releaseIfOrphan(current?.imageUrl, next);
  };

  const stopArranging = () => {
    const spin = rotateRef.current;
    rotateRef.current = null;
    releaseTouchBlock();
    dragRef.current = null;
    setDraggingId(null);
    setRotating(false);
    if (spin) {
      const item = itemsRef.current.find((entry) => entry.id === spin.id);
      if (item) patchItem(item.id, { rotation: item.rotation });
    }
    setSelectedId(null);
    setEditingMemoId(null);
    setArranging(false);
  };

  const patchItem = (id: string, patch: Partial<Pick<PhotoBoardItem, 'rotation' | 'memo'>>) => {
    const next = itemsRef.current.map((item) => {
      if (item.id !== id) return item;
      const rotation = patch.rotation ?? item.rotation;
      const memo = patch.memo ?? item.memo;
      const pos = patch.rotation == null ? null : clampPin(item.x, item.y, rotation);
      return pos ? { ...item, rotation, memo, x: pos.x, y: pos.y } : { ...item, rotation, memo };
    });
    commit(next);
  };

  const releaseTouchBlock = () => {
    document.removeEventListener('touchmove', blockTouchMove);
  };

  const onPinPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!arrangingRef.current || uploadingRef.current || event.button !== 0 || dragRef.current || rotateRef.current) return;
    if ((event.target as HTMLElement).closest('button, input, textarea, a, label')) return;
    const id = event.currentTarget.dataset.photoId;
    const item = id ? itemsRef.current.find((entry) => entry.id === id) : undefined;
    if (!item) return;
    const phone = isPhoneBoard();
    if (phone && editingMemoIdRef.current) {
      if (editingMemoIdRef.current !== item.id) setSelectedId(item.id);
      return;
    }
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ポインタがすでに離れている */
    }
    if (!phone) {
      event.preventDefault();
      const raised = raisePhoto(itemsRef.current, item.id);
      const source = raised ?? itemsRef.current;
      if (raised) commit(raised);
      const current = source.find((entry) => entry.id === item.id) ?? item;
      dragRef.current = {
        id: item.id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: current.x,
        originY: current.y,
        rotation: current.rotation,
        x: current.x,
        y: current.y,
        moved: false,
      };
      document.addEventListener('touchmove', blockTouchMove, { passive: false });
      setSelectedId(item.id);
      return;
    }
    dragRef.current = {
      id: item.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: item.x,
      originY: item.y,
      rotation: item.rotation,
      x: item.x,
      y: item.y,
      moved: false,
    };
    setSelectedId(item.id);
  };

  const onPinPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect || rect.width < 1 || rect.height < 1) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < (isPhoneBoard() ? 10 : 5)) return;
      drag.moved = true;
      setDraggingId(drag.id);
      if (isPhoneBoard()) document.addEventListener('touchmove', blockTouchMove, { passive: false });
    }
    if (event.cancelable) event.preventDefault();
    const next = clampPin(drag.originX + (dx / rect.width) * 100, drag.originY + (dy / rect.height) * 100, drag.rotation);
    if (next.x === drag.x && next.y === drag.y) return;
    drag.x = next.x;
    drag.y = next.y;
    const moved = itemsRef.current.map((item) => (item.id === drag.id ? { ...item, x: next.x, y: next.y } : item));
    itemsRef.current = moved;
    setItems(moved);
  };

  const endPinDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    releaseTouchBlock();
    setDraggingId(null);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag.moved) return;
    commit(itemsRef.current.map((item) => (item.id === drag.id ? { ...item, x: drag.x, y: drag.y } : item)));
  };

  const applyRotation = (id: string, rotation: number) => {
    const current = itemsRef.current.find((item) => item.id === id);
    if (!current) return;
    const pos = clampPin(current.x, current.y, rotation);
    if (current.rotation === rotation && current.x === pos.x && current.y === pos.y) return;
    const next = itemsRef.current.map((item) =>
      item.id === id ? { ...item, rotation, x: pos.x, y: pos.y } : item
    );
    itemsRef.current = next;
    setItems(next);
  };

  const onRotatePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!arrangingRef.current || uploadingRef.current || event.button !== 0 || dragRef.current || rotateRef.current) return;
    const pin = rotateAnchorRef.current?.parentElement;
    const item = itemsRef.current.find((entry) => entry.id === selectedId);
    if (!pin || !item) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = pin.getBoundingClientRect();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ポインタがすでに離れている */
    }
    rotateRef.current = {
      id: item.id,
      pointerId: event.pointerId,
      startPointer: pointerAngle(event.clientX, event.clientY, rect.left + rect.width / 2, rect.top + rect.height / 2),
      startRotation: item.rotation,
    };
    document.addEventListener('touchmove', blockTouchMove, { passive: false });
    setRotating(true);
  };

  const onRotatePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const spin = rotateRef.current;
    if (!spin || spin.pointerId !== event.pointerId) return;
    const pin = rotateAnchorRef.current?.parentElement;
    if (!pin) return;
    if (event.cancelable) event.preventDefault();
    const rect = pin.getBoundingClientRect();
    const angle = pointerAngle(event.clientX, event.clientY, rect.left + rect.width / 2, rect.top + rect.height / 2);
    applyRotation(spin.id, clampRotation(spin.startRotation + shortestDelta(angle - spin.startPointer)));
  };

  const endRotate = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const spin = rotateRef.current;
    if (!spin || spin.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    rotateRef.current = null;
    releaseTouchBlock();
    setRotating(false);
    const item = itemsRef.current.find((entry) => entry.id === spin.id);
    if (item) patchItem(item.id, { rotation: item.rotation });
  };

  const cancelMotion = (rafRef: { current: number | null }, timerRef: { current: number | null }) => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    rafRef.current = null;
    timerRef.current = null;
  };

  const setBoard = (phase: Phase) => {
    boardPhaseRef.current = phase;
    setBoardPhase(phase);
  };

  const setPhoto = (phase: Phase) => {
    photoPhaseRef.current = phase;
    setPhotoPhase(phase);
  };

  const playIn = (
    phaseRef: { current: Phase },
    rafRef: { current: number | null },
    setPhase: (phase: Phase) => void
  ) => {
    setPhase('in');
    if (prefersReducedMotion()) {
      setPhase('on');
      return;
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        if (phaseRef.current === 'in') setPhase('on');
      });
    });
  };

  const openBoard = (trigger: HTMLElement | null) => {
    if (arrangingRef.current || itemsRef.current.length === 0 || boardPhaseRef.current !== 'off') return;
    triggerRef.current = trigger;
    focusBoardCloseRef.current = true;
    cancelMotion(boardRafRef, boardTimerRef);
    playIn(boardPhaseRef, boardRafRef, setBoard);
  };

  const finishBoardClose = () => {
    setBoard('off');
    setPhoto('off');
    setPhotoId(null);
    boardViewRef.current = null;
    setBoardView(null);
    boardPointersRef.current.clear();
    boardGestureRef.current = null;
    blockPhotoClickRef.current = false;
  };

  const closeBoard = () => {
    if (boardPhaseRef.current === 'off' || boardPhaseRef.current === 'out') return;
    if (photoPhaseRef.current !== 'off') {
      closePhoto();
      return;
    }
    cancelMotion(boardRafRef, boardTimerRef);
    if (prefersReducedMotion() || boardPhaseRef.current === 'in') {
      finishBoardClose();
      return;
    }
    setBoard('out');
    boardTimerRef.current = window.setTimeout(finishBoardClose, MOTION_MS);
  };

  const openPhoto = (id: string) => {
    if (boardPhaseRef.current !== 'on' || photoPhaseRef.current !== 'off') return;
    if (!itemsRef.current.some((item) => item.id === id)) return;
    focusPhotoCloseRef.current = true;
    setPhotoId(id);
    cancelMotion(photoRafRef, photoTimerRef);
    playIn(photoPhaseRef, photoRafRef, setPhoto);
  };

  const closePhoto = () => {
    if (photoPhaseRef.current === 'off' || photoPhaseRef.current === 'out') return;
    const returnId = photoId;
    cancelMotion(photoRafRef, photoTimerRef);
    const restore = () => {
      setPhoto('off');
      setPhotoId(null);
      const pin = returnId
        ? boardDialogRef.current?.querySelector<HTMLElement>(`[data-photo-id="${returnId}"]`)
        : null;
      (pin ?? boardCloseRef.current)?.focus();
    };
    if (prefersReducedMotion() || photoPhaseRef.current === 'in') {
      restore();
      return;
    }
    setPhoto('out');
    photoTimerRef.current = window.setTimeout(restore, MOTION_MS);
  };

  const stepPhoto = (direction: -1 | 1) => {
    if (photoPhaseRef.current !== 'on' || itemsRef.current.length < 2) return;
    const order = [...itemsRef.current].sort((a, b) => a.x - b.x || a.y - b.y || a.zIndex - b.zIndex);
    const index = order.findIndex((item) => item.id === photoId);
    const next = order[(index + direction + order.length) % order.length];
    if (!next) return;
    setPhotoId(next.id);
    if (prefersReducedMotion()) return;
    cancelMotion(photoRafRef, photoTimerRef);
    playIn(photoPhaseRef, photoRafRef, setPhoto);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('touchmove', blockTouchMove);
      cancelMotion(boardRafRef, boardTimerRef);
      cancelMotion(photoRafRef, photoTimerRef);
    };
  }, [blockTouchMove]);

  useEffect(() => {
    if (boardPhase === 'off') return;
    const y = window.scrollY;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, y);
    };
  }, [boardPhase === 'off']);

  const boardOpen = boardPhase !== 'off';
  useLayoutEffect(() => {
    if (!boardOpen) return;
    const stage = stageRef.current;
    const board = boardElRef.current;
    if (!stage || !board) return;

    const apply = (reset: boolean) => {
      if (!isPhoneBoard()) {
        if (boardViewRef.current) {
          boardViewRef.current = null;
          setBoardView(null);
        }
        return;
      }
      const stageW = stage.clientWidth;
      const stageH = stage.clientHeight;
      const boardW = board.offsetWidth;
      const boardH = board.offsetHeight;
      if (stageW < 1 || stageH < 1 || boardW < 1 || boardH < 1) return;
      const next =
        reset || !boardViewRef.current
          ? initialBoardView(boardW, boardH, stageW, stageH)
          : clampBoardView(boardViewRef.current, boardW, boardH, stageW, stageH);
      boardViewRef.current = next;
      setBoardView(next);
    };

    apply(true);
    const onResize = () => apply(false);
    const media = window.matchMedia(PHONE_BOARD_MEDIA);
    const onMedia = () => apply(true);
    const blockTouch = (event: TouchEvent) => {
      if (!isPhoneBoard() || photoPhaseRef.current !== 'off') return;
      if (event.cancelable) event.preventDefault();
    };
    window.addEventListener('resize', onResize);
    media.addEventListener('change', onMedia);
    stage.addEventListener('touchmove', blockTouch, { passive: false });
    return () => {
      window.removeEventListener('resize', onResize);
      media.removeEventListener('change', onMedia);
      stage.removeEventListener('touchmove', blockTouch);
    };
  }, [boardOpen, theme]);

  useEffect(() => {
    if (boardPhase !== 'off' || !triggerRef.current) return;
    const trigger = triggerRef.current;
    triggerRef.current = null;
    trigger.focus();
  }, [boardPhase]);

  useEffect(() => {
    if ((boardPhase === 'in' || boardPhase === 'on') && focusBoardCloseRef.current && photoPhase === 'off') {
      focusBoardCloseRef.current = false;
      boardCloseRef.current?.focus();
    }
  }, [boardPhase, photoPhase]);

  useEffect(() => {
    if ((photoPhase === 'in' || photoPhase === 'on') && focusPhotoCloseRef.current) {
      focusPhotoCloseRef.current = false;
      photoCloseRef.current?.focus();
    }
  }, [photoPhase]);

  useEffect(() => {
    if (boardPhase === 'off') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (photoPhaseRef.current !== 'off') closePhoto();
        else closeBoard();
        return;
      }
      if (
        photoPhaseRef.current === 'on' &&
        itemsRef.current.length > 1 &&
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
      ) {
        event.preventDefault();
        stepPhoto(event.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      if (event.key !== 'Tab') return;
      const root =
        photoPhaseRef.current !== 'off'
          ? photoDialogRef.current
          : boardPhaseRef.current !== 'off'
            ? boardDialogRef.current
            : null;
      const nodes = focusableIn(root);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      const root =
        photoPhaseRef.current !== 'off'
          ? photoDialogRef.current
          : boardPhaseRef.current !== 'off'
            ? boardDialogRef.current
            : null;
      if (!root || root.contains(event.target as Node)) return;
      (focusableIn(root)[0] ?? root).focus();
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  });

  useLayoutEffect(() => {
    if (!isEditable || !arranging || !selectedId) {
      setHandleBox(null);
      return;
    }
    const place = () => {
      const anchor = rotateAnchorRef.current;
      const item = itemsRef.current.find((entry) => entry.id === selectedId);
      if (!anchor || !item) return;
      const rect = anchor.getBoundingClientRect();
      const next = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        rotation: item.rotation,
      };
      setHandleBox((prev) =>
        prev && prev.x === next.x && prev.y === next.y && prev.rotation === next.rotation ? prev : next
      );
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [isEditable, arranging, selectedId, items]);

  useEffect(() => {
    if (!editingMemoId) return;
    const input = memoInputRef.current;
    if (!input) return;
    input.focus();
  }, [editingMemoId]);

  useLayoutEffect(() => {
    let cancelled = false;
    const fit = () => {
      if (cancelled) return;
      observer.disconnect();
      const roots: Array<ParentNode | null> = [rootRef.current, boardDialogRef.current];
      for (const root of roots) {
        root?.querySelectorAll<HTMLElement>('[data-memo-fit]').forEach(fitMemoElement);
      }
      if (cancelled) return;
      if (rootRef.current) observer.observe(rootRef.current);
      if (boardDialogRef.current) observer.observe(boardDialogRef.current);
    };
    const observer = new ResizeObserver(() => fit());
    fit();
    void document.fonts?.ready.then(() => fit());
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [items, arranging, editingMemoId, boardPhase, photoPhase]);

  if (!isEditable && items.length === 0) return null;

  const arrangeOn = isEditable && arranging;
  const selected = arrangeOn ? items.find((item) => item.id === selectedId) ?? null : null;
  const shown = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.zIndex - b.item.zIndex || a.index - b.index);
  const viewerOrder = [...items].sort((a, b) => a.x - b.x || a.y - b.y || a.zIndex - b.zIndex);
  const activePhoto = viewerOrder.find((item) => item.id === photoId) ?? null;
  const canStep = viewerOrder.length > 1;

  const pinStyle = (item: PhotoBoardItem): CSSProperties => ({
    left: `${item.x}%`,
    top: `${item.y}%`,
    zIndex: item.zIndex,
    transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
  });

  const renderPins = (zoomable: boolean) =>
    shown.map(({ item }) => {
      const caption = item.memo.trim();
      const tack = (
        <span
          className={styles.tack}
          style={
            theme === 'simple'
              ? {
                  background: `radial-gradient(circle at 35% 35%, #fff 0 18%, ${PIN_COLORS[Math.abs(item.zIndex) % PIN_COLORS.length]} 19% 62%, #44403c 72%)`,
                }
              : undefined
          }
          aria-hidden="true"
        />
      );
      const card = (
        <span className={styles.polaroid}>
          <img
            className={styles.photo}
            src={item.imageUrl}
            alt={zoomable ? '' : caption || 'PHOTO BOARDの写真'}
            draggable={false}
          />
          {!zoomable && arrangeOn && editingMemoId === item.id ? (
            <span className={styles.caption}>
            <textarea
              ref={memoInputRef}
              className={styles.captionInput}
              value={item.memo}
              aria-label="写真のメモ"
              rows={1}
              data-memo-fit=""
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onCompositionStart={() => {
                memoComposingRef.current = true;
                memoBeforeCompositionRef.current = item.memo;
              }}
              onCompositionEnd={(event) => {
                memoComposingRef.current = false;
                const base = memoBeforeCompositionRef.current ?? item.memo;
                patchItem(item.id, { memo: limitPhotoBoardMemo(base, event.currentTarget.value) });
                window.setTimeout(() => {
                  if (!memoComposingRef.current) memoBeforeCompositionRef.current = null;
                }, 0);
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
                if (event.key !== 'Enter') return;
                const lines = item.memo.split('\n');
                if (lines.length >= MAX_PHOTO_BOARD_MEMO_LINES || item.memo.length + 1 > MAX_PHOTO_BOARD_MEMO) {
                  event.preventDefault();
                }
              }}
              onBeforeInput={(event) => {
                const native = event.nativeEvent;
                if (native.isComposing) return;
                if (native.inputType !== 'insertLineBreak') return;
                const lines = item.memo.split('\n');
                if (lines.length >= MAX_PHOTO_BOARD_MEMO_LINES || item.memo.length + 1 > MAX_PHOTO_BOARD_MEMO) {
                  event.preventDefault();
                }
              }}
              onPaste={(event) => {
                if (memoComposingRef.current) return;
                event.preventDefault();
                const pasted = event.clipboardData.getData('text');
                const start = event.currentTarget.selectionStart ?? item.memo.length;
                const end = event.currentTarget.selectionEnd ?? start;
                const merged = item.memo.slice(0, start) + pasted + item.memo.slice(end);
                const next = limitPhotoBoardMemo(item.memo, merged);
                patchItem(item.id, { memo: next });
                const caret = Math.min(next.length, start + pasted.length);
                requestAnimationFrame(() => {
                  memoInputRef.current?.setSelectionRange(caret, caret);
                });
              }}
              onChange={(event) => {
                const inputEvent = event.nativeEvent as InputEvent;
                if (memoComposingRef.current || inputEvent.isComposing) {
                  patchItem(item.id, { memo: event.target.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n') });
                  return;
                }
                const base = memoBeforeCompositionRef.current ?? item.memo;
                memoBeforeCompositionRef.current = null;
                patchItem(item.id, { memo: limitPhotoBoardMemo(base, event.target.value) });
              }}
              onBlur={(event) => {
                const base = memoBeforeCompositionRef.current ?? item.memo;
                memoComposingRef.current = false;
                memoBeforeCompositionRef.current = null;
                const next = limitPhotoBoardMemo(base, event.currentTarget.value);
                if (next !== item.memo) patchItem(item.id, { memo: next });
                setEditingMemoId((current) => (current === item.id ? null : current));
              }}
            />
            </span>
          ) : !zoomable && arrangeOn ? (
            <button
              type="button"
              className={styles.captionHit}
              aria-label={caption ? 'メモを編集' : 'メモを入力'}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedId(item.id);
                setEditingMemoId(item.id);
              }}
            >
              {caption ? (
                <span className={styles.captionText} data-memo-fit="">
                  {caption}
                </span>
              ) : null}
            </button>
          ) : caption ? (
            <span className={styles.caption}>
              <span className={styles.captionText} data-memo-fit="">
                {caption}
              </span>
            </span>
          ) : null}
        </span>
      );
      if (zoomable) {
        return (
          <button
            key={item.id}
            type="button"
            className={`${styles.pin} ${styles.pinButton}`}
            style={pinStyle(item)}
            data-photo-id={item.id}
            aria-label={caption ? `${caption}を拡大` : '写真を拡大'}
            onClick={(event) => {
              event.stopPropagation();
              if (blockPhotoClickRef.current) {
                blockPhotoClickRef.current = false;
                return;
              }
              openPhoto(item.id);
            }}
          >
            {tack}
            {card}
          </button>
        );
      }
      return (
        <div
          key={item.id}
          className={styles.pin}
          data-photo-id={item.id}
          data-pin=""
          data-arrange={arrangeOn ? '' : undefined}
          data-selected={arrangeOn && selectedId === item.id ? '' : undefined}
          data-dragging={draggingId === item.id ? '' : undefined}
          onPointerDown={arrangeOn ? onPinPointerDown : undefined}
          onPointerMove={arrangeOn ? onPinPointerMove : undefined}
          onPointerUp={arrangeOn ? endPinDrag : undefined}
          onPointerCancel={arrangeOn ? endPinDrag : undefined}
          onLostPointerCapture={arrangeOn ? endPinDrag : undefined}
          style={{
            ...pinStyle(item),
            ...(!zoomable && arrangeOn && isPhoneBoard() && (selectedId === item.id || draggingId === item.id)
              ? { zIndex: 100 }
              : null),
          }}
        >
          {tack}
          {card}
          {arrangeOn && selectedId === item.id ? (
            <span ref={rotateAnchorRef} className={styles.rotateAnchor} aria-hidden="true" />
          ) : null}
          {isEditable ? (
            <button
              type="button"
              className={styles.remove}
              aria-label="この写真を外す"
              disabled={uploading}
              onClick={(event) => {
                event.stopPropagation();
                removeItem(item.id);
              }}
            >
              ×
            </button>
          ) : null}
        </div>
      );
    });

  const frame = (zoomable: boolean) => (
    <div className={styles.frame} data-theme={theme}>
      <div className={styles.lights} aria-hidden="true" />
      <div className={styles.cork}>
        <div className={styles.surface} ref={zoomable ? undefined : surfaceRef}>
          {!zoomable && items.length === 0 ? <p className={styles.empty}>写真を追加すると、ここに並びます</p> : null}
          {renderPins(zoomable)}
        </div>
      </div>
    </div>
  );

  const onEditBoardClick = (event: MouseEvent<HTMLDivElement>) => {
    if (arrangingRef.current) {
      if (!(event.target as HTMLElement).closest('[data-pin]')) setSelectedId(null);
      return;
    }
    if ((event.target as HTMLElement).closest('button, input, a, label')) return;
    openBoard(enlargeRef.current);
  };

  const onPhotoPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') return;
    swipeRef.current = { x: event.clientX, y: event.clientY };
  };

  const onPhotoPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start || !canStep) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy)) return;
    swipedRef.current = true;
    stepPhoto(dx < 0 ? 1 : -1);
  };

  const commitBoardView = (next: BoardView) => {
    const stage = stageRef.current;
    const board = boardElRef.current;
    if (!stage || !board) return;
    const rect = stage.getBoundingClientRect();
    const clamped = clampBoardView(next, board.offsetWidth, board.offsetHeight, rect.width, rect.height);
    boardViewRef.current = clamped;
    setBoardView(clamped);
  };

  const onBoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPhoneBoard() || photoPhaseRef.current !== 'off' || event.button !== 0) return;
    boardPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const view = boardViewRef.current;
    const stage = stageRef.current?.getBoundingClientRect();
    if (!view || !stage) return;
    const points = [...boardPointersRef.current.values()];
    const target = event.target instanceof Element ? event.target : null;
    const photoIdFromTarget = target?.closest('[data-photo-id]')?.getAttribute('data-photo-id') ?? null;
    if (points.length >= 2) {
      const first = points[0];
      const second = points[1];
      if (!first || !second) return;
      const mid = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      boardGestureRef.current = {
        startX: mid.x,
        startY: mid.y,
        originX: view.x,
        originY: view.y,
        startScale: view.scale,
        startDist: Math.max(1, Math.hypot(first.x - second.x, first.y - second.y)),
        lx: (mid.x - stage.left - stage.width / 2 - view.x) / view.scale,
        ly: (mid.y - stage.top - stage.height / 2 - view.y) / view.scale,
        moved: true,
        pinched: true,
        photoId: boardGestureRef.current?.photoId ?? photoIdFromTarget,
      };
      blockPhotoClickRef.current = true;
    } else if (!boardGestureRef.current) {
      blockPhotoClickRef.current = false;
      boardGestureRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: view.x,
        originY: view.y,
        startScale: view.scale,
        startDist: 1,
        lx: 0,
        ly: 0,
        moved: false,
        pinched: false,
        photoId: photoIdFromTarget,
      };
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The pointer can already be gone.
    }
  };

  const onBoardPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!boardPointersRef.current.has(event.pointerId)) return;
    boardPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = boardGestureRef.current;
    const view = boardViewRef.current;
    const stage = stageRef.current?.getBoundingClientRect();
    if (!gesture || !view || !stage) return;
    if (event.cancelable) event.preventDefault();
    const points = [...boardPointersRef.current.values()];
    if (points.length >= 2) {
      const first = points[0];
      const second = points[1];
      const board = boardElRef.current;
      if (!first || !second || !board) return;
      const mid = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const dist = Math.max(1, Math.hypot(first.x - second.x, first.y - second.y));
      const limits = boardScaleLimits(board.offsetWidth, board.offsetHeight, stage.width, stage.height);
      const scale = Math.min(limits.maxScale, Math.max(limits.minScale, gesture.startScale * (dist / gesture.startDist)));
      commitBoardView({
        scale,
        x: mid.x - stage.left - stage.width / 2 - gesture.lx * scale,
        y: mid.y - stage.top - stage.height / 2 - gesture.ly * scale,
      });
      gesture.moved = true;
      gesture.pinched = true;
      return;
    }
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.moved && Math.hypot(dx, dy) >= BOARD_PAN_THRESHOLD) gesture.moved = true;
    if (!gesture.moved || gesture.pinched) return;
    commitBoardView({ scale: view.scale, x: gesture.originX + dx, y: gesture.originY + dy });
  };

  const onBoardPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!boardPointersRef.current.has(event.pointerId) && !boardGestureRef.current) return;
    boardPointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const gesture = boardGestureRef.current;
    if (!gesture) return;
    const points = [...boardPointersRef.current.values()];
    if (points.length >= 2) return;
    if (points.length === 1) {
      const point = points[0];
      const view = boardViewRef.current;
      if (!point || !view) return;
      boardGestureRef.current = {
        ...gesture,
        startX: point.x,
        startY: point.y,
        originX: view.x,
        originY: view.y,
        startScale: view.scale,
        moved: true,
        pinched: false,
      };
      return;
    }
    boardGestureRef.current = null;
    if (gesture.moved || gesture.pinched) {
      blockPhotoClickRef.current = true;
      return;
    }
    if (gesture.photoId) {
      blockPhotoClickRef.current = true;
      openPhoto(gesture.photoId);
    }
  };

  const onStageClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!isPhoneBoard()) return;
    if (blockPhotoClickRef.current) {
      blockPhotoClickRef.current = false;
      return;
    }
    if (event.target === event.currentTarget) closeBoard();
  };

  const lightbox =
    boardPhase !== 'off' && typeof document !== 'undefined'
      ? createPortal(
          <div
            className={styles.overlay}
            data-phase={boardPhase}
            onClick={(event) => {
              if (event.target !== event.currentTarget || photoPhase !== 'off') return;
              closeBoard();
            }}
          >
            <div
              ref={boardDialogRef}
              className={styles.overlayDialog}
              data-phase={boardPhase}
              role="dialog"
              aria-modal={photoPhase === 'off'}
              aria-hidden={photoPhase !== 'off' || undefined}
              aria-label="PHOTO BOARDの拡大表示"
              tabIndex={-1}
            >
              <button
                ref={boardCloseRef}
                type="button"
                className={styles.close}
                aria-label="ボードの拡大を閉じる"
                onClick={closeBoard}
              >
                ×
              </button>
              <div
                ref={stageRef}
                className={styles.overlayStage}
                onPointerDown={onBoardPointerDown}
                onPointerMove={onBoardPointerMove}
                onPointerUp={onBoardPointerUp}
                onPointerCancel={onBoardPointerUp}
                onClick={onStageClick}
              >
                <div
                  ref={boardElRef}
                  className={styles.overlayBoard}
                  style={
                    boardView
                      ? ({
                          '--pan-x': `${boardView.x}px`,
                          '--pan-y': `${boardView.y}px`,
                          '--scale': boardView.scale,
                        } as CSSProperties)
                      : undefined
                  }
                >
                  {frame(true)}
                </div>
              </div>
            </div>
            {photoPhase !== 'off' && activePhoto ? (
              <div
                ref={photoDialogRef}
                className={styles.viewer}
                data-phase={photoPhase}
                role="dialog"
                aria-modal="true"
                aria-label={activePhoto.memo.trim() || '写真の拡大表示'}
                tabIndex={-1}
                onPointerDown={onPhotoPointerDown}
                onPointerUp={onPhotoPointerUp}
                onClick={(event) => {
                  if (swipedRef.current) {
                    swipedRef.current = false;
                    return;
                  }
                  const target = event.target as HTMLElement;
                  if (target.closest('button, img')) return;
                  closePhoto();
                }}
              >
                <button
                  ref={photoCloseRef}
                  type="button"
                  className={styles.close}
                  aria-label="写真を閉じる"
                  onClick={closePhoto}
                >
                  ×
                </button>
                <div className={styles.viewerStage}>
                  <img
                    key={activePhoto.id}
                    className={styles.viewerPhoto}
                    data-phase={photoPhase}
                    src={activePhoto.imageUrl}
                    alt={activePhoto.memo.trim() || '拡大した写真'}
                    draggable={false}
                    style={{ ['--from' as string]: `${enterAngle(activePhoto.rotation)}deg` }}
                  />
                </div>
                {activePhoto.memo.trim() ? <p className={styles.viewerCaption}>{activePhoto.memo.trim()}</p> : null}
                {canStep ? (
                  <div className={styles.viewerNav}>
                    <button
                      type="button"
                      className={styles.navButton}
                      aria-label="前の写真"
                      onClick={() => stepPhoto(-1)}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className={styles.navButton}
                      aria-label="次の写真"
                      onClick={() => stepPhoto(1)}
                    >
                      ›
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>,
          document.body
        )
      : null;

  return (
    <section ref={rootRef} style={{ ...cardBase, width: '100%' }} aria-label="PHOTO BOARD" inert={boardPhase !== 'off'}>
      <h2 style={cardTitle} data-block-title="">
        <span>PHOTO BOARD</span>
      </h2>
      <div className={styles.board}>
        <div
          className={isEditable ? styles.editBoard : styles.boardHit}
          data-zoom={isEditable && items.length > 0 && !arrangeOn ? '' : undefined}
          onClick={isEditable && items.length > 0 ? onEditBoardClick : undefined}
        >
          {frame(false)}
          {items.length > 0 && !isEditable ? (
            <button
              type="button"
              className={styles.openBoard}
              aria-label="PHOTO BOARDを拡大"
              aria-haspopup="dialog"
              onClick={(event) => openBoard(event.currentTarget)}
            />
          ) : null}
        </div>
        {isEditable ? (
          <div className={styles.toolbar}>
            <button
              type="button"
              className={styles.add}
              disabled={uploading || items.length >= MAX_PHOTO_BOARD_ITEMS}
              aria-busy={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploadProgress ? `${uploadProgress.done}/${uploadProgress.total}枚` : '写真を追加'}
            </button>
            {items.length > 0 ? (
              <button
                type="button"
                className={styles.arrange}
                aria-pressed={arrangeOn}
                disabled={uploading}
                onClick={() => {
                  if (arrangeOn) stopArranging();
                  else setArranging(true);
                }}
              >
                {arrangeOn ? '配置を終了' : '配置を編集'}
              </button>
            ) : null}
            {items.length > 0 ? (
              <button
                ref={enlargeRef}
                type="button"
                className={styles.zoom}
                aria-label="PHOTO BOARDを拡大"
                aria-haspopup="dialog"
                disabled={arrangeOn}
                onClick={() => openBoard(enlargeRef.current)}
              >
                拡大
              </button>
            ) : null}
            <label className={styles.themeField}>
              <span className={styles.themeLabel}>ボードデザイン</span>
              <select
                className={styles.themeSelect}
                value={theme}
                aria-label="ボードデザイン"
                onChange={(event) => {
                  const next = PHOTO_BOARD_THEMES.find((entry) => entry === event.target.value) ?? 'simple';
                  commit(itemsRef.current, next);
                }}
              >
                {PHOTO_BOARD_THEMES.map((entry) => (
                  <option key={entry} value={entry}>
                    {THEME_LABELS[entry]}
                  </option>
                ))}
              </select>
            </label>
            <span className={styles.count}>
              {items.length}/{MAX_PHOTO_BOARD_ITEMS}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(event) => {
                void onFiles(event.target.files);
              }}
            />
          </div>
        ) : null}
        {arrangeOn && !selected ? (
          <p className={styles.hint}>写真をタップして選択し、ドラッグで移動できます</p>
        ) : null}
        {arrangeOn && items.length > 0 ? (
          <p className={styles.hint}>写真の下の白い部分をタップすると、メモを入力できます（最大25文字）</p>
        ) : null}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>
      {lightbox}
      {arrangeOn && selected && handleBox && typeof document !== 'undefined'
        ? createPortal(
            <button
              type="button"
              className={styles.rotateHandle}
              data-rotating={rotating ? '' : undefined}
              style={{
                left: handleBox.x,
                top: handleBox.y,
                transform: `translate(-50%, -50%) rotate(${handleBox.rotation}deg)`,
              }}
              aria-label="写真を回転"
              onPointerDown={onRotatePointerDown}
              onPointerMove={onRotatePointerMove}
              onPointerUp={endRotate}
              onPointerCancel={endRotate}
            >
              ↻
            </button>,
            document.body
          )
        : null}
    </section>
  );
}
