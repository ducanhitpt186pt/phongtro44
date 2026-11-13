// Máy chủ thử nghiệm cục bộ: phục vụ public/ + /api với GitHub GIẢ LẬP (bộ nhớ). Chỉ dùng để kiểm thử.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
process.env.APP_PASSWORD = '20101963'; process.env.SESSION_SECRET = 'e'.repeat(40); process.env.E2E_FAKE_BLOB = '1';
const { fakeStore } = await import('../lib/blob.js');
if (process.env.E2E_SEED) fakeStore.files.set('data/database.json', { buf: Buffer.from(fs.readFileSync(process.env.E2E_SEED, 'utf8')), etag: '"seed"', at: new Date().toISOString() });
const { entry } = await import('../lib/router.js');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return entry(req, res);
  let f = path.join('public', req.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, d) => { if (e) { res.statusCode = 404; return res.end('404'); } res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream'); res.end(d); });
});
srv.listen(4173, () => console.log('E2E server http://localhost:4173'));
