// Mục 2026-11-30-e: chỉ số ban đầu khi đổi giá, nút tải lại, tên ngân hàng dài, báo cáo chi tiết, số báo trên icon, SĐT lạ, Tiền Nợ Cũ, nối lại ảnh CCCD, Backup Căn Cước
const fs = require('fs'); const { execSync } = require('child_process');
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const OUT = '/tmp/claude-0/e2e31'; fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--no-sandbox'] }); const ctx = await b.newContext({ viewport: { width: 1100, height: 1000 }, acceptDownloads: true });
  await ctx.addInitScript(() => { window.__badge = []; navigator.setAppBadge = (n) => { window.__badge.push(n); return Promise.resolve(); }; navigator.clearAppBadge = () => { window.__badge.push(0); return Promise.resolve(); }; });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('dialog', (d) => d.accept());
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) process.exitCode = 1; }; const H = 'http://localhost:4173/';
  const data = () => pg.evaluate(() => fetch('/api/data').then((x) => x.json()));
  const day = (k) => new Date(Date.now() + 7 * 3600e3 + k * 86400000).toISOString().slice(0, 10);
  await pg.goto(H + '#/login'); await pg.fill('input[name=password]', '20101963'); await pg.click('button:has-text("ĐĂNG NHẬP")'); await pg.waitForSelector('.room-card');
  // 1. Thêm khách có SĐT lạ + Tiền Nợ Cũ + ảnh CCCD
  await pg.goto(H + '#/room/room-1'); await pg.waitForSelector('button[data-act=movein]'); await pg.click('button[data-act=movein]'); await pg.waitForSelector('form[data-form=movein]'); const F = 'form[data-form=movein] ';
  ok(await pg.inputValue(F + 'input[name=od_amount]') === '0' && await pg.inputValue(F + 'input[name=od_date]') === day(0), 'Thêm khách: Tiền Nợ Cũ mặc định 0, ngày nợ = hôm nay');
  await pg.fill(F + 'input[name=fullName]', 'Trần Thị Mai'); await pg.fill(F + 'input[name=dob]', '1990-05-06'); await pg.fill(F + 'input[name=phone]', '0911111111'); await pg.check(F + 'input[name=gender][value=female]'); await pg.fill(F + 'input[name=cccd]', '001090000111'); await pg.fill(F + 'input[name=cccdIssueDate]', '2021-01-01'); await pg.fill(F + 'input[name=cccdIssuePlace]', 'CA'); await pg.fill(F + 'input[name=address]', 'Đà Nẵng');
  await pg.fill(F + 'input[name=startDate]', day(-25)); await pg.fill(F + 'input[name=initElec]', '100'); await pg.fill(F + 'input[name=initWater]', '50'); await pg.fill(F + 'input[name=rent]', '3000000'); await pg.fill(F + 'input[name=elecPrice]', '3500'); await pg.fill(F + 'input[name=waterPrice]', '15000');
  await pg.fill(F + 'input[name=od_amount]', '300000'); await pg.fill(F + 'textarea[name=od_reason]', 'Thiếu tiền điện chỗ ở cũ');
  await pg.setInputFiles('input[data-slot=front][type=file]:not([capture])', '/tmp/cccd_test.jpg'); await pg.setInputFiles('input[data-slot=back][type=file]:not([capture])', '/tmp/cccd_test.jpg'); await pg.waitForSelector('#prev-front img'); await pg.waitForSelector('#prev-back img');
  await pg.click(F + 'button[type=submit]'); for (let i = 0; i < 40; i++) { await pg.waitForTimeout(500); const d0 = (await data()).db; const tt = d0.tenants.find((x) => x.fullName === 'Trần Thị Mai'); if (tt?.idImages?.front && tt?.idImages?.back) break; if (i === 39) console.log('TOAST/ERR:', await pg.innerText('#toast').catch(() => ''), await pg.innerText('#modal').catch(() => '')); }
  let db = (await data()).db; const t = db.tenants.find((x) => x.fullName === 'Trần Thị Mai'); const rent = db.rentals.find((r) => r.tenantId === t.id);
  ok(t.oldDebt?.amount === 300000 && t.oldDebt.reason.includes('Thiếu') && t.idImages.front && t.idImages.back, 'lưu Tiền Nợ Cũ 300.000 + 2 ảnh CCCD');
  // 2. Tổng quan: mục nợ cũ + SĐT cần cập nhật, số trên icon = số trên chuông
  await pg.goto(H + '#/dashboard'); await pg.waitForSelector('.room-card');
  let main = await pg.innerText('main'); ok(main.toLowerCase().includes('tiền nợ cũ của khách (1)') && main.includes('300.000'), 'Tổng quan: hiện Tiền nợ cũ của khách');
  ok(main.toLowerCase().includes('cần cập nhật số điện thoại (1)') && main.includes('0911111111'), 'Tổng quan: báo SĐT có 6 số giống nhau');
  let bell = Number(await pg.innerText('.bell .bn')); let badge = await pg.evaluate(() => window.__badge.slice(-1)[0]); ok(bell > 0 && badge === bell, `số trên biểu tượng app = số trên chuông (${badge}/${bell})`);
  await pg.click('button[data-act=phone-ok]'); await pg.waitForTimeout(800); main = await pg.innerText('main'); ok(!main.toLowerCase().includes('cần cập nhật số điện thoại'), 'bấm "Số đúng" → không báo nữa');
  ok(Number(await pg.innerText('.bell .bn')) === bell - 1 && await pg.evaluate(() => window.__badge.slice(-1)[0]) === bell - 1, 'số thông báo giảm theo (chuông + icon)');
  // 3. Thay đổi giá phòng: chỉ số ban đầu hiện sẵn, sửa được
  await pg.goto(H + '#/room/room-1'); await pg.waitForSelector('button[data-act=price]'); ok((await pg.innerText('main')).includes('Tiền nợ cũ'), 'trang phòng hiện Tiền nợ cũ');
  await pg.click('button[data-act=price]'); await pg.waitForSelector('form[data-form=price]');
  ok(await pg.inputValue('form[data-form=price] input[name=initElec]') === '100' && await pg.inputValue('form[data-form=price] input[name=initWater]') === '50', 'đổi giá: hiện sẵn chỉ số điện 100, nước 50 của khách');
  await pg.fill('form[data-form=price] input[name=initElec]', '120'); await pg.click('form[data-form=price] button[type=submit]'); await pg.waitForTimeout(800);
  db = (await data()).db; const r1 = db.rentals.find((r) => r.id === rent.id); ok(r1.initElec === 120 && r1.initWater === 50 && db.priceHistories.filter((p) => p.rentalId === rent.id).length === 1, 'sửa chỉ số điện ban đầu 100→120, giá không đổi thì không tạo lịch sử giá');
  // 4. Ghi điện nước → sau đó chỉ số ban đầu bị khóa
  await pg.click('button[data-act=readings]'); await pg.waitForSelector('form[data-form=readings]'); await pg.fill('form[data-form=readings] input[name=elecNew]', '150'); await pg.fill('form[data-form=readings] input[name=waterNew]', '60'); await pg.click('form[data-form=readings] button[type=submit]'); await pg.waitForTimeout(1000);
  db = (await data()).db; const inv = db.invoices.filter((i) => i.chainId === rent.chainId).slice(-1)[0]; ok(inv.elec.amount === 105000 && inv.water.amount === 150000, 'hóa đơn tính điện từ số ban đầu đã sửa (30 số × 3.500 = 105.000)');
  await pg.goto(H + '#/room/room-1'); await pg.waitForSelector('button[data-act=price]'); await pg.click('button[data-act=price]'); await pg.waitForSelector('form[data-form=price]');
  ok(await pg.$eval('form[data-form=price] input[name=initElec]', (e) => e.readOnly) && (await pg.innerText('#modal')).includes('không sửa chỉ số ban đầu'), 'đã ghi điện nước → chỉ số ban đầu khóa, có giải thích');
  await pg.keyboard.press('Escape'); await pg.goto(H + '#/invoice/' + inv.id); await pg.waitForSelector('button[data-act=pay]'); await pg.click('button[data-act=pay]'); await pg.waitForSelector('form[data-form=pay]'); await pg.fill('form[data-form=pay] input[name=amount]', '500000'); await pg.click('form[data-form=pay] button[type=submit]'); await pg.waitForTimeout(800);
  // 5. Báo cáo chi tiết
  await pg.goto(H + '#/reports'); await pg.waitForSelector('form[data-form=report]'); await pg.fill('input[name=to]', day(40)); await pg.click('form[data-form=report] button[type=submit]'); await pg.waitForFunction(() => (document.querySelector('#rep')?.innerText || '').includes('Thu một phần'), null, { timeout: 10000 }).catch(() => {});
  let rep = await pg.innerText('#rep'); await pg.screenshot({ path: OUT + '/report-month.png', fullPage: true });
  ok(rep.includes('Thu khi vào ở') && rep.includes('Đã thu đủ') && rep.includes('Thu một phần'), 'báo cáo: tách dòng Thu khi vào ở (đã thu đủ) và tháng sau (thu một phần)');
  ok(rep.includes('105.000') && rep.includes('150.000') && rep.includes('Còn thiếu'), 'báo cáo: hiện tiền điện, tiền nước, còn thiếu từng phòng');
  ok(rep.includes('Tiền nợ cũ của khách') && rep.includes('300.000'), 'báo cáo: nhắc Tiền nợ cũ của khách');
  await pg.click('button[data-act=rep-view][data-v=room]'); await pg.waitForTimeout(500); rep = await pg.innerText('#rep'); ok(rep.includes('Phòng 1') && (await pg.$$('.rep-group')).length >= 1, 'báo cáo: xem Theo phòng');
  await pg.screenshot({ path: OUT + '/report-room.png', fullPage: true });
  const dl0 = pg.waitForEvent('download'); await pg.click('button[data-act=rep-csv]'); const csv = fs.readFileSync(await (await dl0).path(), 'utf8'); ok(csv.includes('Thu khi vào ở') && csv.includes('Còn thiếu'), 'CSV có đủ cột chi tiết');
  // 6. Tên ngân hàng rất dài: không tràn trang (khổ điện thoại)
  await pg.setViewportSize({ width: 390, height: 844 });
  await pg.goto(H + '#/room/room-owner'); await pg.waitForSelector('form[data-form=bank]'); await pg.fill('input[name=bankName]', 'Ngân hàng Thương mại Cổ phần Đầu tư và Phát triển Việt Nam Chi nhánh Đà Nẵng'); await pg.fill('input[name=accountNumber]', '1234567890123'); await pg.fill('input[name=accountName]', 'NGUYEN VAN A'); await pg.click('form[data-form=bank] button[type=submit]'); await pg.waitForSelector('.bankview');
  const ov1 = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); await pg.goto(H + '#/invoice/' + inv.id); await pg.waitForSelector('.bbank'); const ov2 = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await pg.screenshot({ path: OUT + '/bank-mobile.png', fullPage: true }); ok(ov1 <= 0 && ov2 <= 0, `tên ngân hàng dài không làm tràn trang (Chủ Nhà ${ov1}, hóa đơn ${ov2})`);
  // 7. Nút Tải lại dữ liệu: máy khác sửa → bấm nút là thấy
  ok(await pg.isVisible('.refresh-fab'), 'có nút Tải lại dữ liệu nổi trên trang');
  const ctx2 = await b.newContext(); const p2 = await ctx2.newPage(); await p2.goto(H + '#/login'); await p2.fill('input[name=password]', '20101963'); await p2.click('button:has-text("ĐĂNG NHẬP")'); await p2.waitForSelector('.room-card');
  await p2.evaluate(async () => { const s = await fetch('/api/auth/session').then((r) => r.json()); await fetch('/api/rooms/room-5', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': s.csrf }, body: JSON.stringify({ note: 'Máy khác vừa nhập ghi chú', status: 'repair' }) }); });
  await pg.goto(H + '#/dashboard'); await pg.waitForSelector('.room-card'); ok(!(await pg.innerText('main')).includes('Máy khác vừa nhập'), 'trước khi tải lại: chưa thấy dữ liệu máy khác');
  await pg.evaluate(() => window.scrollTo(0, 900)); const y0 = await pg.evaluate(() => window.scrollY); await pg.click('.refresh-fab'); await pg.waitForTimeout(1500); console.log('   toast:', await pg.innerText('#toast').catch(() => '?'));
  ok((await pg.innerText('main')).includes('Máy khác vừa nhập') && Math.abs(await pg.evaluate(() => window.scrollY) - y0) < 5, 'bấm Tải lại dữ liệu → thấy dữ liệu máy khác, giữ nguyên vị trí đang xem');
  await pg.setViewportSize({ width: 1100, height: 1000 });
  // 8. BACKUP CĂN CƯỚC (.zip)
  await pg.goto(H + '#/backup'); await pg.waitForSelector('#cccdcard'); const dl1 = pg.waitForEvent('download'); await pg.click('button[data-act=cccd-backup]:not([data-room])'); const zipPath = '/tmp/claude-0/e2e31/cccd.zip'; await (await dl1).saveAs(zipPath);
  const listing = execSync(`python3 -c "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip());print('\\n'.join(z.namelist()))" ${zipPath}`).toString();
  ok(listing.startsWith('None') && listing.includes('Phong-1/Tran-Thi-Mai-khach-chinh-mat-truoc.jpg') && listing.includes('Phong-1/Tran-Thi-Mai-khach-chinh-mat-sau.jpg') && listing.includes('manifest.json'), 'Backup Căn Cước: file .zip hợp lệ, mỗi phòng 1 thư mục, đủ 2 mặt');
  // 9. Khôi phục JSON cũ (chưa có ảnh) → ảnh còn trên máy chủ tự nối lại
  const json = await pg.evaluate(() => fetch('/api/backup/export').then((r) => r.json())); for (const x of json.tenants) x.idImages = { front: null, back: null };
  fs.writeFileSync('/tmp/claude-0/e2e31/old.json', JSON.stringify(json)); await pg.setInputFiles('form[data-form=restore] input[name=file]', '/tmp/claude-0/e2e31/old.json'); await pg.fill('form[data-form=restore] input[name=confirm]', 'GHI DE'); await pg.click('form[data-form=restore] button[type=submit]');
  await pg.waitForTimeout(2500); const tst = await pg.innerText('#toast').catch(() => ''); console.log('   toast:', tst); ok(tst.includes('nối lại 2 ảnh CCCD'), 'thông báo cho biết đã nối lại 2 ảnh'); db = (await data()).db; const t2 = db.tenants.find((x) => x.id === t.id); ok(!!(t2.idImages.front && t2.idImages.back), 'khôi phục JSON: tự nối lại 2 ảnh CCCD còn trên máy chủ');
  const im = await pg.evaluate((id) => fetch('/api/storage/' + id).then((r) => r.status), t2.idImages.front.id); ok(im === 200, 'ảnh đã nối lại mở xem được');
  // 10. Nạp ảnh từ file .zip sau khi ảnh bị mất trên máy chủ
  await pg.evaluate(async (id) => { const s = await fetch('/api/auth/session').then((r) => r.json()); await fetch('/api/storage/' + id, { method: 'DELETE', headers: { 'X-CSRF-Token': s.csrf } }); }, t2.idImages.front.id);
  await pg.click('.refresh-fab'); await pg.waitForTimeout(800); await pg.goto(H + '#/backup'); await pg.waitForSelector('form[data-form=cccd-restore]'); ok((await pg.innerText('#cccdcard')).includes('1 ảnh còn thiếu'), 'mất ảnh mặt trước → báo còn thiếu 1 ảnh');
  await pg.setInputFiles('form[data-form=cccd-restore] input[name=file]', zipPath); await pg.click('form[data-form=cccd-restore] button[type=submit]'); await pg.waitForTimeout(3000); console.log('   toast:', await pg.innerText('#toast').catch(() => ''), '|', await pg.innerText('#cccdprog').catch(() => ''));
  db = (await data()).db; ok(!!db.tenants.find((x) => x.id === t.id).idImages.front, 'nạp file .zip: bổ sung lại đúng ảnh mặt trước, giữ ảnh đang có');
  // 11. Sửa khách: ô Tiền Nợ Cũ có sẵn số cũ; Tổng quan bấm "Sửa / đã thu"
  await pg.goto(H + '#/tenant/' + t.id); await pg.waitForSelector('button[data-act=edit-tenant]'); await pg.click('button[data-act=edit-tenant]'); await pg.waitForSelector('form[data-form=tenant-edit]');
  ok(await pg.inputValue('form[data-form=tenant-edit] input[name=od_amount]') === '300000' || await pg.inputValue('form[data-form=tenant-edit] input[name=od_amount]') === '300.000', 'Sửa khách: hiện sẵn Tiền Nợ Cũ');
  await pg.keyboard.press('Escape'); await pg.goto(H + '#/dashboard'); await pg.waitForSelector('button[data-act=old-debt-edit]'); await pg.click('button[data-act=old-debt-edit]'); await pg.click('button[data-act=old-debt-clear]'); await pg.waitForTimeout(800);
  ok(!(await pg.innerText('main')).toLowerCase().includes('tiền nợ cũ của khách'), 'bấm "Đã thu hết" → hết nhắc nợ cũ');
  // 12. Trang ngoài: có nút tải lại, không lộ nợ cũ/SĐT
  const p3 = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); await p3.goto(H); await p3.waitForSelector('#cal'); const pub = await p3.innerText('body');
  ok(await p3.isVisible('.refresh-fab') && !pub.includes('0911111111') && !pub.includes('Thiếu tiền điện'), 'trang ngoài: có nút tải lại, không lộ SĐT/nợ cũ'); await p3.screenshot({ path: OUT + '/public-mobile.png' });
  ok(!errs.length, 'không có lỗi JavaScript ' + errs.join(' | ')); await b.close();
})();
