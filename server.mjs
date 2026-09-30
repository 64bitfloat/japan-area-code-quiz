import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const publicRoot = path.join(projectRoot, 'public');
const port = Number(process.env.PORT || 3000);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function safePath(urlPath) {
  const pathname = decodeURIComponent(new URL(urlPath, 'http://localhost').pathname);
  if (pathname === '/') return path.join(publicRoot, 'index.html');
  const base = pathname.startsWith('/src/') ? projectRoot : publicRoot;
  const absolute = path.resolve(base, `.${pathname}`);
  return absolute.startsWith(base) ? absolute : null;
}
const server = http.createServer((request, response) => {
  const filePath = safePath(request.url || '/');
  if (!filePath) { response.writeHead(403); response.end('Forbidden'); return; }
  fs.stat(filePath, (error, stat) => {
    const target = !error && stat.isFile() ? filePath : null;
    if (!target) { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Not found'); return; }
    fs.readFile(target, (readError, body) => {
      if (readError) { response.writeHead(500); response.end('Server error'); return; }
      const contentType = types[path.extname(target).toLowerCase()] || 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': contentType.includes('html') ? 'no-cache' : 'public, max-age=3600' });
      response.end(body);
    });
  });
});
server.listen(port, '0.0.0.0', () => console.log(`denbanquiz listening on http://0.0.0.0:${port}`));
