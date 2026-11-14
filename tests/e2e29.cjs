// Mục tinh chỉnh 2026-11-30-b
const fs = require('fs');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const OUT = '/tmp/claude-0/e2e29'; fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--no-sandbox'] }); const ctx = await b.newContext({ viewport: { width: 1100, height: 1000 } }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('dialog', (d) => d.accept());
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) process.exitCode = 1; }; const H = 'http://localhost:4173/';
  const data = () => pg.evaluate(() => fetch('/api/data').then((x) => x.json()));
  await pg.goto(H + '#/login'); await pg.fill('input[name=password]', '20101963'); await pg.click('button:has-text("ĐĂNG NHẬP")'); await pg.waitForSelector('.room-card');
  const nav = (await pg.locator('nav.nav a').allInnerTexts()).map((s) => s.trim()); ok(JSON.stringify(nav) === JSON.stringify(['Tổng quan', 'Khách thuê', 'Báo Cáo Tiền Trọ', 'Nhắc Nợ (Riêng)', 'Thu Chi (Riêng)', 'Sao lưu']), 'thứ tự tab: ' + nav.join(' | '));
  const dash = await pg.innerHTML('main'); ok(dash.indexOf('dash-cal') < dash.search(/SO VỚI THÁNG TRƯỚC|so với tháng trước/i) || !/so với tháng trước/i.test(dash), 'điện nước so với tháng trước nằm dưới lịch');
  // thêm khách + người ở cùng
  await pg.goto(H + '#/room/room-3'); await pg.waitForSelector('button[data-act=movein]'); await pg.click('button[data-act=movein]'); await pg.waitForSelector('form[data-form=movein]'); const F = 'form[data-form=movein] ';
  await pg.fill(F + 'input[name=fullName]', 'Lê Văn Bình'); await pg.fill(F + 'input[name=dob]', '1988-01-02'); await pg.fill(F + 'input[name=phone]', '0933444555'); await pg.check(F + 'input[name=gender][value=male]'); await pg.fill(F + 'input[name=cccd]', '001088000999'); await pg.fill(F + 'input[name=cccdIssueDate]', '2021-01-01'); await pg.fill(F + 'input[name=cccdIssuePlace]', 'CA'); await pg.fill(F + 'input[name=address]', 'Hà Nội');
  const start = new Date(Date.now() + 7 * 3600e3 - 3 * 86400000).toISOString().slice(0, 10); await pg.fill(F + 'input[name=initElec]', '100'); await pg.fill(F + 'input[name=initWater]', '10'); await pg.fill(F + 'input[name=startDate]', start); await pg.fill(F + 'input[name=rent]', '2500000'); await pg.fill(F + 'input[name=elecPrice]', '3500'); await pg.fill(F + 'input[name=waterPrice]', '15000');
  await pg.click(F + 'input[name=deposit]'); await pg.keyboard.type('1000000'); ok((await pg.inputValue(F + 'input[name=deposit]')) === '1.000.000', 'ô đặt cọc tự ngăn cách 1.000.000');
  await pg.click(F + 'button[type=submit]'); await pg.waitForTimeout(1200); console.log('ERR:', await pg.evaluate(() => [...document.querySelectorAll('form[data-form=movein] :invalid')].map((e) => e.name + '=' + e.validationMessage).join(';'))); await pg.goto(H + '#/room/room-3'); await pg.waitForSelector('button[data-act=add-occupant]');
  ok(await pg.locator('button[data-act=edit-tenant]').count() > 0, 'trang phòng có nút Sửa thông tin người đăng ký');
  ok(await pg.locator('button.amber[data-act=ct01]').count() > 0, 'nút CT01 màu cam/vàng (amber)');
  await pg.click('button[data-act=add-occupant]'); await pg.waitForSelector('form[data-form=occupant-add]');
  const tdy = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); ok((await pg.inputValue('input[name=o_from]')) === tdy, 'ngày bắt đầu ở mặc định = hôm nay');
  const OF = 'form[data-form=occupant-add] '; await pg.fill(OF + 'input[name=o_name]', 'Lê Thị Cúc'); await pg.fill(OF + 'input[name=o_dob]', '1990-02-03'); await pg.fill(OF + 'input[name=o_cccd]', '001190000111'); await pg.fill(OF + 'input[name=o_issue_date]', '2022-05-06'); await pg.fill(OF + 'input[name=o_issue_place]', 'Cục CS QLHC'); await pg.fill(OF + 'input[name=o_address]', 'Nam Định'); await pg.click(OF + 'button[type=submit]'); await pg.waitForTimeout(900);
  let d = await data(); const oc = d.db.occupants.find((x) => x.fullName === 'Lê Thị Cúc'); ok(oc && oc.cccdIssueDate === '2022-05-06' && oc.cccdIssuePlace === 'Cục CS QLHC', 'lưu ngày cấp + nơi cấp người ở cùng');
  await pg.locator('button[data-act=edit-occupant]').first().click(); await pg.waitForSelector('form[data-form=occupant-edit]'); await pg.fill('form[data-form=occupant-edit] input[name=o_hometown]', 'Hải Hậu'); await pg.click('form[data-form=occupant-edit] button[type=submit]'); await pg.waitForTimeout(800);
  d = await data(); ok(d.db.occupants.find((x) => x.fullName === 'Lê Thị Cúc').hometown === 'Hải Hậu', 'sửa người ở cùng từ trang phòng');
  await pg.click('button[data-act=edit-tenant]'); await pg.waitForSelector('form[data-form=tenant-edit]'); await pg.fill('form[data-form=tenant-edit] input[name=hometown]', 'Thái Bình'); await pg.click('form[data-form=tenant-edit] button[type=submit]'); await pg.waitForTimeout(800); d = await data(); ok(d.db.tenants.find((x) => x.fullName === 'Lê Văn Bình').hometown === 'Thái Bình', 'sửa quê quán khách từ trang phòng');
  // hợp đồng: chọn từ ngày – đến ngày trực tiếp
  await pg.click('button[data-act=contract]'); await pg.waitForSelector('#modal input[name=termTo]');
  ok((await pg.inputValue('#modal input[name=deposit]')) === '1.000.000', 'ô cọc trong hợp đồng hiện 1.000.000');
  await pg.fill('#modal input[name=termFrom2]', '2026-12-01'); ok(await pg.isChecked('#modal input[name=termMode][value=range]'), 'chọn ngày ở dòng 2 tự tích "Từ ngày … đến ngày"'); await pg.fill('#modal input[name=termTo]', '2027-06-30');
  await pg.evaluate(() => document.querySelector('button[data-act=contract-docx]').click()); await pg.waitForTimeout(1200);
  const rid = d.db.rentals.find((x) => x.roomId === 'room-3' && x.status === 'active').id; const h = (await pg.evaluate((id) => fetch('/api/contract/' + id + '?format=html').then((r) => r.text()), rid)).replace(/<[^>]+>/g, '');
  ok(/Từ ngày 01\/12\/2026 đến ngày 30\/06\/2027/.test(h), 'hợp đồng: Từ ngày 01/12/2026 đến ngày 30/06/2027'); ok(/Một triệu không trăm ngàn đồng/.test(h), 'tiền cọc đọc: Một triệu không trăm ngàn đồng');
  await pg.screenshot({ path: OUT + '/room.png', fullPage: true });
  await pg.goto(H + '#/debts'); await pg.waitForSelector('.ktile'); ok((await pg.locator('.ktile').count()) === 2 && !(await pg.innerText('main')).includes('Tổng Cần Thu còn lại'), 'Nhắc Nợ: 2 ô Cần Thu (xanh) / Cần Trả (đỏ), không còn khối thừa'); await pg.screenshot({ path: OUT + '/debts.png' });
  ok(errs.length === 0, 'không lỗi JS: ' + errs.join('|')); await b.close();
})();
