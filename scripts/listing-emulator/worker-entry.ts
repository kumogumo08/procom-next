process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '';

if (!process.env.FIRESTORE_EMULATOR_HOST.startsWith('127.0.0.1:')) {
  console.error('emulator host missing');
  process.exit(2);
}

async function main(): Promise<void> {
  const { db } = await import('@/lib/firebase-admin');
  const { noteUserListing, runListingWorker } = await import('@/lib/listing/firestoreListing');

  const settings = (db as unknown as { _settings?: { host?: string; ssl?: boolean; servicePath?: string; port?: number } })._settings;
  const endpoint = settings?.host || (settings?.servicePath && settings?.port ? `${settings.servicePath}:${settings.port}` : '');
  if (!settings || settings.ssl !== false || endpoint !== process.env.FIRESTORE_EMULATOR_HOST) {
    console.error('worker sdk is not on the emulator');
    process.exit(2);
  }

  const [command, owner, ...uids] = process.argv.slice(2);
  if (command === 'enqueue') {
    for (const uid of [owner, ...uids]) {
      if (uid) await noteUserListing(uid);
    }
    console.log(JSON.stringify({ ok: true, enqueued: [owner, ...uids].filter(Boolean).length }));
  } else if (command === 'work' && owner) {
    const result = await runListingWorker(owner);
    console.log(JSON.stringify({ ok: true, ...result }));
  } else {
    console.error('usage: enqueue uid... | work owner');
    process.exit(2);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'worker failed';
  console.error(message);
  process.exit(1);
});
