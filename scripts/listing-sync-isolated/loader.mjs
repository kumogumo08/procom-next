import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const mockUrl = pathToFileURL(path.join(dir, 'firebase-admin-mock.mjs')).href;
const emptyUrl = pathToFileURL(path.join(dir, 'empty.mjs')).href;
const cacheUrl = pathToFileURL(path.join(dir, 'next-cache-mock.mjs')).href;

function record(specifier) {
  globalThis.__procomListingIsolation?.redirected.push(specifier);
}

export async function resolve(specifier, context, nextResolve) {
  const normalized = specifier.replaceAll('\\', '/');
  if (normalized === 'server-only' || normalized.endsWith('/server-only')) {
    record(specifier);
    return { url: emptyUrl, shortCircuit: true };
  }
  if (normalized === 'next/cache') {
    record(specifier);
    return { url: cacheUrl, shortCircuit: true };
  }
  if (
    normalized === '@/lib/firebase-admin' ||
    normalized.endsWith('/lib/firebase-admin') ||
    normalized.endsWith('/app/lib/firebase-admin.ts')
  ) {
    record(specifier);
    return { url: mockUrl, shortCircuit: true };
  }
  if (normalized === 'firebase-admin' || normalized.startsWith('firebase-admin/')) {
    throw new Error(`本番 firebase-admin の読み込みを拒否しました: ${normalized}`);
  }
  const resolved = await nextResolve(specifier, context);
  const url = resolved.url.replaceAll('\\', '/');
  if (url.includes('/app/lib/firebase-admin')) {
    record(resolved.url);
    return { url: mockUrl, shortCircuit: true };
  }
  if (url.includes('/node_modules/firebase-admin/')) {
    throw new Error('本番 firebase-admin の読み込みを拒否しました');
  }
  return resolved;
}
