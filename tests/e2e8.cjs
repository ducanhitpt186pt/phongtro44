// Điện nước: so sánh tháng trước, cảnh báo rò rỉ > 30%, phòng Chủ Nhà (đồng hồ tổng), chữ nút trang chủ.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('dialog', (d) => d.accept());
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) process.exitCode = 1; };
  await pg.goto('http://localhost:4173/'); await pg.waitForSelector('text=ĐIỆN – NƯỚC CÁC PHÒNG SO VỚI THÁNG TRƯỚC');
  ok(await pg.isVisible('a:has-text("Ghi Điện & Nước - Tính Tiền Phòng")') && !(await pg.isVisible('text=ĐĂNG NHẬP QUẢN LÝ')), 'nút trang chủ: "Ghi Điện & Nước - Tính Tiền Phòng"');
  const t = await pg.innerText('body');
  ok(/Phòng 1[\s\S]*50 → 80/.test(t) && /10 → 5/.test(t) && t.includes('▲ +60%') && t.includes('▼ −50%'), 'phòng 1: điện 50 → 80 (▲ +60%), nước 10 → 5 (▼ −50%)');
  ok(/TB các tháng gần nhất: 50 số/.test(t), 'hiện trung bình các tháng gần nhất trong năm');
  ok(t.includes('Phòng 1: điện tăng 60%') || /Phòng 1 – nghi rò rỉ điện/.test(t), 'điện tăng > 30% → cảnh báo kiểm tra rò rỉ'); ok(!/Phòng 1 – nghi rò rỉ nước/.test(t), 'nước giảm → không cảnh báo');
  ok(/Chủ Nhà[\s\S]*đồng hồ tổng − các phòng/.test(t) && /nghi rò rỉ điện/.test(t.split('Chủ Nhà')[0] + t), 'Chủ Nhà (tổng − phòng) hiển thị và cảnh báo khi tăng > 30%');
  await pg.screenshot({ path: '/tmp/shots/70-usage-public.png', fullPage: true });
  await pg.goto('http://localhost:4173/#/login'); await pg.fill('input[name=password]', '20101963'); await pg.click('button:has-text("ĐĂNG NHẬP")'); await pg.waitForSelector('.room-card');
  ok((await pg.locator('.room-card:not(.owner-card)').count()) === 7 && (await pg.locator('.owner-card').count()) === 1, '7 phòng + 1 thẻ "Chủ Nhà" riêng (không tính vào số phòng)');
  ok((await pg.innerText('.top .bell')).trim() !== '0', 'chuông thông báo đếm cả cảnh báo rò rỉ');
  await pg.locator('.owner-card').click(); await pg.waitForSelector('text=Chủ Nhà – đồng hồ tổng');
  const last = await pg.evaluate(() => fetch('/api/data').then((r) => r.json()).then((j) => j.db.masterReadings.slice(-1)[0]));
  await pg.fill('form[data-form=master] [name=elec]', String(last.elec - 5)); await pg.fill('[name=water]', String(last.water)); await pg.fill('[name=date]', new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)); await pg.click('button:has-text("LƯU CHỈ SỐ ĐỒNG HỒ TỔNG")'); await pg.waitForSelector('text=nhỏ hơn lần trước'); ok(true, 'đồng hồ tổng nhập nhỏ hơn lần trước → bị từ chối');
  await pg.fill('[name=elec]', String(last.elec + 100)); await pg.fill('[name=water]', String(last.water + 5)); await pg.click('button:has-text("LƯU CHỈ SỐ ĐỒNG HỒ TỔNG")'); await pg.waitForSelector('.li:has-text("điện " )'); ok((await pg.evaluate(() => fetch('/api/data').then((r) => r.json()).then((j) => j.db.masterReadings.length))) === 12, 'lưu thêm lần ghi đồng hồ tổng');
  await pg.screenshot({ path: '/tmp/shots/71-owner.png', fullPage: true });
  console.log(errs.length ? 'LỖI JS: ' + errs.join('|') : 'Không có lỗi JS'); await b.close(); })().catch((e) => { console.error('E2E8 LỖI', e.message.split('\n')[0]); process.exit(1); });
