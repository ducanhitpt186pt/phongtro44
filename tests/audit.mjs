// Rà soát tĩnh: nút bấm không có xử lý, API client gọi mà server không có, TODO còn sót, nhãn/biến thiếu.
import fs from 'node:fs'; import path from 'node:path';
const read = (p) => fs.readFileSync(p, 'utf8'); const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const client = walk('public/js').filter((f) => f.endsWith('.js')); const all = client.map((f) => [f, read(f)]); const code = all.map(([, s]) => s).join('\n');
let bad = 0; const fail = (m) => { bad++; console.log('  ✗', m); };
const names = (re, s) => [...s.matchAll(re)].map((m) => m[1]);
const used = { act: new Set(names(/data-act="([\w-]+)"/g, code)), form: new Set(names(/data-form="([\w-]+)"/g, code)), change: new Set(names(/data-change="([\w-]+)"/g, code)), live: new Set(names(/data-live="([\w-]+)"/g, code)) };
const def = { act: new Set([...names(/acts\['([\w-]+)'\]\s*=/g, code), ...names(/acts\.(\w+)\s*=/g, code)]), form: new Set([...names(/forms\['([\w-]+)'\]\s*=/g, code), ...names(/forms\.(\w+)\s*=/g, code)]), change: new Set([...names(/changes\['([\w-]+)'\]\s*=/g, code), ...names(/changes\.(\w+)\s*=/g, code)]), live: new Set([...names(/live\['([\w-]+)'\]\s*=/g, code), ...names(/live\.(\w+)\s*=/g, code)]) };
for (const k of Object.keys(used)) for (const n of used[k]) if (!def[k].has(n) && n !== 'modal-backdrop') fail(`giao diện dùng data-${k}="${n}" nhưng KHÔNG có hàm xử lý`);
for (const k of Object.keys(def)) for (const n of def[k]) if (!used[k].has(n) && !['modal-backdrop', 'modal-close'].includes(n)) console.log(`  ⚠ có hàm xử lý ${k}:"${n}" nhưng giao diện không dùng (mã thừa?)`);
// API client ↔ router
const router = read('lib/router.js'); const routes = new Set([...router.matchAll(/path === '([^']+)'/g)].map((m) => m[1]).concat([...router.matchAll(/seg\[0\] === '([^']+)'/g)].map((m) => m[1])));
const calls = [...code.matchAll(/(?:save|api)\('(GET|POST|PUT|DELETE)', [`']([^`'?$]+)/g)].map((m) => [m[1], m[2].replace(/\/$/, '')]);
for (const [m, p] of calls) { const first = p.split('/')[0]; if (![...routes].some((r) => r === p || r.split('/')[0] === first)) fail(`giao diện gọi ${m} /api/${p} nhưng router không có`); }
// router → handler tồn tại
const handlers = read('lib/handlers/index.js'); for (const m of router.matchAll(/H\.(\w+(?:\.\w+)?)\(/g)) { const parts = m[1].split('.'); if (!new RegExp(`\\b${parts[parts.length - 1]}\\b`).test(handlers)) fail(`router gọi H.${m[1]} nhưng handlers không có`); }
// khóa cấp 1 của handlers không được trùng (khóa sau sẽ ghi đè khóa trước và làm mất chức năng)
{ const keys = [...handlers.matchAll(/^  (\w+): (?:\{|async|\()/gm)].map((m) => m[1]); const dup = keys.filter((k, i) => keys.indexOf(k) !== i); if (dup.length) fail(`handlers có khóa trùng: ${[...new Set(dup)].join(', ')}`); }
// TODO/FIXME, console.log, debugger
for (const f of [...walk('lib'), ...client]) { const s = read(f); if (/TODO|FIXME|XXX|debugger/.test(s)) fail(`${f}: còn TODO/FIXME/debugger`); if (/console\.log\(/.test(s) && f.startsWith('public')) fail(`${f}: còn console.log`); }
// file tĩnh được tham chiếu có tồn tại
for (const m of read('public/index.html').matchAll(/(?:href|src)="(\/[^"]+)"/g)) if (!fs.existsSync('public' + m[1])) fail(`index.html tham chiếu ${m[1]} nhưng file không có`);
// biến môi trường được đọc trong mã nhưng chưa có trong .env.example / tài liệu
const env = new Set([...walk('lib').flatMap((f) => [...read(f).matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]))]); const doc = read('.env.example') + walk('docs').map(read).join('\n') + read('README.md');
for (const e of env) if (!doc.includes(e) && !['E2E_FAKE_BLOB', 'E2E_SEED'].includes(e)) fail(`biến môi trường ${e} dùng trong mã nhưng chưa được ghi trong tài liệu`);
console.log(bad ? `\nRà soát: ${bad} vấn đề` : '\nRà soát: không có vấn đề nghiêm trọng'); process.exit(bad ? 1 : 0);
