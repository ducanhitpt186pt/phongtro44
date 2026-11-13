const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); const ctx = await b.newContext({ viewport: { width: 390, height: 800 } }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) process.exitCode = 1; };
  // Giả lập Vercel KHÔNG nhận đường dẫn trực tiếp (404 dạng văn bản) nhưng nhận /api/index?path=
  await pg.route(/\/api\/(?!index)[^?]*$/, (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: 'The page could not be found' }));
  await pg.goto('http://localhost:4173/'); await pg.waitForSelector('text=TỔNG QUAN CẦN XỬ LÝ'); ok(true, 'đường dẫn trực tiếp bị 404 → web tự chuyển sang /api/index?path= và hiển thị bình thường');
  ok((await pg.innerText('body')).includes('Phiên bản giao diện: 2026-11-16-b'), 'trang ngoài hiện số phiên bản giao diện');
  await pg.goto('http://localhost:4173/#/login'); await pg.fill('input[name=password]', '20101963'); await pg.click('button:has-text("ĐĂNG NHẬP")'); await pg.waitForSelector('.room-card'); ok(true, 'đăng nhập + tải dữ liệu qua đường dẫn dự phòng');
  await pg.locator('.room-card').first().click(); await pg.waitForSelector('text=Hóa đơn theo tháng'); ok(true, 'các màn hình quản lý hoạt động qua đường dẫn dự phòng');
  await pg.unroute(/\/api\/(?!index)[^?]*$/);
  // Cả hai đường dẫn đều 404: phải hiện bản tự chẩn đoán
  const p2 = await (await b.newContext()).newPage(); await p2.route(/\/api\//, (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: 'nf' }));
  await p2.goto('http://localhost:4173/'); await p2.waitForSelector('text=Tự kiểm tra'); const t = await p2.innerText('body'); ok(t.includes('/api/health → 404') && t.includes('/api/index?path=health → 404') && t.includes('Vercel chưa chạy thư mục api'), 'cả hai đều 404 → hiện thông báo rõ + bản tự chẩn đoán');
  console.log(errs.length ? 'LỖI JS: ' + errs.join('|') : 'Không có lỗi JS'); await b.close(); })();
