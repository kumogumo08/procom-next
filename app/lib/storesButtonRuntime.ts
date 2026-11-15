/**
 * 公式 button.js を1回だけ読み、複数商品の div をまとめて渡す。
 * リスナーは読み込みのあいだだけ記録し、次の初期化の前に外す。
 * ボタンの DOM は React の子にしない。呼び出し側がスロット要素を渡す。
 */

import { STORES_BUTTON_SCRIPT_URL, type StoresProduct } from '@/lib/storesProducts';

type CapturedListener = {
  target: EventTarget;
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
};

export type StoresButtonMount = {
  slot: HTMLElement;
  product: StoresProduct;
};

type Status = 'ready' | 'error';

const registry = new Map<HTMLElement, StoresProduct>();
const statusListeners = new Set<(status: Status) => void>();
let scheduled = false;
let queue: Promise<void> = Promise.resolve();
let epoch = 0;
let active: CapturedListener[] = [];

function isStoresListener(listener: EventListenerOrEventListenerObject, type: string): boolean {
  const fn = typeof listener === 'function' ? listener : listener.handleEvent;
  let source = '';
  try {
    source = Function.prototype.toString.call(fn);
  } catch {
    return false;
  }
  if (type === 'message') return source.includes('storesjp-button-cart');
  if (type === 'pageshow') return source.includes('persisted') && source.includes('reload');
  return false;
}

function removeListeners(listeners: readonly CapturedListener[]) {
  for (const item of listeners) {
    item.target.removeEventListener(item.type, item.listener, item.options);
  }
}

function createButton(product: StoresProduct): HTMLDivElement {
  const button = document.createElement('div');
  button.className = 'storesjp-button';
  button.setAttribute('data-storesjp-name', product.name);
  button.setAttribute('data-storesjp-item', product.item);
  button.setAttribute('data-storesjp-variation', product.variation);
  button.setAttribute('data-storesjp-layout', product.layout);
  button.setAttribute('data-storesjp-lang', product.lang);
  if (product.image) button.setAttribute('data-storesjp-image', product.image);
  return button;
}

function retireChildren(host: HTMLElement) {
  if (host.childNodes.length === 0) return;
  const bin = document.createElement('div');
  bin.hidden = true;
  document.body.appendChild(bin);
  while (host.firstChild) bin.appendChild(host.firstChild);
  window.setTimeout(() => bin.remove(), 30000);
}

function paint(entries: readonly StoresButtonMount[]) {
  for (const entry of entries) {
    retireChildren(entry.slot);
    entry.slot.replaceChildren(createButton(entry.product));
  }
}

function emit(status: Status) {
  for (const listener of statusListeners) listener(status);
}

function loadOfficialScript(): Promise<CapturedListener[]> {
  const captured: CapturedListener[] = [];
  const original = EventTarget.prototype.addEventListener;
  const patched = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ) {
    if (listener && (type === 'message' || type === 'pageshow') && isStoresListener(listener, type)) {
      captured.push({ target: this, type, listener, options });
    }
    return original.call(this, type, listener, options);
  } as typeof EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = patched;
  const restore = () => {
    if (EventTarget.prototype.addEventListener === patched) {
      EventTarget.prototype.addEventListener = original;
    }
  };
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = STORES_BUTTON_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      restore();
      script.remove();
      resolve(captured);
    };
    script.onerror = () => {
      restore();
      script.remove();
      reject(new Error('stores-button-load-failed'));
    };
    try {
      document.head.appendChild(script);
    } catch (error) {
      restore();
      reject(error instanceof Error ? error : new Error('stores-button-load-failed'));
    }
  });
}

function waitForFrames(entries: readonly StoresButtonMount[], id: number): Promise<void> {
  if (entries.length === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      observer.disconnect();
      if (id !== epoch) {
        resolve();
        return;
      }
      if (ok) resolve();
      else reject(new Error('stores-button-render-failed'));
    };
    const ready = () => entries.every((entry) => entry.slot.querySelector('iframe'));
    const observer = new MutationObserver(() => {
      if (ready()) finish(true);
    });
    for (const entry of entries) observer.observe(entry.slot, { childList: true });
    const timer = window.setTimeout(() => finish(ready()), 8000);
    if (ready()) finish(true);
  });
}

function sync(entries: readonly StoresButtonMount[]): Promise<void> {
  const id = ++epoch;
  const run = queue.then(async () => {
    try {
      if (id !== epoch) return;
      removeListeners(active);
      active = [];
      paint(entries);
      if (entries.length === 0) {
        emit('ready');
        return;
      }
      const listeners = await loadOfficialScript();
      if (id !== epoch) {
        removeListeners(listeners);
        return;
      }
      active = listeners;
      await waitForFrames(entries, id);
      if (id !== epoch) return;
      emit('ready');
    } catch {
      if (id !== epoch) return;
      emit('error');
    }
  });
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    const entries = [...registry.entries()].map(([slot, product]) => ({ slot, product }));
    void sync(entries);
  });
}

export function bindStoresButton(slot: HTMLElement, product: StoresProduct): () => void {
  registry.set(slot, product);
  schedule();
  return () => {
    if (registry.get(slot) !== product) return;
    registry.delete(slot);
    retireChildren(slot);
    schedule();
  };
}

export function subscribeStoresButtonStatus(listener: (status: Status) => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}
