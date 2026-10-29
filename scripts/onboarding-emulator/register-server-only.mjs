import { register } from 'node:module';

register(new URL('./server-only-hook.mjs', import.meta.url), import.meta.url);
