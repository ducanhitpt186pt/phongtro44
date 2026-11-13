// Máy chủ chạy liên tục cho Render (hoặc VPS/Docker): phục vụ thư mục public/ và /api/* (cùng mã với bản Vercel).
// Render: Build Command = npm install   |   Start Command = npm start
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { entry } from './lib/router.js';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const SEC = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" };
const server = http.createServer((req, res) => {
  for (const [k, v] of Object.entries(SEC)) res.setHeader(k, v);
  const url = new URL(req.url, 'http://x'); const p = decodeURIComponent(url.pathname);
  if (p === '/healthz') { res.setHeader('Content-Type', 'text/plain'); return res.end('ok'); } // Render dùng để kiểm tra máy chủ còn sống
  if (p.startsWith('/api/')) return entry(req, res);
  let f = path.normalize(path.join(root, p)); if (!f.startsWith(root)) { res.statusCode = 403; return res.end('403'); }
  if (p.endsWith('/')) f = path.join(f, 'index.html');
  fs.readFile(f, (e, d) => {
    if (e) { res.statusCode = 404; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); return res.end('Không tìm thấy trang'); }
    const ext = path.extname(f); res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', ['.html', '.js', '.css', '.webmanifest'].includes(ext) ? 'no-cache' : 'public, max-age=86400');
    res.end(req.method === 'HEAD' ? undefined : d);
  });
});
const port = Number(process.env.PORT) || 3000;
server.listen(port, '0.0.0.0', () => console.log(`Nhà trọ 44 đang chạy ở cổng ${port}`));
