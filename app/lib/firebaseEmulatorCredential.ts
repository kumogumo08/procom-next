import { generateKeyPairSync } from 'node:crypto';

/** メモリ上で作る使い捨て鍵。ファイルは読まない。本番の API では使えない。 */
export function emulatorServiceAccount(projectId: string): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const exported = privateKey.export({ type: 'pkcs8', format: 'pem' });
  return {
    projectId,
    clientEmail: `emulator@${projectId}.iam.gserviceaccount.com`,
    privateKey: typeof exported === 'string' ? exported : exported.toString('utf8'),
  };
}

export function markEmulatorCredential(): void {
  (globalThis as { __procomEmulatorCredential?: boolean }).__procomEmulatorCredential = true;
}
