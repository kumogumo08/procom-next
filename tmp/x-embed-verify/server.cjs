const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const rel = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.join(root, rel);
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const type = file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
});

server.listen(8765, '127.0.0.1', () => {
  console.log('x-embed-verify listening on http://127.0.0.1:8765');
});
