// Rà soát giao diện: đổi giá, trả phòng + hoàn tiền, thu 1 phần + hủy, sửa hóa đơn, chuyển phòng, sửa khách, thêm/sửa phòng, ghi chú, báo cáo, khôi phục.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('dialog', (d) => d.accept());
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) process.exitCode = 1; };
  const H = 'http://localhost:4173/'; const txt = () => pg.innerText('body'); const api = (p) => pg.evaluate((u) => fetch(u).then((r) => r.json()), '/api/' + p);
  await pg.goto(H + '#/login'); await pg.fill('input[name=password]', '20101963'); await pg.click('button:has-text("ĐĂNG NHẬP")'); await pg.waitForSelector('.room-card');
  const room = async (n) => { await pg.goto(H + '#/dashboard'); await pg.locator('.room-card', { hasText: n }).click(); await pg.waitForSelector('h2:has-text("' + n + '")'); };
  // 1. Đổi giá
  await room('Phòng 1'); await pg.click('button:has-text("Đổi giá")'); await pg.fill('form[data-form=price] [name=rent]', '1300000'); await pg.fill('[name=reason]', 'tăng giá'); await pg.click('button:has-text("LƯU GIÁ MỚI")'); await pg.waitForSelector('text=1.300.000'); ok(true, 'đổi giá: giá mới hiện, áp dụng từ kỳ sau');
  const d1 = await api('data'); ok(d1.db.invoices.find((i) => i.roomName === 'Phòng 1').rent === 1200000 && d1.db.priceHistories.some((p) => p.old && p.old.rent === 1200000), 'hóa đơn kỳ hiện tại giữ giá cũ; lịch sử giá có giá cũ/mới');
  // 2. Trả phòng Phòng 1 (đã đóng đủ 1.200.000; ở 14 ngày → hoàn 640.000)
  await pg.click('button:has-text("Trả phòng")'); await pg.fill('form[data-form=checkout] [name=elecFinal]', '100'); await pg.fill('[name=waterFinal]', '10'); await pg.click('button:has-text("XEM TÍNH TOÁN")'); await pg.waitForSelector('text=Xác nhận quyết toán');
  const q = await pg.innerText('.dialog'); const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); const days = Math.round((Date.parse(today) - Date.parse('2026-10-20')) / 864e5); const fm = (n) => n.toLocaleString('vi-VN'); ok(q.includes(days + ' ngày') && q.includes(fm(40000 * days)) && q.includes(fm(1200000 - 40000 * days)), `quyết toán: ${days} ngày × 40.000 = ${fm(40000 * days)}, hoàn ${fm(1200000 - 40000 * days)}`);
  await pg.screenshot({ path: '/tmp/shots/40-checkout.png' });
  await pg.click('button:has-text("XÁC NHẬN QUYẾT TOÁN")'); await pg.waitForSelector('text=SỐ TIỀN CHỦ NHÀ HOÀN LẠI KHÁCH'); ok(true, 'hóa đơn quyết toán hiển thị số tiền hoàn');
  ok((await api('data')).db.rooms.find((r) => r.id === 'room-1').status === 'empty', 'phòng chuyển sang Trống');
  await pg.goto(H + '#/dashboard'); ok((await txt()).includes('Cần hoàn tiền'), 'thông báo "cần hoàn tiền" hiện ở Tổng quan');
  await pg.locator('.note', { hasText: 'PHÒNG 1' }).click(); await pg.waitForSelector('text=Phòng đang trống'); await pg.goto(H + '#/tenants'); await pg.click('text=Khách Một'); await pg.click('.li:has-text("HD-") >> nth=0'); await pg.click('button:has-text("Xác nhận ĐÃ HOÀN")'); await pg.waitForSelector('text=Hoàn tiền: đã hoàn'); ok(true, 'xác nhận đã hoàn tiền');
  // 3. Phòng 2: thu 1 phần → hủy → sửa hóa đơn
  await room('Phòng 2'); await pg.click('button:has-text("Thanh toán")'); await pg.fill('form[data-form=pay] [name=amount]', '500000'); await pg.click('button:has-text("XÁC NHẬN ĐÃ THU")'); await pg.waitForSelector('text=1.000.000'); ok(true, 'thu 500.000 → còn nợ 1.000.000');
  await pg.click('text=Hóa đơn mới nhất'); await pg.goto(H + '#/room/room-2'); await pg.click('tr.click >> nth=0'); await pg.waitForSelector('.invoice'); await pg.click('.invoice button:has-text("Hủy")'); await pg.fill('form[data-form=void-pay] [name=reason]', 'nhập nhầm'); await pg.click('button:has-text("HỦY GIAO DỊCH")'); await pg.waitForSelector('text=Đã hủy: nhập nhầm'); ok(true, 'hủy giao dịch có lý do (không xóa)');
  await pg.click('button:has-text("Điều chỉnh")'); await pg.fill('form[data-form=adjust] [name=x1l]', 'Sửa khóa'); await pg.fill('[name=x1a]', '50000'); await pg.fill('[name=reason]', 'phát sinh'); await pg.click('button:has-text("LƯU ĐIỀU CHỈNH")'); await pg.waitForSelector('text=Sửa khóa'); ok((await pg.innerText('.invoice')).includes('1.550.000'), 'sửa hóa đơn: tổng 1.550.000, có lịch sử điều chỉnh');
  // 4. Chuyển phòng 2 → Phòng 1
  await room('Phòng 2'); await pg.click('button:has-text("Chuyển phòng")'); const f = 'form[data-form=transfer] '; await pg.selectOption(f + '[name=newRoomId]', { label: 'Phòng 1' }); await pg.fill(f + '[name=elecFinal]', '60'); await pg.fill(f + '[name=waterFinal]', '6'); await pg.fill(f + '[name=newInitElec]', '200'); await pg.fill(f + '[name=newInitWater]', '20'); await pg.click('button:has-text("XÁC NHẬN CHUYỂN PHÒNG")'); await pg.waitForSelector('h2:has-text("Phòng 1")');
  const d2 = await api('data'); ok(d2.db.rooms.find((r) => r.id === 'room-1').status === 'occupied' && d2.db.rooms.find((r) => r.id === 'room-2').status === 'empty' && d2.db.roomTransfers.length === 1, 'chuyển phòng: phòng cũ Trống, phòng mới Đang thuê, có lịch sử');
  ok(d2.db.invoices.some((i) => i.kind === 'transfer' && i.roomName === 'Phòng 2'), 'hóa đơn chốt phòng cũ gắn với Phòng 2');
  // 5. Sửa khách, thêm/sửa phòng, ghi chú
  await pg.goto(H + '#/tenants'); await pg.click('text=Khách Hai'); await pg.click('button:has-text("Sửa thông tin")'); await pg.fill('form[data-form=tenant-edit] [name=phone]', '0988888888'); await pg.click('button:has-text("LƯU")'); await pg.waitForSelector('text=0988888888'); ok(true, 'sửa thông tin khách');
  await pg.goto(H + '#/dashboard'); await pg.click('text=+ Thêm phòng'); await pg.fill('form[data-form=room] [name=name]', 'Phòng 8'); await pg.click('form[data-form=room] button[type=submit]'); await pg.waitForSelector('.room-card:has-text("Phòng 8")'); ok(true, 'thêm phòng mới');
  await room('Phòng 1'); const note = pg.locator('input.note-in').nth(10); await note.fill('Khách đi vắng'); await note.blur(); await pg.waitForTimeout(900); ok((await api('data')).db.monthlyNotes.some((n) => n.text === 'Khách đi vắng'), 'ghi chú theo tháng được lưu');
  // 6. Báo cáo + sao lưu/khôi phục
  await pg.goto(H + '#/reports'); await pg.waitForSelector('text=Tổng tiền đã thu'); ok((await txt()).toLowerCase().includes('theo phòng'), 'báo cáo hiển thị');
  const before = (await api('data')).db.invoices.length;
  await pg.goto(H + '#/backup'); const exp = await pg.evaluate(() => fetch('/api/backup/export').then((r) => r.text())); require('fs').writeFileSync('/tmp/exp.json', exp);
  await pg.setInputFiles('form[data-form=restore] input[type=file]', '/tmp/exp.json'); await pg.fill('form[data-form=restore] [name=confirm]', 'GHI DE'); await pg.click('button:has-text("KIỂM TRA & KHÔI PHỤC")'); await pg.waitForTimeout(1200);
  ok((await api('data')).db.invoices.length === before && (await api('data')).db.activityLogs.some((l) => l.action.startsWith('Khôi phục')), 'khôi phục JSON từ file: dữ liệu nguyên vẹn');
  console.log(errs.length ? 'LỖI JS: ' + errs.join('|') : 'Không có lỗi JS'); await b.close();
})().catch((e) => { console.error('E2E5 LỖI', e.message.split('\n')[0]); process.exit(1); });
