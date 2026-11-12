// Hóa đơn theo mẫu của chủ nhà + tải ảnh JPG; công thức điện nước Chủ Nhà.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) process.exitCode = 1; };
  await pg.goto('http://localhost:4173/#/login'); await pg.fill('input[name=password]', '20101963'); await pg.click('button:has-text("ĐĂNG NHẬP")'); await pg.waitForSelector('.room-card');
  const id = await pg.evaluate(() => fetch('/api/data').then((r) => r.json()).then((j) => j.db.invoices.filter((i) => i.elec).slice(-1)[0].id));
  await pg.goto('http://localhost:4173/#/invoice/' + id); await pg.waitForSelector('#bill');
  const t = await pg.innerText('#bill');
  ok(/^Hóa Đơn Phòng 1 - 44 Lê Văn Phấn/.test(t) && t.includes('Ngày tính tiền') && t.includes('Số nước cũ') && t.includes('Số nước mới') && t.includes('Số điện cũ') && t.includes('Số điện mới'), 'hóa đơn: tiêu đề "Hóa Đơn Phòng 1 - 44 Lê Văn Phấn", ngày tính tiền, số nước/điện cũ mới');
  ok(/Tiền điện[\s\S]*1\.[0-9]{3} − 1\.[0-9]{3} = 80 × 3\.000 đ/.test(t) && /Tiền nước[\s\S]*= 5 × 10\.000 đ/.test(t) && t.includes('Tiền phòng') && t.includes('Tiền phí khác') && /Tổng tiền phòng 1 là/.test(t), 'công thức "mới − cũ = dùng × giá", tiền phòng, phí khác, "Tổng tiền phòng 1 là"');
  await pg.screenshot({ path: '/tmp/shots/80-bill.png', fullPage: true });
  const writes = []; pg.on('request', (r) => { if (r.url().includes('/api/') && r.method() !== 'GET') writes.push(r.method() + ' ' + r.url()); });
  const dl = pg.waitForEvent('download'); await pg.click('button:has-text("Tải hóa đơn")'); const d = await dl; const path = await d.path(); const buf = fs.readFileSync(path);
  ok(buf[0] === 0xff && buf[1] === 0xd8 && /^hoa-don-phong-1-\d{4}-\d{2}-\d{2}\.jpg$/.test(d.suggestedFilename()) && buf.length > 20000, `tải về ảnh JPG hợp lệ (${d.suggestedFilename()}, ${Math.round(buf.length / 1024)} KB)`);
  await pg.waitForTimeout(400); ok(writes.length === 0, 'tải ảnh hóa đơn chỉ tạo ảnh trên máy: KHÔNG gửi/lưu gì lên máy chủ (' + (writes.join(', ') || 'không có yêu cầu ghi nào') + ')');
  fs.copyFileSync(path, '/tmp/shots/bill-download.jpg');
  await pg.goto('http://localhost:4173/#/room/room-owner'); await pg.waitForSelector('text=Chủ Nhà dùng =');
  const o = await pg.innerText('.ofm >> nth=0'); ok(/Tổng cả dãy \+ nhà = mới − cũ/.test(o) && /Chủ Nhà dùng = /.test(o), 'phòng Chủ Nhà hiển thị công thức: tổng mới − cũ, trừ các phòng');
  console.log(errs.length ? 'LỖI JS: ' + errs.join('|') : 'Không có lỗi JS'); await b.close(); })().catch((e) => { console.error('E2E9 LỖI', e.message.slice(0, 300)); process.exit(1); });
