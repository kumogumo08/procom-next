import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');

await esbuild.build({
  entryPoints: [path.resolve('scripts/listing-emulator/worker-entry.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: path.resolve('scripts/listing-emulator/worker-bundle.cjs'),
  external: ['firebase-admin', 'firebase-admin/firestore'],
  alias: {
    'server-only': path.resolve('scripts/listing-emulator/empty.mjs'),
    'next/cache': path.resolve('scripts/listing-emulator/cache-stub.cjs'),
  },
  plugins: [
    {
      name: 'app-alias',
      setup(build) {
        build.onResolve({ filter: /^@\// }, (args) => {
          const base = path.join(process.cwd(), 'app', args.path.slice(2));
          const file = ['.ts', '.tsx', '.js', '.mjs'].map((ext) => `${base}${ext}`).find((candidate) => fs.existsSync(candidate));
          if (!file) return { errors: [{ text: `alias not found: ${args.path}` }] };
          return { path: file };
        });
      },
    },
  ],
});
