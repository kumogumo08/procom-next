const stub = new URL('./server-only-stub.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return { url: stub, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
