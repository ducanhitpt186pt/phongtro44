// Google Sheet (mô phỏng Apps Script: kiểm tra mã bí mật, CHỈ thêm dòng) + sự kiện + công tắc hiển thị.
import assert from 'node:assert/strict'; import http from 'node:http'; import zlib from 'node:zlib';
process.env.APP_PASSWORD = 'mat-khau-test'; process.env.SESSION_SECRET = 'x'.repeat(40); process.env.E2E_FAKE_BLOB = '1'; process.env.SHEETS_SYNC = '1'; delete process.env.GITHUB_TOKEN;
const sheet = { tabs: {}, actions: [], down: false }; // tabs[name] = [dòng...]
const hook = http.createServer((q, s) => { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => {
  if (sheet.down) { s.statusCode = 500; return s.end('boom'); }
  const d = JSON.parse(b); sheet.actions.push(d.action); const R = (o) => s.end(JSON.stringify(o));
  if (d.secret !== 'bi-mat-123') return R({ ok: false, error: 'Sai mã bí mật: SECRET trong Apps Script khác GOOGLE_SHEET_SECRET trên Vercel' });
  if (d.action === 'ping') return R({ ok: true, sheet: 'Nhà trọ 44 – sao lưu', url: 'https://docs.google.com/x', tabs: Object.entries(sheet.tabs).map(([k, v]) => [k, v.length]) });
  if (d.action === 'append') { let n = 0; for (const [k, rows] of Object.entries(d.rows)) { const t = (sheet.tabs[k] ||= []); for (const r of rows) { t.push(r.map((v) => (typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v))); n++; } } return R({ ok: true, appended: n }); }
  R({ ok: false, error: 'Hành động không hợp lệ' }); }); });
await new Promise((r) => hook.listen(0, r)); const hookUrl = `http://127.0.0.1:${hook.address().port}/exec`;
const { entry } = await import('../lib/router.js'); const server = http.createServer(entry); await new Promise((r) => server.listen(0, r)); const base = `http://127.0.0.1:${server.address().port}`;
let cookie = '', csrf = '';
const call = async (m, p, body, auth = true) => { const res = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...(auth && cookie ? { cookie } : {}), ...(auth && csrf ? { 'x-csrf-token': csrf } : {}) }, body: body ? JSON.stringify(body) : undefined }); const sc = res.headers.get('set-cookie'); if (sc && p.includes('login')) cookie = sc.split(';')[0]; const t = await res.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: res.status, body: j }; };
let pass = 0; const t = async (n, f) => { try { await f(); pass++; console.log('  ✓', n); } catch (e) { console.log('  ✗', n, '\n   ', e.message); process.exitCode = 1; } };
const login = async () => { const r = await call('POST', '/api/auth/login', { password: 'mat-khau-test' }, false); csrf = r.body.csrf; };
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const tenant = { fullName: 'Trần Thị B', dob: '1995-03-02', gender: 'female', phone: '0912345678', cccd: '001195000002', cccdIssueDate: '2022-01-05', cccdIssuePlace: 'Cục CS', address: '44 Lê Văn Phấn' };
await login();
await t('chưa cấu hình Google Sheet: vẫn lưu bình thường, không gọi ra ngoài', async () => { assert.equal((await call('POST', '/api/rooms', { name: 'Phòng 8' })).status, 200); assert.equal(sheet.actions.length, 0); assert.equal((await call('POST', '/api/sheets/ping', {})).status, 400); });
process.env.GOOGLE_SHEET_WEBHOOK_URL = hookUrl; process.env.GOOGLE_SHEET_SECRET = 'bi-mat-123';
await t('kiểm tra kết nối: ping trả tên Sheet; gửi dòng thử được ghi vào NhatKy', async () => { const p = await call('POST', '/api/sheets/ping', {}); assert.equal(p.status, 200); assert.equal(p.body.sheet, 'Nhà trọ 44 – sao lưu'); const r = await call('POST', '/api/sheets/test', {}); assert.equal(r.status, 200); assert.ok(sheet.tabs.NhatKy.some((x) => x[1] === 'Kiểm tra kết nối')); });
await t('kiểm tra tất cả kết nối: DB + kho ảnh + Sheet đều ✅ và có 1 câu tổng kết; Sheet lỗi thì báo ❌', async () => { const ok = await call('POST', '/api/system/check', {}); assert.equal(ok.status, 200); assert.equal(ok.body.allOk, true, JSON.stringify(ok.body)); assert.equal(ok.body.items.length, 3); assert.match(ok.body.summary, /thành công/); sheet.down = true; const bad = await call('POST', '/api/system/check', {}); sheet.down = false; assert.equal(bad.body.allOk, false); assert.match(bad.body.summary, /Google Sheet/); assert.equal((await call('POST', '/api/system/check', {}, false)).status, 401); });
await t('thêm khách: dòng được THÊM vào HoaDon, Khach, LuotThue, NhatKy và có bản sao lưu đầy đủ trong ngày', async () => {
  const r = await call('POST', '/api/tenants', { roomId: 'room-1', startDate: today, rent: 1200000, elecPrice: 3500, waterPrice: 15000, initElec: 1, initWater: 1, tenant, occupants: [{ fullName: 'Con', dob: '2016-01-01', gender: 'male', noId: true }] }); assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(sheet.tabs.HoaDon.length, 1); assert.equal(sheet.tabs.HoaDon[0][22], 1200000); assert.equal(sheet.tabs.Khach[0][6], '001195000002'); assert.equal(sheet.tabs.LuotThue[0][5], 'Đang thuê'); assert.ok(sheet.tabs.NguoiOCung.length === 1); assert.ok(sheet.tabs.NhatKy.some((x) => x[1] === 'Thêm khách thuê'));
  const parts = sheet.tabs.SaoLuuDayDu; assert.ok(parts.length >= 1); const packed = parts.map((x) => x[4]).join(''); const db = JSON.parse(zlib.gunzipSync(Buffer.from(packed.slice(3), 'base64')).toString()); assert.equal(db.tenants[0].cccd, '001195000002'); assert.equal(db.invoices.length, 1);
});
await t('chỉ 1 bản sao lưu đầy đủ mỗi ngày (lần lưu thứ hai trong ngày không gửi thêm bản đầy đủ)', async () => { const n = sheet.tabs.SaoLuuDayDu.length; await call('POST', '/api/rooms', { name: 'Phòng 9' }); assert.equal(sheet.tabs.SaoLuuDayDu.length, n); });
await t('thanh toán → dòng ThanhToan; hủy giao dịch → THÊM dòng "Đã hủy" (dòng cũ vẫn còn)', async () => {
  const d = (await call('GET', '/api/data')).body.db; const inv = d.invoices[0]; const p = await call('POST', '/api/payments', { invoiceId: inv.id, amount: 500000, note: '=HYPERLINK("x")' }); assert.equal(p.status, 200);
  assert.equal(sheet.tabs.ThanhToan.length, 1); assert.equal(sheet.tabs.ThanhToan[0][6], 'Hợp lệ'); assert.equal(sheet.tabs.ThanhToan[0][5], "'=HYPERLINK(\"x\")"); // chặn công thức độc hại
  await call('POST', `/api/payments/${p.body.result.id}/void`, { reason: 'nhập nhầm' }); assert.equal(sheet.tabs.ThanhToan.length, 2); assert.equal(sheet.tabs.ThanhToan[0][6], 'Hợp lệ'); assert.equal(sheet.tabs.ThanhToan[1][6], 'Đã hủy');
});
await t('sự kiện: thêm / sửa / xóa đều THÊM dòng vào SuKien (lịch sử không bị xóa)', async () => {
  const c = await call('POST', '/api/events', { name: 'Giỗ ông nội', calendar: 'lunar', day: 15, month: 7, repeat: true, note: 'riêng tư', color: '#ff3b30' }); assert.equal(c.status, 200, JSON.stringify(c.body)); const id = c.body.result.id;
  await call('PUT', `/api/events/${id}`, { name: 'Giỗ ông nội (sửa)', calendar: 'lunar', day: 16, month: 7, repeat: true }); await call('DELETE', `/api/events/${id}`);
  assert.deepEqual(sheet.tabs.SuKien.map((x) => x[1]), ['Thêm', 'Sửa', 'Xóa']); assert.equal((await call('GET', '/api/data')).body.db.events.length, 0);
});
await t('kiểm tra dữ liệu sự kiện: thiếu tên, ngày sai, 1 lần mà thiếu năm, lịch sai', async () => {
  for (const b of [{ calendar: 'solar', day: 1, month: 1 }, { name: 'a', calendar: 'solar', day: 31, month: 2, year: 2026, repeat: false }, { name: 'a', calendar: 'solar', day: 1, month: 1, repeat: false }, { name: 'a', calendar: 'xx', day: 1, month: 1 }, { name: 'a', calendar: 'lunar', day: 31, month: 1 }]) assert.equal((await call('POST', '/api/events', b)).status, 400, JSON.stringify(b));
});
await t('trang ngoài: sự kiện hiện tên + ngày (KHÔNG có ghi chú); tắt công tắc thì ẩn', async () => {
  await call('POST', '/api/events', { name: 'Họp tổ dân phố', calendar: 'solar', day: 20, month: 11, repeat: true, note: 'BÍ MẬT' });
  let pub = await call('GET', '/api/public/reminders', undefined, false); const s = JSON.stringify(pub.body); assert.ok(pub.body.events.some((e) => e.name === 'Họp tổ dân phố') && !s.includes('BÍ MẬT'));
  await call('PUT', '/api/settings', { publicShowEvents: false }); pub = await call('GET', '/api/public/reminders', undefined, false); assert.equal(pub.body.events.length, 0); await call('PUT', '/api/settings', { publicShowEvents: true });
});
await t('không gửi thông tin cá nhân khi tắt công tắc (cả dòng chi tiết lẫn bản sao lưu đầy đủ)', async () => {
  await call('PUT', '/api/settings', { sheetIncludePersonal: false }); const k0 = sheet.tabs.Khach.length;
  await call('PUT', `/api/tenants/${(await call('GET', '/api/data')).body.db.tenants[0].id}`, { tenant: { ...tenant, fullName: 'Trần Thị B (sửa)' } });
  const last = sheet.tabs.Khach[sheet.tabs.Khach.length - 1]; assert.ok(sheet.tabs.Khach.length > k0); assert.equal(last[2], 'Trần Thị B (sửa)'); assert.equal(last[6], ''); assert.equal(last[5], ''); assert.equal(last[9], '');
  const r = await call('POST', '/api/sheets/snapshot', {}); assert.equal(r.status, 200); const tot = sheet.tabs.SaoLuuDayDu.slice(-1)[0][3]; const packed = sheet.tabs.SaoLuuDayDu.slice(-1)[0][4]; const parts = sheet.tabs.SaoLuuDayDu.slice(-tot).map((x) => x[4]).join(''); const db = JSON.parse(zlib.gunzipSync(Buffer.from(parts.slice(3), 'base64')).toString()); assert.equal(db.tenants[0].cccd, ''); assert.ok(packed.length > 0);
  await call('PUT', '/api/settings', { sheetIncludePersonal: true });
});
await t('Google Sheet hỏng/sai mã bí mật: việc LƯU DỮ LIỆU CHÍNH vẫn thành công, trạng thái báo lỗi rõ', async () => {
  sheet.down = true; assert.equal((await call('POST', '/api/rooms', { name: 'Phòng 10' })).status, 200); sheet.down = false;
  const st = (await call('GET', '/api/data')).body.sheets; assert.ok(st.lastError && /Google/.test(st.lastError), st.lastError);
  process.env.GOOGLE_SHEET_SECRET = 'sai'; assert.equal((await call('POST', '/api/rooms', { name: 'Phòng 11' })).status, 200); const e = await call('POST', '/api/sheets/ping', {}); assert.equal(e.status, 502); assert.match(e.body.error, /Sai mã bí mật/); process.env.GOOGLE_SHEET_SECRET = 'bi-mat-123';
});
await t('"Gửi toàn bộ chi tiết" thêm đủ dòng; Apps Script chỉ nhận ping/append – KHÔNG có lệnh xóa', async () => { const n = sheet.tabs.HoaDon.length; const r = await call('POST', '/api/sheets/export-all', {}); assert.equal(r.status, 200); assert.ok(sheet.tabs.HoaDon.length > n); assert.ok(sheet.actions.every((a) => a === 'ping' || a === 'append'), sheet.actions.join()); });
await t('tải Excel: cần đăng nhập; file .xlsx hợp lệ, có các sheet và dữ liệu khách/hóa đơn', async () => { const u = await fetch(base + '/api/backup/export-xlsx'); assert.equal(u.status, 401); const r = await fetch(base + '/api/backup/export-xlsx', { headers: { cookie } }); assert.equal(r.status, 200); const b = Buffer.from(await r.arrayBuffer()); assert.equal(b.slice(0, 2).toString(), 'PK'); (await import('node:fs')).writeFileSync('/tmp/claude-0/t.xlsx', b); });
server.close(); hook.close(); console.log(`\nTích hợp Google Sheet/Sự kiện: ${pass} đạt`); process.exit(process.exitCode || 0);
