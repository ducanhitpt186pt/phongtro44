// Cần Thu / Cần Trả + Quản Lý Thu Chi + CT01 chữ ký.
const fs = require('fs');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const OUT = '/tmp/claude-0/e2e28'; fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--no-sandbox'] }); const ctx = await b.newContext({ viewport: { width: 1100, height: 1000 } }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  let promptText = ''; pg.on('dialog', (d) => d.accept(d.type() === 'prompt' ? promptText : undefined));
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) process.exitCode = 1; }; const H = 'http://localhost:4173/';
  const data = () => pg.evaluate(() => fetch('/api/data').then((x) => x.json()));
  await pg.goto(H + '#/login'); await pg.fill('input[name=password]', '20101963'); await pg.click('button:has-text("ĐĂNG NHẬP")'); await pg.waitForSelector('.room-card');
  // --- Cần Thu / Cần Trả ---
  await pg.click('a[data-tab=debts]'); await pg.waitForSelector('button[data-act=debt-kind]');
  ok((await pg.locator('button[data-act=debt-kind]').allInnerTexts()).join('|').includes('Cần Thu') && (await pg.locator('button[data-act=debt-kind]').allInnerTexts()).join('|').includes('Cần Trả'), 'có hai mục Cần Thu và Cần Trả');
  await pg.click('button[data-act=debt-add]'); await pg.waitForSelector('form[data-form=debt]'); ok(await pg.isChecked('form[data-form=debt] input[value=receivable]'), 'mặc định Cần Thu');
  await pg.fill('form[data-form=debt] input[name=name]', 'Chị Lan'); await pg.fill('form[data-form=debt] input[name=amount]', '500000'); await pg.click('form[data-form=debt] button[type=submit]'); await pg.waitForTimeout(700);
  await pg.click('button[data-act=debt-kind][data-kind=payable]'); await pg.click('button[data-act=debt-add]'); await pg.waitForSelector('form[data-form=debt]'); ok(await pg.isChecked('form[data-form=debt] input[value=payable]'), 'đang ở Cần Trả → mặc định Cần Trả');
  await pg.fill('form[data-form=debt] input[name=name]', 'Cửa hàng điện'); await pg.fill('form[data-form=debt] input[name=amount]', '2000000'); await pg.click('form[data-form=debt] button[type=submit]'); await pg.waitForTimeout(700);
  let d = await data(); ok(d.derived.debts.remaining === 500000 && d.derived.debts.payable.remaining === 2000000 && d.derived.debts.openAll === 2, 'thống kê tách riêng: Cần Thu 500.000, Cần Trả 2.000.000');
  const pub = await pg.evaluate(() => fetch('/api/public/reminders').then((r) => r.json())); ok(pub.debts.total === 500000 && !JSON.stringify(pub.debts).includes('Cửa hàng'), 'trang chủ chỉ hiện Cần Thu, không lộ khoản mình nợ');
  await pg.goto(H + '#/dashboard'); await pg.waitForSelector('button[data-act=debt-pay]'); const dt = await pg.innerText('main'); ok(/cần thu/i.test(dt) && /cần trả/i.test(dt), 'Tổng quan nhắc cả Cần Thu và Cần Trả');
  await pg.locator('button[data-act=debt-pay]').last().click(); await pg.waitForSelector('form[data-form=debt-pay]'); await pg.click('form[data-form=debt-pay] button[type=submit]'); await pg.waitForTimeout(700);
  d = await data(); ok(d.derived.debts.openAll === 1, 'bấm xác nhận → khoản đó hết nợ');
  // --- Thu chi ---
  await pg.click('a[data-tab=ledger]'); await pg.waitForSelector('button[data-act=led-add]'); ok(/Quản Lý Thu Chi/i.test(await pg.innerText('main')), 'có tab Quản Lý Thu Chi');
  const add = async (type, amount, cat, date) => { await pg.click(`button[data-act=led-add][data-type=${type}]`); await pg.waitForSelector('form[data-form=ledger]'); if (date) await pg.fill('form[data-form=ledger] input[name=date]', date); await pg.fill('form[data-form=ledger] input[name=amount]', String(amount)); await pg.fill('form[data-form=ledger] input[name=category]', cat); await pg.click('form[data-form=ledger] button[type=submit]'); await pg.waitForTimeout(700); };
  await add('income', 1000000, 'Tiền phòng', '2025-06-15'); await add('income', 3000000, 'Tiền phòng'); await add('expense', 500000, 'Sửa chữa');
  d = await data(); ok(d.derived.ledger.income === 4000000 && d.derived.ledger.expense === 500000 && d.derived.ledger.years.length === 2, 'thống kê thu 4.000.000 / chi 500.000 / 2 năm');
  const t = await pg.innerText('main'); ok(/2\.500\.000/.test(t), 'chênh lệch tháng hiện tại 2.500.000 hiển thị');
  await pg.locator('button[data-act=led-edit]').first().click(); await pg.waitForSelector('form[data-form=ledger]'); await pg.fill('form[data-form=ledger] input[name=amount]', '600000'); await pg.click('form[data-form=ledger] button[type=submit]'); await pg.waitForTimeout(700);
  d = await data(); ok(d.db.ledger.some((e) => e.amount === 600000), 'sửa khoản thu chi'); await pg.screenshot({ path: OUT + '/ledger.png', fullPage: true });
  await pg.locator('button[data-act=led-del]').first().click(); await pg.waitForTimeout(700); d = await data(); ok(d.db.ledger.length === 2, 'xóa một khoản');
  const pubd = JSON.stringify(await pg.evaluate(() => fetch('/api/public/reminders').then((r) => r.json()))); ok(!/ledger|Tiền phòng/.test(pubd), 'trang ngoài không có dữ liệu thu chi');
  await pg.selectOption('#led-delyear', '2025'); promptText = '2024'; await pg.click('button[data-act=led-delyear]'); await pg.waitForTimeout(600); d = await data(); ok(d.db.ledger.length === 2, 'gõ sai năm → không xóa');
  promptText = '2025'; await pg.click('button[data-act=led-delyear]'); await pg.waitForTimeout(800); d = await data(); ok(d.db.ledger.length === 1 && !d.db.ledger.some((e) => e.date.startsWith('2025')), 'xóa theo năm 2025 sau khi xác nhận');
  ok(errs.length === 0, 'không lỗi JS: ' + errs.join('|')); await b.close();
})();
