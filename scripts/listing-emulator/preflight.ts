/** 移行スクリプトと同じ初期化で、書き込む前に Emulator 接続だけを確認する。 */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host.startsWith('127.0.0.1:')) {
  console.log(JSON.stringify({ ok: false, reason: 'FIRESTORE_EMULATOR_HOST が 127.0.0.1 ではありません' }));
  process.exit(2);
}

const fs = await import('node:fs');
const path = await import('node:path');
const admin = (await import('firebase-admin')).default;

const keyPath = process.env.FIREBASE_KEY_PATH;
if (!keyPath) {
  console.log(JSON.stringify({ ok: false, reason: 'FIREBASE_KEY_PATH がありません' }));
  process.exit(2);
}
const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(keyPath), 'utf8')) as {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};
if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
  console.log(JSON.stringify({ ok: false, reason: '秘密鍵の形式が不正です' }));
  process.exit(2);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();
const settings = (db as unknown as { _settings?: { host?: string; ssl?: boolean; projectId?: string; servicePath?: string; port?: number } })._settings;
const endpoint = settings?.host || (settings?.servicePath && settings?.port ? `${settings.servicePath}:${settings.port}` : '');
if (!settings || settings.ssl !== false || endpoint !== host) {
  console.log(JSON.stringify({ ok: false, reason: 'Admin SDK の接続先を Emulator と確認できません' }));
  process.exit(2);
}

const snap = await db.collection('users').select().get();
const foreignIds = snap.docs.map((doc) => doc.id).filter((id) => !id.startsWith('emu'));
console.log(
  JSON.stringify({
    ok: foreignIds.length === 0,
    host: endpoint,
    ssl: settings.ssl,
    projectId: settings.projectId ?? serviceAccount.project_id,
    userCount: snap.size,
    foreignIds: foreignIds.length,
  })
);
process.exit(foreignIds.length === 0 ? 0 : 2);

export {};
