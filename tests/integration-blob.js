// Tích hợp với Vercel Blob GIẢ LẬP (mô phỏng ETag/ifMatch): xung đột, lỗi ghi, sao lưu, khôi phục, API công khai.
import assert from 'node:assert/strict'; import http from 'node:http';
process.env.APP_PASSWORD = 'mat-khau-test'; process.env.SESSION_SECRET = 'x'.repeat(40); process.env.E2E_FAKE_BLOB = '1'; delete process.env.GITHUB_TOKEN;
const { fakeStore } = await import('../lib/blob.js'); const { entry } = await import('../lib/router.js'); const { driverName } = await import('../lib/store.js');
const server = http.createServer(entry); await new Promise((r) => server.listen(0, r)); const base = `http://127.0.0.1:${server.address().port}`;
let cookie = '', csrf = '';
const call = async (m, p, body, auth = true) => { const res = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...(auth && cookie ? { cookie } : {}), ...(auth && csrf ? { 'x-csrf-token': csrf } : {}) }, body: body ? JSON.stringify(body) : undefined }); const sc = res.headers.get('set-cookie'); if (sc && p.includes('login')) cookie = sc.split(';')[0]; const t = await res.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: res.status, body: j }; };
const dbText = () => Buffer.from(fakeStore.files.get('data/database.json').buf).toString();
let pass = 0; const t = async (n, f) => { try { await f(); pass++; console.log('  ✓', n); } catch (e) { console.log('  ✗', n, '\n   ', e.message); process.exitCode = 1; } };
await t('dùng nơi lưu Vercel Blob, KHÔNG cần GitHub token', () => assert.equal(driverName(), 'blob'));
await t('chưa đăng nhập: API riêng tư bị 401', async () => assert.equal((await call('GET', '/api/data', undefined, false)).status, 401));
await t('đăng nhập; lần đầu tạo data/database.json với 7 phòng', async () => { const r = await call('POST', '/api/auth/login', { password: 'mat-khau-test' }, false); csrf = r.body.csrf; const d = await call('GET', '/api/data'); assert.equal(d.body.db.rooms.length, 7); });
await t('ghi dữ liệu thật vào Blob + tự sao lưu tháng', async () => { assert.equal((await call('POST', '/api/rooms', { name: 'Phòng 8' })).status, 200); assert.ok(JSON.parse(dbText()).rooms.some((r) => r.name === 'Phòng 8')); assert.ok([...fakeStore.files.keys()].some((k) => /^backups\/\d{4}-\d{2}\.json$/.test(k))); });
await t('XUNG ĐỘT ETag: ghi chen ngang → đọc lại, áp dụng lại, không mất dữ liệu', async () => {
  fakeStore.beforePut = () => { const f = fakeStore.files.get('data/database.json'); const d = JSON.parse(f.buf.toString()); d.rooms.push({ id: 'room-x', name: 'Chen ngang', status: 'empty', note: '', createdAt: 'x' }); f.buf = Buffer.from(JSON.stringify(d)); f.etag = '"changed"'; };
  const r = await call('POST', '/api/rooms', { name: 'Phòng 9' }); assert.equal(r.status, 200, JSON.stringify(r.body)); const names = JSON.parse(dbText()).rooms.map((x) => x.name); assert.ok(names.includes('Phòng 9') && names.includes('Chen ngang'));
});
await t('Blob lỗi khi ghi → báo THẤT BẠI (mã BLOB), không lưu dở', async () => { fakeStore.failPuts = 9; const r = await call('POST', '/api/rooms', { name: 'Phòng 10' }); fakeStore.failPuts = 0; assert.equal(r.status, 502); assert.equal(r.body.code, 'BLOB'); assert.ok(!JSON.parse(dbText()).rooms.some((x) => x.name === 'Phòng 10')); });
await t('hai yêu cầu ghi song song đều được lưu (không mất cái nào)', async () => { const [a, b] = await Promise.all([call('POST', '/api/rooms', { name: 'Song song A' }), call('POST', '/api/rooms', { name: 'Song song B' })]); assert.equal(a.status, 200); assert.equal(b.status, 200); const n = JSON.parse(dbText()).rooms.map((x) => x.name); assert.ok(n.includes('Song song A') && n.includes('Song song B')); });
await t('API công khai không lộ thông tin khách; có dòng trạng thái lưu trữ', async () => {
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const r = await call('POST', '/api/tenants', { roomId: 'room-1', startDate: today, rent: 1200000, elecPrice: 3500, waterPrice: 15000, initElec: 1, initWater: 1, tenant: { fullName: 'Trần Thị B', dob: '1995-03-02', gender: 'female', phone: '0912345678', cccd: '001195000002', cccdIssueDate: '2022-01-05', cccdIssuePlace: 'Cục CS', address: '44 Lê Văn Phấn' } }); assert.equal(r.status, 200, JSON.stringify(r.body));
  const pub = await call('GET', '/api/public/reminders', undefined, false); const s = JSON.stringify(pub.body); for (const x of ['Trần Thị B', '0912345678', '001195000002', 'Lê Văn Phấn']) assert.ok(!s.includes(x)); assert.equal(typeof pub.body.system.storagePct, 'number'); assert.equal(pub.body.system.alerts.length, 0);
});
await t('sao lưu/khôi phục có xác nhận và tạo bản an toàn', async () => { const ex = await call('GET', '/api/backup/export'); assert.equal((await call('POST', '/api/backup/restore', { db: ex.body })).status, 400); const ok = await call('POST', '/api/backup/restore', { db: ex.body, confirm: 'GHI DE' }); assert.equal(ok.status, 200); assert.ok([...fakeStore.files.keys()].some((k) => k.startsWith('backups/truoc-khi-khoi-phuc'))); });
server.close(); console.log(`\nTích hợp Blob: ${pass} đạt`); process.exit(process.exitCode || 0);
