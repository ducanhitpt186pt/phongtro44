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
await t('đăng nhập; lần đầu tạo data/database.json với 7 phòng', async () => { const r = await call('POST', '/api/auth/login', { password: 'mat-khau-test' }, false); csrf = r.body.csrf; const d = await call('GET', '/api/data'); assert.equal(d.body.db.rooms.filter((r) => !r.kind).length, 7); });
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
  const pub = await call('GET', '/api/public/reminders', undefined, false); const s = JSON.stringify(pub.body); for (const x of ['0912345678', '001195000002', 'Lê Văn Phấn', '1995-03-02']) assert.ok(!s.includes(x)); assert.equal(typeof pub.body.system.storagePct, 'number'); assert.equal(pub.body.system.alerts.length, 0);
});
await t('sao lưu/khôi phục có xác nhận và tạo bản an toàn', async () => { const ex = await call('GET', '/api/backup/export'); assert.equal((await call('POST', '/api/backup/restore', { db: ex.body })).status, 400); const ok = await call('POST', '/api/backup/restore', { db: ex.body, confirm: 'GHI DE' }); assert.equal(ok.status, 200); assert.ok([...fakeStore.files.keys()].some((k) => k.startsWith('backups/truoc-khi-khoi-phuc'))); });
await t('đi qua rewrite /api/index?path=… vẫn đúng; /api/health tự kiểm tra, không lộ bí mật', async () => {
  const a = await call('GET', '/api/index?path=public/reminders', undefined, false); assert.equal(a.status, 200); assert.ok(a.body.items);
  const h = await call('GET', '/api/health', undefined, false); assert.equal(h.status, 200); assert.equal(h.body.kiemTraDocDuLieu, 'ok'); assert.equal(h.body.daDatMatKhau, true); const s = JSON.stringify(h.body); assert.ok(!s.includes('mat-khau-test') && !s.includes('xxxxxxxx'));
  const b = await call('POST', '/api/index?path=auth/login', { password: 'sai' }, false); assert.equal(b.status, 401);
});
await t('phiên đăng nhập 5 phút KHÔNG hoạt động: đang dùng thì tự gia hạn, bỏ không dùng 6 phút thì phải đăng nhập lại', async () => {
  const realNow = Date.now; let off = 0; Date.now = () => realNow() + off;
  try {
    const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'mat-khau-test' }) }); let ck = login.headers.get('set-cookie').split(';')[0];
    const use = async (min) => { off += min * 60000; const r = await fetch(base + '/api/data', { headers: { cookie: ck } }); const n = r.headers.get('set-cookie'); if (n) ck = n.split(';')[0]; return r.status; };
    assert.equal(await use(4), 200); assert.equal(await use(4), 200); assert.equal(await use(4), 200); // 12 phút tổng nhưng mỗi lần cách 4 phút => vẫn đăng nhập
    assert.equal(await use(6), 401); // bỏ không dùng 6 phút => hết phiên
    off = 0; const l2 = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'mat-khau-test' }) }); ck = l2.headers.get('set-cookie').split(';')[0];
    let st = 200; for (let i = 0; i < 200 && st === 200; i++) st = await use(4); assert.equal(st, 401, 'tối đa 12 giờ liên tục'); assert.ok(off >= 11.5 * 3600000 && off <= 12.2 * 3600000, 'hết hạn quanh mốc 12 giờ');
  } finally { Date.now = realNow; }
});
await t('đăng nhập sai 8 lần → KHÓA 10 phút (kể cả nhập đúng mật khẩu); hết 10 phút mới được nhập lại; sai ít hơn 8 lần không bị khóa', async () => {
  const realNow = Date.now; let off = 0; Date.now = () => realNow() + off; const H = { 'content-type': 'application/json', 'x-forwarded-for': '10.9.9.9' };
  const tryLogin = async (pw, ip = '10.9.9.9') => fetch(base + '/api/auth/login', { method: 'POST', headers: { ...H, 'x-forwarded-for': ip }, body: JSON.stringify({ password: pw }) });
  try {
    for (let i = 0; i < 7; i++) assert.equal((await tryLogin('sai')).status, 401); assert.equal((await tryLogin('mat-khau-test')).status, 200, '7 lần sai chưa bị khóa, nhập đúng vẫn vào được'); // đăng nhập đúng xóa bộ đếm
    for (let i = 0; i < 8; i++) assert.equal((await tryLogin('sai')).status, 401); const locked = await tryLogin('mat-khau-test'); assert.equal(locked.status, 429); assert.match((await locked.json()).error, /sai mật khẩu 8 lần.*10 phút/);
    assert.equal((await tryLogin('mat-khau-test', '10.8.8.8')).status, 200, 'IP khác không bị ảnh hưởng');
    off += 9 * 60000; assert.equal((await tryLogin('mat-khau-test')).status, 429, 'chưa đủ 10 phút'); off += 2 * 60000; assert.equal((await tryLogin('mat-khau-test')).status, 200, 'đủ 10 phút thì nhập lại được');
  } finally { Date.now = realNow; }
});
await t('thông tin nhận tiền (ngân hàng / STK / tên chủ TK): lưu, kiểm tra hợp lệ, xóa', async () => {
  const ok = await call('PUT', '/api/settings', { bank: { bankName: 'Vietcombank', accountNumber: '0123 456 789', accountName: 'nguyen van a' } }); assert.equal(ok.status, 200); assert.deepEqual(ok.body.settings.bank, { bankName: 'Vietcombank', accountNumber: '0123456789', accountName: 'NGUYEN VAN A' });
  assert.equal((await call('PUT', '/api/settings', { bank: { bankName: 'VCB', accountNumber: 'abc', accountName: 'A' } })).status, 400); assert.equal((await call('PUT', '/api/settings', { bank: { bankName: '', accountNumber: '123456', accountName: 'A' } })).status, 400);
  assert.equal((await call('GET', '/api/data')).body.settings.bank.accountNumber, '0123456789'); const del = await call('PUT', '/api/settings', { bank: { bankName: '', accountNumber: '', accountName: '' } }); assert.equal(del.body.settings.bank, null);
  assert.equal((await call('GET', '/api/public/reminders', undefined, false)).body && JSON.stringify((await call('GET', '/api/public/reminders', undefined, false)).body).includes('0123456789'), false, 'trang ngoài không hiện STK');
});
await t('xóa phòng: phòng chưa có lịch sử xóa được; phòng đã có khách/hóa đơn hoặc phòng Chủ Nhà thì KHÔNG; Zalo mặc định = SĐT; người ở cùng phải có địa chỉ', async () => {
  const mk = await call('POST', '/api/rooms', { name: 'Phòng xóa thử' }); assert.equal(mk.status, 200); const rid = mk.body.result.id; assert.equal((await call('DELETE', `/api/rooms/${rid}`)).status, 200); assert.ok(!(await call('GET', '/api/data')).body.db.rooms.some((r) => r.id === rid));
  const d = (await call('GET', '/api/data')).body.db; const busy = d.rooms.find((r) => d.rentals.some((x) => x.roomId === r.id)); const r1 = await call('DELETE', `/api/rooms/${busy.id}`); assert.equal(r1.status, 400); assert.equal(r1.body.code, 'HAS_HISTORY'); assert.equal((await call('DELETE', '/api/rooms/room-owner')).status, 400);
  const t0 = d.tenants[0]; assert.equal(t0.zalo, t0.phone, 'zalo mặc định = số điện thoại');
  const bad = await call('POST', '/api/occupants', { tenantId: t0.id, occupant: { fullName: 'A', dob: '1990-01-01', gender: 'male', cccd: '001090000777' } }); assert.equal(bad.status, 400); assert.match(bad.body.error, /địa chỉ/);
  const good = await call('POST', '/api/occupants', { tenantId: t0.id, occupant: { fullName: 'A', dob: '1990-01-01', gender: 'male', cccd: '001090000777', address: 'HN', zalo: '0988 111 222' } }); assert.equal(good.status, 200); assert.equal(good.body.result.zalo, '0988111222');
});
await t('đồng hồ tổng: sửa lần ghi (kiểm tra thứ tự với lần trước/sau), xóa lần mới nhất', async () => {
  const today = new Date(Date.now() + 7 * 3600e3); const dstr = (n) => new Date(today.getTime() - n * 86400000).toISOString().slice(0, 10);
  const a = await call('POST', '/api/master-readings', { date: dstr(30), elec: 1000, water: 100 }); assert.equal(a.status, 200); const b = await call('POST', '/api/master-readings', { date: dstr(10), elec: 1200, water: 120 }); assert.equal(b.status, 200);
  const ida = a.body.result.id, idb = b.body.result.id;
  assert.equal((await call('PUT', `/api/master-readings/${ida}`, { date: dstr(30), elec: 1300, water: 100 })).status, 400, 'lần đầu không được lớn hơn lần sau');
  const ok = await call('PUT', `/api/master-readings/${ida}`, { date: dstr(30), elec: 1100, water: 110, note: 'sửa' }); assert.equal(ok.status, 200); assert.equal(ok.body.db.masterReadings.find((x) => x.id === ida).elec, 1100); assert.ok(ok.body.db.masterReadings.find((x) => x.id === ida).history.length === 1);
  assert.equal((await call('PUT', `/api/master-readings/${idb}`, { date: dstr(10), elec: 1050, water: 120 })).status, 400, 'lần sau không được nhỏ hơn lần trước');
  assert.equal((await call('DELETE', `/api/master-readings/${idb}`)).status, 200);
});
await t('xóa hồ sơ khách cũ: đang thuê / còn nợ / chờ hoàn tiền thì KHÔNG xóa; đủ điều kiện thì xóa thông tin cá nhân, giữ số tiền', async () => {
  const d = (await call('GET', '/api/data')).body; const t0 = d.db.tenants[0]; const r0 = d.db.rentals.find((x) => x.tenantId === t0.id && x.status === 'active');
  const e1 = await call('DELETE', `/api/tenants/${t0.id}`); assert.equal(e1.status, 400); assert.match(e1.body.error, /đang thuê/);
  const base = d.derived.rentals[r0.id]; const co = await call('POST', '/api/checkout', { rentalId: r0.id, date: d.today, elecFinal: base.baseElec + 10, waterFinal: base.baseWater + 1, extras: [] }); assert.equal(co.status, 200, JSON.stringify(co.body));
  const inv = co.body.result.invoice; const rec = co.body.result.record;
  if (inv.total > 0) { assert.equal((await call('DELETE', `/api/tenants/${t0.id}`)).status, 400, 'còn nợ thì không xóa'); await call('POST', '/api/payments', { invoiceId: inv.id, amount: inv.total }); }
  else if (rec.refund?.status === 'pending') { assert.match((await call('DELETE', `/api/tenants/${t0.id}`)).body.error, /hoàn tiền/); await call('POST', `/api/checkout/${rec.id}/refunded`, { date: d.today }); }
  const ok = await call('DELETE', `/api/tenants/${t0.id}`); assert.equal(ok.status, 200, JSON.stringify(ok.body)); const after = ok.body.db.tenants.find((x) => x.id === t0.id); assert.equal(after.fullName, '(Đã xóa hồ sơ)'); assert.equal(after.cccd, ''); assert.equal(after.phone, ''); assert.ok(ok.body.db.invoices.filter((i) => i.tenantId === t0.id).every((i) => i.tenantName === '(Đã xóa hồ sơ)') && ok.body.db.invoices.some((i) => i.tenantId === t0.id), 'hóa đơn/số tiền vẫn còn');
});
await t('đồng hồ tổng: ghi ngày nào cũng được (kể cả cùng ngày); chỉ bắt buộc số mới KHÔNG nhỏ hơn số cũ đã lưu', async () => {
  const d0 = (await call('GET', '/api/data')).body.db.masterReadings; const last = d0.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt).localeCompare(String(b.createdAt))).pop(); const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const same = await call('POST', '/api/master-readings', { date: last.date, elec: last.elec + 10, water: last.water + 1 }); assert.equal(same.status, 200, 'cùng ngày với lần trước vẫn nhận: ' + JSON.stringify(same.body));
  const low = await call('POST', '/api/master-readings', { date: today, elec: last.elec + 5, water: last.water + 1 }); assert.equal(low.status, 400); assert.match(low.body.error, /nhỏ hơn số cũ đã lưu/);
  const eq = await call('POST', '/api/master-readings', { date: today, elec: last.elec + 10, water: last.water + 1 }); assert.equal(eq.status, 200, 'bằng số cũ vẫn được (đồng hồ chưa nhích)');
});
server.close(); console.log(`\nTích hợp Blob: ${pass} đạt`); process.exit(process.exitCode || 0);
