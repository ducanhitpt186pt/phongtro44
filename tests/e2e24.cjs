// Ảnh hồ sơ khách theo phòng (A4 dọc), thẻ phòng đã thanh toán đủ, Tổng quan (tổng số phòng + phòng đang khóa).
const fs = require('fs');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const OUT = process.env.OUT || '/tmp/claude-0/e2e24'; fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('dialog', (d) => d.accept());
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) process.exitCode = 1; }; const H = 'http://localhost:4173/';
  const call = async (m, p, body) => { const c = await pg.evaluate(() => fetch('/api/auth/session').then((r) => r.json()).then((j) => j.csrf)); return pg.evaluate(([m, p, body, c]) => fetch('/api/' + p, { method: m, headers: { 'content-type': 'application/json', 'x-csrf-token': c }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json()), [m, p, body, c]); };
  const jpg = fs.readFileSync(__dirname + '/sample-cccd.jpg').toString('base64');
  const upload = (owner, side) => pg.evaluate(async ([o, s, b64]) => { const c = await fetch('/api/auth/session').then((r) => r.json()).then((j) => j.csrf); const bytes = Uint8Array.from(atob(b64), (x) => x.charCodeAt(0)); return (await fetch(`/api/storage/upload?ownerId=${o}&side=${s}`, { method: 'POST', headers: { 'content-type': 'image/jpeg', 'x-csrf-token': c }, body: bytes })).status; }, [owner, side, jpg]);
  await pg.goto(H + '#/login'); await pg.fill('input[name=password]', '20101963'); await pg.click('button:has-text("ĐĂNG NHẬP")'); await pg.waitForSelector('.room-card');
  const per = { fullName: 'Nguyễn Văn An', dob: '1990-05-12', gender: 'male', phone: '0912345678', cccd: '001090000123', cccdIssueDate: '2021-04-10', cccdIssuePlace: 'Cục Cảnh sát QLHC về TTXH', address: 'Số 12 ngõ 45 đường Lê Văn Phấn, phường Nhân Chính, quận Thanh Xuân, thành phố Hà Nội' };
  const start = new Date(Date.now() + 7 * 3600e3 - 28 * 86400000).toISOString().slice(0, 10);
  let r = await call('POST', 'tenants', { roomId: 'room-2', startDate: start, paidAlready: true, rent: 3000000, elecPrice: 3500, waterPrice: 15000, initElec: 100, initWater: 10, tenant: per, occupants: [{ fullName: 'Trần Thị Mai', dob: '1992-08-20', gender: 'female', phone: '0987654321', cccd: '001192000456', address: 'Số 12 ngõ 45 Lê Văn Phấn, Thanh Xuân, Hà Nội' }, { fullName: 'Nguyễn Bảo An', dob: '2018-01-01', gender: 'male', noId: true, address: '' }] });
  ok(r.ok !== false && !r.error, 'thêm khách phòng 2 + 2 người ở cùng ' + (r.error || ''));
  let d = await pg.evaluate(() => fetch('/api/data').then((x) => x.json())); const t = d.db.tenants.find((x) => x.fullName === per.fullName); const occ = d.db.occupants.filter((o) => o.tenantId === t.id);
  for (const o of [t, occ.find((x) => !x.noId)]) for (const s of ['front', 'back']) ok((await upload(o.id, s)) === 200, `tải ảnh CCCD ${o.fullName} ${s}`);
  r = await call('POST', 'tenants', { roomId: 'room-3', startDate: start, paidAlready: true, rent: 2500000, elecPrice: 3500, waterPrice: 15000, initElec: 1, initWater: 1, tenant: { ...per, fullName: 'Lê Thị Hoa', cccd: '001190000999', phone: '0933333333' }, occupants: [] });
  await call('PUT', 'rooms/room-5', { status: 'notready', note: 'khóa' }); await call('PUT', 'rooms/room-6', { status: 'notready', note: 'khóa' });
  await pg.reload(); await pg.waitForSelector('.room-card');
  // Tổng quan
  const ov = await pg.innerText('.cards7'); ok(!/Tổng tiền cần thu/.test(ov), 'Tổng quan: đã bỏ "Tổng tiền cần thu (kỳ hiện hành)"');
  const nRooms = (await pg.evaluate(() => fetch('/api/data').then((x) => x.json()))).db.rooms.filter((x) => !x.kind).length;
  ok(new RegExp(`${nRooms}\\s*Tổng số phòng\\s*Phòng đang khóa:\\s*2`).test(ov.replace(/\n/g, ' ')), 'Tổng quan: "Tổng số phòng ' + nRooms + ' · Phòng đang khóa: 2" → ' + ov.replace(/\n/g, ' | '));
  // thẻ phòng đã trả đủ (tiền đầu kỳ đã nhận, chưa ghi điện nước) – ghi điện nước để có hóa đơn rồi trả đủ
  d = await pg.evaluate(() => fetch('/api/data').then((x) => x.json())); const r2 = d.db.rentals.find((x) => x.roomId === 'room-2' && x.status === 'active');
  const per2 = d.derived.rentals[r2.id].periods[0];
  let rr = await call('POST', 'readings', { rentalId: r2.id, periodIndex: per2.index, elecNew: 160, waterNew: 14, readDate: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10) }); ok(!rr.error, 'ghi điện nước phòng 2 ' + (rr.error || ''));
  await pg.reload(); await pg.waitForSelector('.room-card');
  let card = await pg.locator('.room-card', { hasText: 'Phòng 2' }).first().innerText(); ok(/Tổng cần thu/.test(card) && /Đã thanh toán/.test(card), 'phòng còn nợ: hiện "Tổng cần thu" + "Đã thanh toán"');
  d = await pg.evaluate(() => fetch('/api/data').then((x) => x.json())); const inv = d.db.invoices.filter((i) => i.roomName === 'Phòng 2').slice(-1)[0]; const rem = d.derived.invoices[inv.id].remaining;
  rr = await call('POST', 'payments', { invoiceId: inv.id, amount: rem, date: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10), note: '' }); ok(!rr.error, 'thanh toán đủ ' + (rr.error || ''));
  await pg.reload(); await pg.waitForSelector('.room-card'); card = await pg.locator('.room-card', { hasText: 'Phòng 2' }).first().innerText();
  ok(!/Tổng cần thu/.test(card) && !/Đã thanh toán/.test(card), 'phòng đã trả đủ tháng: KHÔNG hiện "Tổng cần thu"/"Đã thanh toán" → ' + card.replace(/\n/g, ' | '));
  // nút tải ảnh trong trang phòng
  await pg.goto(H + '#/room/room-2'); await pg.waitForSelector('button[data-act=profile-img]');
  let [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('button[data-act=profile-img]')]); const f1 = OUT + '/' + dl.suggestedFilename(); await dl.saveAs(f1);
  // trang này có 3 người → 2 trang; trang 2 tải tiếp
  let second = null; try { second = await pg.waitForEvent('download', { timeout: 4000 }); await second.saveAs(OUT + '/' + second.suggestedFilename()); } catch { /* một ảnh */ }
  ok(/ho-so-khach-phong-2-trang-1/.test(dl.suggestedFilename()) && second && /trang-2/.test(second.suggestedFilename()), 'phòng 3 người → 2 ảnh A4 (trang 1, trang 2): ' + dl.suggestedFilename() + ' + ' + (second && second.suggestedFilename()));
  // nút trong hồ sơ khách (phòng 3: 1 người)
  d = await pg.evaluate(() => fetch('/api/data').then((x) => x.json())); const t3 = d.db.tenants.find((x) => x.fullName === 'Lê Thị Hoa');
  await pg.goto(H + '#/tenant/' + t3.id); await pg.waitForSelector('button[data-act=profile-img]');
  [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('button[data-act=profile-img]')]); await dl.saveAs(OUT + '/' + dl.suggestedFilename()); ok(/ho-so-khach-phong-3/.test(dl.suggestedFilename()), 'nút ở Hồ sơ khách tải ảnh: ' + dl.suggestedFilename());
  await pg.goto(H + '#/tenant/' + t.id); await pg.waitForSelector('button[data-act=profile-img]');
  ok(errs.length === 0, 'không có lỗi JS ' + errs.join(';')); await b.close();
})();
