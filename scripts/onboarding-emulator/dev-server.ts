/**
 * 初期設定用の Next.js。本番の鍵と SESSION_PASSWORD は空にしてから起動する。
 * 先に npm run emulators:start を別のターミナルで実行する。
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import { EMULATOR, applyIsolatedEnv } from './isolate';

function portOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });
}

const authPort = Number(EMULATOR.authHost.split(':')[1]);
const firestorePort = Number(EMULATOR.firestoreHost.split(':')[1]);
const storagePort = Number(EMULATOR.storageHost.split(':')[1]);
const ready = await Promise.all([portOpen(authPort), portOpen(firestorePort), portOpen(storagePort)]);
if (ready.some((open) => !open)) {
  console.error('Auth、Firestore、Storage の Emulator が揃っていません。Next は起動せず停止しました。');
  process.exit(1);
}
if (await portOpen(EMULATOR.nextPort)) {
  console.error(`127.0.0.1:${EMULATOR.nextPort} は使用中です。Next は起動せず停止しました。`);
  process.exit(1);
}

applyIsolatedEnv();
const child = spawn('npx', ['next', 'dev', '-H', '127.0.0.1', '-p', String(EMULATOR.nextPort)], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});
child.on('exit', (code) => process.exit(code ?? 0));
