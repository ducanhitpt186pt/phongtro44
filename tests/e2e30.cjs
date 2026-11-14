// Mục 2026-11-30-c: bấm thẻ Nhắc nợ → chi tiết; nút Thu nợ giữ nguyên; trang chủ: Điện – nước nằm sau Lịch
const fs = require('fs');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const OUT = '/tmp/claude-0/e2e30'; fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--no-sandbox'] }); const pg = await (await b.newContext({ viewport: { width: 1100, height: 1000 } })).newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('dialog', (d) => d.accept());
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) process.exitCode = 1; }; const H = 'http://localhost:4173/';
  await pg.goto(H); await pg.waitForSelector('#cal');
  const pos = await pg.evaluate(() => { const t = [...document.querySelectorAll('.sum-title')].find((x) => x.textContent.includes('ĐIỆN – NƯỚC')); return { cal: document.querySelector('#pubcal').getBoundingClientRect().top, u: t ? t.getBoundingClientRect().top : -1, undef: document.body.innerText.includes('undefined') }; });
  ok(pos.u > pos.cal && !pos.undef, 'trang chủ: khối Điện – nước nằm sau Lịch');
  await pg.goto(H + '#/login'); await pg.fill('input[name=password]', '20101963'); await pg.click('button:has-text("ĐĂNG NHẬP")'); await pg.waitForSelector('.room-card');
  await pg.click('a[data-tab=debts]'); await pg.waitForSelector('button[data-act=debt-add]'); await pg.click('button[data-act=debt-add]'); await pg.waitForSelector('form[data-form=debt]');
  await pg.fill('form[data-form=debt] input[name=name]', 'Anh Tư'); await pg.fill('form[data-form=debt] input[name=amount]', '2000000'); await pg.fill('form[data-form=debt] textarea[name=note]', 'Mượn mua xi măng\nhẹn cuối tháng'); await pg.click('form[data-form=debt] button[type=submit]'); await pg.waitForTimeout(800);
  await pg.click('button[data-act=debt-pay]'); await pg.waitForSelector('form[data-form=debt-pay]'); await pg.check('input[name=mode][value=part]'); await pg.fill('form[data-form=debt-pay] input[name=amount]', '500000'); await pg.click('form[data-form=debt-pay] button[type=submit]'); await pg.waitForTimeout(800);
  await pg.click('a[data-tab=dashboard]'); await pg.waitForSelector('article[data-act=debt-detail]');
  await pg.click('article[data-act=debt-detail] h3'); await pg.waitForSelector('#modal :text("Chi tiết khoản nợ")');
  const t = await pg.innerText('#modal'); await pg.screenshot({ path: OUT + '/detail.png' });
  ok(t.includes('Anh Tư') && t.includes('2.000.000') && t.includes('500.000') && t.includes('1.500.000') && t.includes('Mượn mua xi măng'), 'bấm thẻ nhắc nợ → hiện đủ chi tiết (số nợ, đã thu, còn nợ, ghi chú, lịch sử)');
  await pg.click('#modal button[data-act=debt-pay]'); await pg.waitForSelector('form[data-form=debt-pay]'); ok(true, 'nút Thu nợ trong hộp chi tiết mở form thu nợ');
  await pg.keyboard.press('Escape'); await pg.goto(H + '#/'); await pg.waitForSelector('article[data-act=debt-detail]'); await pg.waitForTimeout(300);
  await pg.click('article[data-act=debt-detail] button[data-act=debt-pay]'); await pg.waitForSelector('form[data-form=debt-pay]');
  ok(!(await pg.innerText('#modal')).includes('Chi tiết khoản nợ'), 'nút Thu nợ trên thẻ vẫn mở thẳng form thu nợ như cũ');
  await pg.screenshot({ path: OUT + '/pay.png' });
  ok(!errs.length, 'không có lỗi JavaScript ' + errs.join(' | ')); await b.close();
})();
