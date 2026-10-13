const fs = require('node:fs');

const names = ['BatchGetDocuments', 'RunQuery', 'Commit', 'BeginTransaction', 'ListDocuments'];

function note(line) {
  const file = process.env.EMU_RPC_LOG;
  if (!file) return;
  fs.appendFileSync(file, `${line}\n`);
}

function patchFirestore(mod) {
  if (!mod || mod.__emuReadPatched) return;
  const Query = mod.Query;
  const DocumentReference = mod.DocumentReference;
  if (!Query?.prototype?.get || !DocumentReference?.prototype?.get) return;
  mod.__emuReadPatched = true;

  const originalQueryGet = Query.prototype.get;
  Query.prototype.get = async function patchedQueryGet(...args) {
    const snap = await originalQueryGet.apply(this, args);
    const collectionId = this._queryOptions?.collectionId;
    const limit = this._queryOptions?.limit;
    note(`read query collection=${collectionId ?? ''} size=${snap.size} limit=${limit ?? ''}`);
    return snap;
  };

  const originalDocGet = DocumentReference.prototype.get;
  DocumentReference.prototype.get = async function patchedDocGet(...args) {
    const snap = await originalDocGet.apply(this, args);
    note(`read doc path=${this.path} exists=${snap.exists}`);
    return snap;
  };

  for (const method of ['set', 'update', 'create', 'delete']) {
    const original = DocumentReference.prototype[method];
    if (typeof original !== 'function') continue;
    DocumentReference.prototype[method] = function patchedWrite(...args) {
      note(`write ${method} path=${this.path}`);
      return original.apply(this, args);
    };
  }
}

const Module = require('node:module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function patchedRequire(id) {
  const loaded = originalRequire.apply(this, arguments);
  if (typeof id === 'string' && id.includes('@google-cloud/firestore')) {
    try {
      patchFirestore(loaded);
    } catch {
      // 観測できない場合はテスト側で BLOCKED にする。
    }
  }
  return loaded;
};

note('preload-ready');
void names;
