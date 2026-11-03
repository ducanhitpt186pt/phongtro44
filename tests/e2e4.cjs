// Trang ngoài: chữ nhỏ cạnh tiêu đề, bản lưu trên máy khi mất kết nối máy chủ.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); const pg = await (await b.newContext({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 2 })).newPage();
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) process.exitCode = 1; };
  await pg.goto('http://localhost:4173/'); await pg.waitForSelector('.pub-head .credit');
  const fs = await pg.$eval('.pub-head .credit', (e) => [getComputedStyle(e).fontSize, getComputedStyle(document.documentElement).fontSize, e.textContent]);
  ok(fs[2] === 'ducanhitpt186' && parseFloat(fs[0]) === parseFloat(fs[1]) * 0.5, `chữ "${fs[2]}" cạnh tiêu đề, cỡ ${fs[0]} = 0,5rem`);
  await pg.waitForSelector('text=Cập nhật lúc'); await pg.screenshot({ path: '/tmp/shots/30-public-credit.png' });
  await pg.route('**/api/public/reminders', (r) => r.abort()); await pg.goto('http://localhost:4173/#/login'); await pg.goto('http://localhost:4173/#/');
  await pg.waitForSelector('text=bản lưu trên máy'); ok(await pg.isVisible('text=TỔNG QUAN CẦN XỬ LÝ'), 'mất kết nối máy chủ → vẫn hiện bản lưu gần nhất kèm ghi chú');
  const ls = await pg.evaluate(() => localStorage.getItem('nt44_pub_v1') || ''); ok(!/cccd|phone|fullName|tenant/i.test(ls), 'bản lưu trên máy không chứa thông tin khách');
  await pg.goto('http://localhost:4173/#/login'); await pg.waitForSelector('.login .credit'); ok(true, 'màn hình đăng nhập có chữ nhỏ cạnh tiêu đề');
  await b.close(); })();
