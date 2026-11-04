// Tích hợp với Upstash Redis GIẢ LẬP (mô phỏng REST + EVAL so-sánh-rồi-ghi): xung đột, song song, lỗi, giới hạn, sao lưu.
import assert from 'node:assert/strict'; import http from 'node:http'; import zlib from 'node:zlib';
process.env.APP_PASSWORD = 'mat-khau-test'; process.env.SESSION_SECRET = 'x'.repeat(40); process.env.E2E_FAKE_BLOB = '1';
process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash.example'; process.env.UPSTASH_REDIS_REST_TOKEN = 'tok'; delete process.env.GITHUB_TOKEN;
const kv = new Map(); const ttl = new Map(); let beforeEval = null, failEval = 0, status = 200, cmds = 0; const realFetch = fetch;
globalThis.fetch = async (u, o = {}) => {
  if (!String(u).startsWith('https://fake-upstash.example')) return realFetch(u, o);
  const R = (st, b) => new Response(JSON.stringify(b), { status: st });
  if (status !== 200) return R(status, { error: 'blocked' });
  if (o.headers.Authorization !== 'Bearer tok') return R(401, { error: 'unauthorized' });
  const a = JSON.parse(o.body); cmds++;
  if (a[0] === 'EVAL') {
    const [, script, , k1, k2, k3, ...argv] = a; const bump = (n) => { const c = Number(kv.get(k3) || 0) + n; kv.set(k3, String(c)); return c; };
    if (script.includes("return {redis.call('GET'")) { const c = bump(3); return R(200, { result: [kv.get(k1) ?? null, kv.get(k2) ?? null, c] }); }
    if (failEval > 0) { failEval--; return R(500, { error: 'boom' }); }
    if (beforeEval) { const f = beforeEval; beforeEval = null; f(); }
    const c = bump(4); const cur = kv.get(k1); if ((cur === undefined && argv[0] === '') || cur === argv[0]) { kv.set(k2, argv[1]); kv.set(k1, argv[2]); return R(200, { result: [1, c] }); } return R(200, { result: [0, c] });
  }
  if (a[0] === 'SET') { if (a.includes('NX') && kv.has(a[1])) return R(200, { result: null }); kv.set(a[1], a[2]); if (a.includes('EX')) ttl.set(a[1], a[a.indexOf('EX') + 1]); return R(200, { result: 'OK' }); }
  return R(200, { error: 'ERR unknown' });
};
const { entry } = await import('../lib/router.js'); const { driverName } = await import('../lib/store.js');
const server = http.createServer(entry); await new Promise((r) => server.listen(0, r)); const base = `http://127.0.0.1:${server.address().port}`;
let cookie = '', csrf = '';
const call = async (m, p, body, auth = true) => { const res = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...(auth && cookie ? { cookie } : {}), ...(auth && csrf ? { 'x-csrf-token': csrf } : {}) }, body: body ? JSON.stringify(body) : undefined }); const sc = res.headers.get('set-cookie'); if (sc && p.includes('login')) cookie = sc.split(';')[0]; const t = await res.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: res.status, body: j }; };
const dbObj = () => JSON.parse(zlib.gunzipSync(Buffer.from(kv.get('nt44:db').slice(3), 'base64')).toString());
let pass = 0; const t = async (n, f) => { try { await f(); pass++; console.log('  ✓', n); } catch (e) { console.log('  ✗', n, '\n   ', e.message); process.exitCode = 1; } };
await t('tự chọn Upstash Redis khi có biến môi trường; không cần GitHub token', () => assert.equal(driverName(), 'redis'));
await t('chưa đăng nhập: 401', async () => assert.equal((await call('GET', '/api/data', undefined, false)).status, 401));
await t('lần đầu tạo dữ liệu 7 phòng; dữ liệu được nén gzip', async () => { csrf = (await call('POST', '/api/auth/login', { password: 'mat-khau-test' }, false)).body.csrf; assert.equal((await call('GET', '/api/data')).body.db.rooms.length, 7); assert.equal((await call('POST', '/api/rooms', { name: 'Phòng 8' })).status, 200); assert.ok(kv.get('nt44:db').startsWith('gz:')); assert.ok(dbObj().rooms.some((r) => r.name === 'Phòng 8')); });
await t('tự sao lưu tháng (có hạn 2 năm) vào Redis', async () => { const k = [...kv.keys()].find((x) => /^nt44:x:backups\/\d{4}-\d{2}\.json$/.test(x)); assert.ok(k); assert.equal(ttl.get(k), 63115200); });
await t('XUNG ĐỘT: ghi chen ngang → đọc lại + áp dụng lại, không mất dữ liệu', async () => {
  beforeEval = () => { const d = dbObj(); d.rooms.push({ id: 'room-x', name: 'Chen ngang', status: 'empty', note: '', createdAt: 'x' }); kv.set('nt44:db', 'gz:' + zlib.gzipSync(Buffer.from(JSON.stringify(d))).toString('base64')); kv.set('nt44:ver', 'changed'); };
  assert.equal((await call('POST', '/api/rooms', { name: 'Phòng 9' })).status, 200); const n = dbObj().rooms.map((r) => r.name); assert.ok(n.includes('Phòng 9') && n.includes('Chen ngang'));
});
await t('hai ghi song song đều được lưu', async () => { const [a, b] = await Promise.all([call('POST', '/api/rooms', { name: 'SS-A' }), call('POST', '/api/rooms', { name: 'SS-B' })]); assert.equal(a.status, 200); assert.equal(b.status, 200); const n = dbObj().rooms.map((r) => r.name); assert.ok(n.includes('SS-A') && n.includes('SS-B')); });
await t('Upstash lỗi 500 → báo THẤT BẠI, không báo thành công, không ghi dở', async () => { failEval = 9; const r = await call('POST', '/api/rooms', { name: 'Phòng 10' }); failEval = 0; assert.equal(r.status, 502); assert.equal(r.body.ok, false); assert.ok(!dbObj().rooms.some((x) => x.name === 'Phòng 10')); });
await t('chạm hạn mức gói miễn phí → báo rõ, không lưu', async () => { status = 429; const r = await call('POST', '/api/rooms', { name: 'Phòng 11' }); status = 200; assert.equal(r.body.code, 'REDIS_LIMIT'); assert.match(r.body.error, /hạn mức/); });
await t('API công khai: không lộ thông tin khách, có % lưu trữ, không cảnh báo khi bình thường', async () => {
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const r = await call('POST', '/api/tenants', { roomId: 'room-1', startDate: today, rent: 1200000, elecPrice: 3500, waterPrice: 15000, initElec: 1, initWater: 1, tenant: { fullName: 'Trần Thị B', dob: '1995-03-02', gender: 'female', phone: '0912345678', cccd: '001195000002', cccdIssueDate: '2022-01-05', cccdIssuePlace: 'Cục CS', address: '44 Lê Văn Phấn' } }); assert.equal(r.status, 200, JSON.stringify(r.body));
  const pub = await call('GET', '/api/public/reminders', undefined, false); const s = JSON.stringify(pub.body); for (const x of ['Trần Thị B', '0912345678', '001195000002', 'Lê Văn Phấn']) assert.ok(!s.includes(x)); assert.equal(pub.body.system.alerts.length, 0);
});
await t('mỗi lần ĐỌC tốn 1 lệnh, mỗi lần GHI tốn ~2 lệnh (tiết kiệm hạn mức 500.000 lệnh/tháng)', async () => { cmds = 0; await call('GET', '/api/data'); assert.equal(cmds, 1); cmds = 0; await call('POST', '/api/rooms', { name: 'Đếm lệnh' }); assert.ok(cmds <= 3, 'tốn ' + cmds); });
await t('hiển thị hạn mức Upstash: số lệnh/% và dung lượng dữ liệu; cảnh báo khi gần đầy', async () => {
  const pub = await call('GET', '/api/public/reminders', undefined, false); const u = pub.body.system.upstash; assert.ok(u && u.commands > 0 && u.commandLimit === 500000 && typeof u.commandPct === 'number' && u.dbKb > 0 && u.dbLimitMb === 256);
  const k = [...kv.keys()].find((x) => x.startsWith('nt44:cmd:')); kv.set(k, '480000'); await call('GET', '/api/data'); const p2 = await call('GET', '/api/index?path=public/reminders', undefined, false); await new Promise((r) => setTimeout(r, 0));
  const d = await call('GET', '/api/data'); assert.ok(d.body.system.alerts.some((x) => x.level === 'red' && /Upstash/.test(x.text)), 'phải cảnh báo đỏ khi ≥95%');
});
await t('sao lưu/khôi phục + bản an toàn', async () => { const ex = await call('GET', '/api/backup/export'); const ok = await call('POST', '/api/backup/restore', { db: ex.body, confirm: 'GHI DE' }); assert.equal(ok.status, 200); assert.ok([...kv.keys()].some((k) => k.startsWith('nt44:x:backups/truoc-khi-khoi-phuc'))); });
server.close(); console.log(`\nTích hợp Redis: ${pass} đạt`); process.exit(process.exitCode || 0);
