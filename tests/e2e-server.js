// Máy chủ thử nghiệm cục bộ: phục vụ public/ + /api với GitHub GIẢ LẬP (bộ nhớ). Chỉ dùng để kiểm thử.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
process.env.APP_PASSWORD = '20101963'; process.env.SESSION_SECRET = 'e'.repeat(40); process.env.GITHUB_TOKEN = 't'; process.env.GITHUB_OWNER = 'o'; process.env.GITHUB_REPO = 'r'; process.env.E2E_FAKE_BLOB = '1';
const files = new Map(); const realFetch = fetch;
globalThis.fetch = async (u, o = {}) => {
  if (!String(u).startsWith('https://api.github.com')) return realFetch(u, o);
  const p = decodeURIComponent(new URL(u).pathname.split('/contents/')[1] || ''); const R = (s, b) => new Response(JSON.stringify(b ?? {}), { status: s });
  if (!o.method || o.method === 'GET') { const f = files.get(p); return f ? R(200, { sha: f.sha, encoding: 'base64', content: Buffer.from(f.text).toString('base64') }) : R(404); }
  const b = JSON.parse(o.body); const f = files.get(p); if ((f && f.sha !== b.sha) || (!f && b.sha)) return R(409);
  const sha = crypto.randomBytes(8).toString('hex'); files.set(p, { text: Buffer.from(b.content, 'base64').toString(), sha }); return R(200, { content: { sha } });
};
const { entry } = await import('../lib/router.js');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return entry(req, res);
  let f = path.join('public', req.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, d) => { if (e) { res.statusCode = 404; return res.end('404'); } res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream'); res.end(d); });
});
srv.listen(4173, () => console.log('E2E server http://localhost:4173'));
