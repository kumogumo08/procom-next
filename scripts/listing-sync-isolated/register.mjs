import https from 'node:https';
import http from 'node:http';
import net from 'node:net';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

globalThis.__procomListingIsolation = {
  remoteAttempts: [],
  redirected: [],
};

function noteRemote(target) {
  const text = String(target ?? '');
  if (
    text.includes('googleapis') ||
    text.includes('firebaseio') ||
    text.includes('firestore.google') ||
    text.includes(':443')
  ) {
    globalThis.__procomListingIsolation.remoteAttempts.push(text);
    throw new Error('リモート接続を拒否しました');
  }
}

const originalHttps = https.request;
https.request = function patchedHttps(options, ...rest) {
  const host = typeof options === 'string' ? options : options?.hostname || options?.host || '';
  noteRemote(host);
  return originalHttps.call(this, options, ...rest);
};

const originalHttp = http.request;
http.request = function patchedHttp(options, ...rest) {
  const host = typeof options === 'string' ? options : options?.hostname || options?.host || '';
  noteRemote(host);
  return originalHttp.call(this, options, ...rest);
};

const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function patchedConnect(...args) {
  noteRemote(typeof args[0] === 'object' ? `${args[0]?.host ?? ''}:${args[0]?.port ?? ''}` : args[0]);
  return originalConnect.apply(this, args);
};

register('./loader.mjs', { parentURL: import.meta.url });
void pathToFileURL;
