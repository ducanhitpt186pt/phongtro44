// Kiểm thử tích hợp với GitHub GIẢ LẬP (không cần mạng): đăng nhập, quyền truy cập, xung đột SHA, API công khai.
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
process.env.APP_PASSWORD = 'mat-khau-test'; process.env.SESSION_SECRET = 'x'.repeat(40);
process.env.GITHUB_TOKEN = 'tok'; process.env.GITHUB_OWNER = 'o'; process.env.GITHUB_REPO = 'r';

const files = new Map(); let injectConflictOnce = null; let puts = 0, failNext = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, opts = {}) => {
  if (!String(u).startsWith('https://api.github.com')) return realFetch(u, opts);
  const path = decodeURIComponent(new URL(u).pathname.split('/contents/')[1] || '');
  const sha = (s) => crypto.createHash('sha1').update(s).digest('hex');
  const R = (status, body) => new Response(JSON.stringify(body ?? {}), { status, headers: { 'content-type': 'application/json' } });
  if (!opts.method || opts.method === 'GET') { const f = files.get(path); return f ? R(200, { sha: f.sha, content: Buffer.from(f.text).toString('base64'), encoding: 'base64' }) : R(404, {}); }
  puts++;
  if (failNext > 0) { failNext--; return R(500, {}); }
  if (injectConflictOnce && path === 'database.json') { const fn = injectConflictOnce; injectConflictOnce = null; fn(); }
  const b = JSON.parse(opts.body); const f = files.get(path);
  if ((f && f.sha !== b.sha) || (!f && b.sha)) return R(409, { message: 'does not match' });
  const text = Buffer.from(b.content, 'base64').toString('utf8'); const ns = sha(text + Math.random());
  files.set(path, { text, sha: ns }); return R(200, { content: { sha: ns } });
};
const { entry } = await import('../lib/router.js');
const server = http.createServer(entry); await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
let cookie = '', csrf = '';
const call = async (method, path, body, auth = true) => {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(auth && cookie ? { cookie } : {}), ...(auth && csrf ? { 'x-csrf-token': csrf } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.get('set-cookie'); if (sc && path.includes('login')) cookie = sc.split(';')[0];
  const t = await res.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: res.status, body: j };
};
let pass = 0; const t = async (n, fn) => { try { await fn(); pass++; console.log('  ✓', n); } catch (e) { console.log('  ✗', n, '\n   ', e.message); process.exitCode = 1; } };
const person = { fullName: 'Trần Thị B', dob: '1995-03-02', gender: 'female', phone: '0912345678', cccd: '001195000002', cccdIssueDate: '2022-01-05', cccdIssuePlace: 'Cục CS QLHC', address: '44 Lê Văn Phấn, Hà Nội' };

await t('API riêng tư từ chối khi chưa đăng nhập (data, tenants, backup, ảnh)', async () => {
  for (const [m, p] of [['GET', '/api/data'], ['GET', '/api/tenants'], ['GET', '/api/backup/export'], ['GET', '/api/storage/abc'], ['POST', '/api/payments'], ['PUT', '/api/rooms/room-1']]) assert.equal((await call(m, p, m === 'GET' ? undefined : {}, false)).status, 401, p);
});
await t('sai mật khẩu bị từ chối, không cấp phiên', async () => { const r = await call('POST', '/api/auth/login', { password: 'sai' }, false); assert.equal(r.status, 401); assert.match(r.body.error, /không chính xác/); });
await t('đúng mật khẩu → có phiên; thiếu CSRF bị chặn khi ghi', async () => {
  const r = await call('POST', '/api/auth/login', { password: 'mat-khau-test' }, false); assert.equal(r.status, 200); csrf = r.body.csrf;
  const bad = await fetch(base + '/api/rooms', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{"name":"X"}' }); assert.equal(bad.status, 403);
});
await t('lần đầu: tạo database.json với 7 phòng', async () => { const r = await call('GET', '/api/data'); assert.equal(r.body.db.rooms.filter((r) => !r.kind).length, 7); });
await t('thêm khách + hóa đơn kỳ đầu được GHI vào "GitHub"', async () => {
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const r = await call('POST', '/api/tenants', { roomId: 'room-1', startDate: today, rent: 1200000, elecPrice: 3500, waterPrice: 15000, initElec: 100, initWater: 10, tenant: person, occupants: [{ fullName: 'Con', dob: '2015-01-01', gender: 'male', noId: true }] });
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(JSON.parse(files.get('database.json').text).invoices.length, 1);
});
await t('XUNG ĐỘT SHA: có ghi chen ngang → hệ thống đọc lại, áp dụng lại, KHÔNG mất dữ liệu bên kia', async () => {
  injectConflictOnce = () => { const f = files.get('database.json'); const d = JSON.parse(f.text); d.rooms.push({ id: 'room-x', name: 'Phòng chen ngang', status: 'empty', note: '', createdAt: 'x' }); f.text = JSON.stringify(d); f.sha = 'changed-elsewhere'; };
  const before = puts; const r = await call('POST', '/api/rooms', { name: 'Phòng 8' }); assert.equal(r.status, 200, JSON.stringify(r.body));
  const names = JSON.parse(files.get('database.json').text).rooms.map((x) => x.name);
  assert.ok(names.includes('Phòng 8') && names.includes('Phòng chen ngang')); assert.ok(puts - before >= 2);
});
await t('GitHub lỗi 500 khi ghi → báo THẤT BẠI, không báo thành công', async () => { failNext = 5; const r = await call('POST', '/api/rooms', { name: 'Phòng 9' }); assert.equal(r.status, 502); assert.equal(r.body.ok, false); assert.ok(!JSON.parse(files.get('database.json').text).rooms.some((x) => x.name === 'Phòng 9')); failNext = 0; });
await t('lỗi nghiệp vụ trả 400 với thông báo tiếng Việt', async () => { const r = await call('POST', '/api/payments', { invoiceId: (await call('GET', '/api/data')).body.db.invoices[0].id, amount: 99999999 }); assert.equal(r.status, 400); assert.match(r.body.error, /vượt quá/); });
await t('thanh toán 1 phần ở kỳ đầu: API công khai chưa báo nợ (chưa ghi điện nước) và KHÔNG lộ thông tin khách', async () => {
  const inv = (await call('GET', '/api/data')).body.db.invoices[0];
  assert.equal((await call('POST', '/api/payments', { invoiceId: inv.id, amount: 500000 })).status, 200);
  const pub = await call('GET', '/api/public/reminders', undefined, false);
  assert.equal(pub.status, 200); const s = JSON.stringify(pub.body);
  for (const x of ['0912345678', '001195000002', 'Lê Văn Phấn', '1995-03-02', 'Con']) assert.ok(!s.includes(x), 'Lộ ' + x);
  assert.ok(!pub.body.items.some((i) => i.roomName === 'Phòng 1' && ['partial', 'unpaid', 'overdue'].includes(i.type)), 'kỳ đầu chưa ghi điện nước: chưa tính là nợ, chưa có thông báo nợ');
  assert.equal(pub.body.summary.totalRemaining, 0);
});
await t('sao lưu: xuất JSON; khôi phục cần xác nhận + tạo bản an toàn', async () => {
  const ex = await call('GET', '/api/backup/export'); assert.equal(ex.body.schemaVersion, 1);
  assert.equal((await call('POST', '/api/backup/restore', { db: ex.body })).status, 400);
  assert.equal((await call('POST', '/api/backup/restore', { db: { schemaVersion: 1 }, confirm: 'GHI DE' })).status, 422);
  const ok = await call('POST', '/api/backup/restore', { db: ex.body, confirm: 'GHI DE' }); assert.equal(ok.status, 200); assert.ok([...files.keys()].some((k) => k.startsWith('backups/truoc-khi-khoi-phuc')));
});
await t('đăng xuất xóa cookie phiên', async () => { const res = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { cookie } }); assert.equal(res.status, 200); assert.match(res.headers.get('set-cookie'), /Max-Age=0/); });
server.close(); console.log(`\nTích hợp: ${pass} đạt`); process.exit(process.exitCode || 0);
