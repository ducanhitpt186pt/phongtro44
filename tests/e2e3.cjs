const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('dialog', (d) => d.accept());
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) process.exitCode = 1; };
  await page.goto('http://localhost:4173/#/login'); await page.fill('input[name=password]', '20101963'); await page.click('button:has-text("ĐĂNG NHẬP")'); await page.waitForSelector('text=Các phòng');
  ok(await page.isVisible('.top .ubar.bad >> text=sắp đầy'), 'thanh mức dùng ở đầu trang chuyển đỏ + "sắp đầy" khi ≥ 90%');
  await page.screenshot({ path: '/tmp/shots/10-warn.png' });
  await page.click('#footstrip a:has-text("Dọn dữ liệu")'); await page.waitForSelector('text=Dung lượng & dọn dữ liệu cũ'); ok(await page.isVisible('text=Khách Cũ Ba Năm'), 'liệt kê khách đủ điều kiện (trả phòng 2023)');
  await page.screenshot({ path: '/tmp/shots/11-cleanup.png', fullPage: true });
  const dl = page.waitForEvent('download'); await page.click('button:has-text("XÓA DỮ LIỆU")'); await dl; ok(true, 'tự tải bản sao lưu trước khi xóa');
  await page.waitForSelector('text=Chưa có hồ sơ nào đủ điều kiện xóa'); ok(true, 'đã xóa, danh sách trống');
  await page.goto('http://localhost:4173/#/tenants'); const t = await page.innerText('body'); ok(!t.includes('Khách Cũ') && !t.includes('0900000001') && !t.includes('(Đã xóa hồ sơ)'), 'hồ sơ khách cũ đã bị xóa thông tin cá nhân và không còn nằm trong danh sách khách');
  await page.goto('http://localhost:4173/#/dashboard'); await page.waitForSelector('text=Các phòng'); ok(!(await page.isVisible('.top .ubar.bad')), 'thanh trở lại bình thường sau khi dọn');
  const rep = await page.evaluate(() => fetch('/api/reports?from=2023-01-01&to=2023-12-31').then((r) => r.json())); ok(rep.total.billed > 0, 'báo cáo doanh thu 2023 vẫn còn số liệu tiền');
  console.log(errs.length ? 'LỖI JS: ' + errs.join('|') : 'Không có lỗi JS'); await b.close();
})().catch((e) => { console.error('E2E3 LỖI', e.message); process.exit(1); });
