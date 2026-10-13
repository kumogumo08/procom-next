/** プロセス内だけの Firestore 互換。ネットワークへは接続しない。 */

function clone(value) {
  if (value === undefined) return undefined;
  return structuredClone(value);
}

function docKey(collection, id) {
  return `${collection}/${id}`;
}

export function createMemoryDb() {
  const store = new Map();
  let version = 0;
  const hooks = {
    onDirectoryPageGetWait: null,
    failDirectoryPageWrite: false,
  };
  const stats = {
    writes: 0,
    collections: new Set(),
  };

  function snapshot(collection, id) {
    const data = store.get(docKey(collection, id));
    const exists = data !== undefined;
    const frozen = exists ? clone(data) : undefined;
    return {
      id,
      exists,
      data() {
        return exists ? clone(frozen) : undefined;
      },
    };
  }

  function applyWrite(write) {
    stats.collections.add(write.collection);
    stats.writes += 1;
    const key = docKey(write.collection, write.id);
    if (write.kind === 'delete') {
      store.delete(key);
      return;
    }
    if (write.merge) {
      const prev = store.get(key) ?? {};
      store.set(key, { ...clone(prev), ...clone(write.data) });
      return;
    }
    store.set(key, clone(write.data));
  }

  function makeDoc(collection, id) {
    return {
      id,
      path: `${collection}/${id}`,
      __collection: collection,
      async get() {
        return snapshot(collection, id);
      },
      async set(data, options) {
        applyWrite({
          kind: 'set',
          collection,
          id,
          data,
          merge: Boolean(options?.merge),
        });
        version += 1;
      },
      async delete() {
        applyWrite({ kind: 'delete', collection, id });
        version += 1;
      },
    };
  }

  function makeQuery(collection, state) {
    return {
      where(field, op, value) {
        if (op !== '==') throw new Error(`未対応の演算子です: ${op}`);
        return makeQuery(collection, {
          ...state,
          filters: [...state.filters, { field, value }],
        });
      },
      orderBy(field, direction = 'asc') {
        return makeQuery(collection, { ...state, order: { field, direction } });
      },
      limit(n) {
        return makeQuery(collection, { ...state, limit: n });
      },
      async get() {
        let rows = [];
        const prefix = `${collection}/`;
        for (const [key, data] of store) {
          if (!key.startsWith(prefix)) continue;
          const id = key.slice(prefix.length);
          if (id.includes('/')) continue;
          rows.push({ id, data: clone(data) });
        }
        for (const filter of state.filters) {
          rows = rows.filter((row) => row.data?.[filter.field] === filter.value);
        }
        if (state.order) {
          const { field, direction } = state.order;
          rows.sort((a, b) => {
            const av = a.data?.[field];
            const bv = b.data?.[field];
            if (av === bv) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
            const cmp = av > bv ? 1 : -1;
            return direction === 'desc' ? -cmp : cmp;
          });
        }
        if (state.limit != null) rows = rows.slice(0, state.limit);
        return {
          size: rows.length,
          docs: rows.map((row) => ({
            id: row.id,
            data: () => clone(row.data),
          })),
        };
      },
    };
  }

  async function runTransaction(fn) {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const start = version;
      const writes = [];
      const tx = {
        async get(ref) {
          if (ref.__collection === 'directoryPages' && hooks.onDirectoryPageGetWait) {
            const wait = hooks.onDirectoryPageGetWait;
            hooks.onDirectoryPageGetWait = null;
            await wait();
          }
          return snapshot(ref.__collection, ref.id);
        },
        set(ref, data, options) {
          writes.push({
            kind: 'set',
            collection: ref.__collection,
            id: ref.id,
            data,
            merge: Boolean(options?.merge),
          });
        },
        delete(ref) {
          writes.push({ kind: 'delete', collection: ref.__collection, id: ref.id });
        },
      };
      const result = await fn(tx);
      if (version !== start) continue;
      if (
        hooks.failDirectoryPageWrite &&
        writes.some((write) => write.kind === 'set' && write.collection === 'directoryPages')
      ) {
        hooks.failDirectoryPageWrite = false;
        throw new Error('injected directoryPages write failure');
      }
      for (const write of writes) applyWrite(write);
      version += 1;
      return result;
    }
    throw new Error('transaction retries exhausted');
  }

  return {
    __isolated: true,
    __hooks: hooks,
    __stats: stats,
    collection(name) {
      const base = { filters: [], order: null, limit: null };
      return {
        doc(id) {
          return makeDoc(name, id);
        },
        get() {
          return makeQuery(name, base).get();
        },
        where(field, op, value) {
          return makeQuery(name, base).where(field, op, value);
        },
        orderBy(field, direction) {
          return makeQuery(name, base).orderBy(field, direction);
        },
        limit(n) {
          return makeQuery(name, base).limit(n);
        },
      };
    },
    runTransaction,
  };
}
