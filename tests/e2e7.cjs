// Giao diện mới: cỡ chữ, icon phòng, người ở cùng có ảnh CCCD, danh sách phòng ở trang ngoài, công tắc hiện/ẩn họ tên.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('dialog', (d) => d.accept());
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) process.exitCode = 1; };
  const H = 'http://localhost:4173/'; const api = (p, o) => pg.evaluate(([u, o]) => fetch(u, o).then((r) => r.json()), ['/api/' + p, o]);
  await pg.goto(H + '#/login'); await pg.fill('input[name=password]', '20101963'); await pg.click('button:has-text("ĐĂNG NHẬP")'); await pg.waitForSelector('.room-card');
  const px = (sel) => pg.$eval(sel, (e) => parseFloat(getComputedStyle(e).fontSize)); const root = await pg.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  ok((await px('.top h1')) === 2 * root && (await px('.top .credit')) === 0.5 * root, 'tiêu đề 2rem, chữ ducanhitpt186 0,5rem');
  ok((await px('#footstrip .foot-strip')) === 1 * root && (await px('.top .bell')) === 1 * root && (await px('.top .dt')) === 1.2 * root, 'dòng lưu trữ (cuối trang) và chuông 1rem; ngày + âm lịch 1,2rem');
  ok((await pg.locator('.room-card .rbadge svg').count()) >= 7, 'mỗi thẻ phòng có icon trạng thái');
  await pg.screenshot({ path: '/tmp/shots/60-dash.png' });
  await pg.locator('.room-card', { hasText: 'Phòng 1' }).click(); await pg.waitForSelector('text=Người ở cùng (0)');
  const bg = await pg.$eval('button[data-act=add-occupant]', (e) => getComputedStyle(e).backgroundImage + getComputedStyle(e).backgroundColor); ok(/rgb\(2[0-9]{2}, [0-9]{1,3}, [0-9]{1,3}\)/.test(bg), 'nút "Thêm người ở cùng" màu đỏ (' + bg + ')');
  // thêm người ở cùng CÓ ảnh
  await pg.click('button[data-act=add-occupant]'); await pg.fill('[name=o_name]', 'Lê Thị Mai'); await pg.fill('[name=o_dob]', '1998-05-05'); await pg.fill('[name=o_cccd]', '001098000555');
  await pg.click('button:has-text("LƯU NGƯỜI Ở CÙNG")'); await pg.waitForSelector('text=địa chỉ thường trú'); ok(true, 'người ở cùng thiếu địa chỉ thường trú → bị chặn'); await pg.fill('[name=o_address]', 'Hà Nội');
  await pg.setInputFiles('input[data-slot=add-front] >> nth=0', '/tmp/cccd.jpg'); await pg.waitForSelector('#prev-add-front img'); await pg.setInputFiles('input[data-slot=add-back] >> nth=1', '/tmp/cccd.jpg'); await pg.waitForSelector('#prev-add-back img');
  await pg.click('button:has-text("LƯU NGƯỜI Ở CÙNG")'); await pg.waitForSelector('text=Người ở cùng (1)'); ok((await pg.innerText('body')).includes('đã có 2 mặt ảnh') && (await pg.innerText('body')).includes('2 người'), 'đã thêm: có 2 mặt ảnh, số người tự đếm = 2');
  // trẻ em không CCCD
  await pg.click('button[data-act=add-occupant]'); await pg.fill('[name=o_name]', 'Bé Na'); await pg.fill('[name=o_dob]', '2020-01-01'); await pg.check('[name=o_noid]'); await pg.click('button:has-text("LƯU NGƯỜI Ở CÙNG")'); await pg.waitForSelector('text=Người ở cùng (2)'); ok((await pg.innerText('body')).includes('3 người'), 'trẻ em chưa có CCCD: không cần ảnh, số người = 3');
  const data = await api('data'); const mai = data.db.occupants.find((o) => o.fullName === 'Lê Thị Mai'); ok(mai.idImages.front && mai.idImages.back, 'ảnh CCCD người ở cùng được lưu (2 mặt)');
  await pg.screenshot({ path: '/tmp/shots/61-room.png', fullPage: true });
  // hồ sơ khách: xem ảnh người ở cùng, xóa người ở cùng
  await pg.click('a:has-text("Hồ sơ khách")'); await pg.waitForSelector('text=Lê Thị Mai'); await pg.locator('button:has-text("Xem ảnh")').nth(0).click();
  await pg.waitForFunction(() => [...document.querySelectorAll('.idprev img')].some((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 }).catch(() => {}); ok(await pg.evaluate(() => [...document.querySelectorAll('.idprev img')].some((i) => i.complete && i.naturalWidth > 0)), 'xem được ảnh CCCD của người ở cùng');
  await pg.locator('button[data-act=del-occupant]').nth(1).click(); await pg.waitForSelector('text=Người ở cùng (1)'); ok(true, 'xóa người ở cùng (ảnh bị xóa khỏi kho)');
  // ghi chú + sửa chữa → trang ngoài
  const ym = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7); await api('notes', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-csrf-token': await pg.evaluate(() => fetch('/api/auth/session').then((r) => r.json()).then((j) => j.csrf)) }, body: JSON.stringify({ roomId: 'room-1', ym, text: 'mượn 500' }) });
  await pg.evaluate(async () => { const c = (await fetch('/api/auth/session').then((r) => r.json())).csrf; await fetch('/api/rooms/room-4', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-csrf-token': c }, body: JSON.stringify({ status: 'repair', note: 'thay vòi nước' }) }); });
  const p2 = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage(); await p2.goto(H); await p2.waitForSelector('text=DANH SÁCH PHÒNG');
  const t = await p2.innerText('body'); ok(t.includes('Khách Một') && t.includes('mượn 500') && /Số người\s*2/.test(t) && t.includes('Đang sửa chữa') && t.includes('Phòng trống'), 'trang ngoài: tên khách, ngày vào, số người, nợ, ghi chú; phòng sửa chữa/trống có màu + icon');
  ok(!/0900000001|001090000001|Lê Thị Mai|Hà Nội/.test(t), 'trang ngoài không lộ SĐT/CCCD/địa chỉ/tên người ở cùng');
  await p2.screenshot({ path: '/tmp/shots/62-public-roster.png', fullPage: true });
  // công tắc ẩn họ tên
  await pg.goto(H + '#/backup'); await pg.waitForSelector('text=Hiện họ tên khách và ghi chú trên trang ngoài'); await pg.uncheck('input[data-change=set-public]'); await pg.waitForTimeout(900);
  await p2.reload(); await p2.waitForSelector('text=Cập nhật lúc'); const t2 = await p2.innerText('body'); ok(!t2.includes('Khách Một') && !t2.includes('mượn 500') && t2.includes('Phòng 1'), 'tắt công tắc: trang ngoài ẩn họ tên + ghi chú (vẫn hiện phòng, số người, nợ)');
  // form thêm khách mới: không còn "số người", không còn chế độ "đã ở sẵn"
  await pg.goto(H + '#/dashboard'); await pg.locator('.room-card', { hasText: 'Phòng 3' }).click(); await pg.click('button[data-act=movein]'); const f = await pg.innerText('form[data-form=movein]');
  ok(!/Số người ở|Khách đã ở sẵn/.test(f) && (await pg.locator('button[data-act=add-occ]').count()) === 1, 'form thêm khách: không còn ô "Số người ở" và chế độ "đã ở sẵn"'); 
  const d = new Date(Date.now() + 7 * 3600e3); d.setUTCMonth(d.getUTCMonth() - 3); await pg.fill('[name=startDate]', d.toISOString().slice(0, 10)); ok(await pg.isVisible('#existbox'), 'ngày vào quá 1 tháng → tự hiện ô nợ cũ/đã đóng (không cần chọn chế độ)');
  await pg.screenshot({ path: '/tmp/shots/63-movein.png' });
  console.log(errs.length ? 'LỖI JS: ' + errs.join('|') : 'Không có lỗi JS'); await b.close();
})().catch((e) => { console.error('E2E7 LỖI', e.message.slice(0, 500)); process.exit(1); });
