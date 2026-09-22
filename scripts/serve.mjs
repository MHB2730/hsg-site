/* Local preview of dist/ with clean URLs: `npm run serve` (http://localhost:4180).
 * POST /contact.php is stubbed (logs the payload, answers success) because PHP
 * only runs on the host — use it to test the form flow, not delivery. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..', 'dist'));
const PORT = process.env.PORT || 4180;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.pdf': 'application/pdf',
};

createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  if (req.method === 'POST' && path === '/contact.php') {
    let raw = ''; req.on('data', c => raw += c); req.on('end', () => {
      console.log('contact.php (stub) received:', raw.slice(0, 500));
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: true, stub: true }));
    });
    return;
  }
  try {
    let file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
    let s = await stat(file).catch(() => null);
    if (s?.isDirectory()) { if (!path.endsWith('/')) { res.writeHead(301, { Location: path + '/' }).end(); return; } file = join(file, 'index.html'); s = await stat(file).catch(() => null); }
    if (!s) throw new Error('404');
    const body = await readFile(file);
    const ext = extname(file);
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600' });
    res.end(body);
  } catch {
    const nf = await readFile(join(ROOT, '404.html')).catch(() => 'Not found');
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }).end(nf);
  }
}).listen(PORT, () => console.log(`hsg-site preview at http://localhost:${PORT}`));
