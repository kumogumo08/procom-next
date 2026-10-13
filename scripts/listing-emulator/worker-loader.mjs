import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const emptyUrl = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'empty.mjs')).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return { url: emptyUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
