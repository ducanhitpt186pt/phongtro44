// Ô "Ngày chốt số" khi ghi điện nước + Chủ Nhà chờ chốt theo phòng trễ nhất + trình hướng dẫn Google Sheet trong web.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('dialog', (d) => d.accept());
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) process.exitCode = 1; };
  const H = 'http://localhost:4173/';
  await pg.goto(H + '#/login'); await pg.fill('input[name=password]', '20101963'); await pg.click('button:has-text("ĐĂNG NHẬP")'); await pg.waitForSelector('.room-card');
  const d0 = await pg.evaluate(() => fetch('/api/data').then((r) => r.json())); const next = d0.derived.rentals[Object.keys(d0.derived.rentals)[0]];
  // Đồng hồ tổng mới (hôm nay) khi phòng 1 chưa ghi số mới → kỳ Chủ Nhà phải "Đang chờ chốt"
  await pg.goto(H + '#/room/room-owner'); await pg.waitForSelector('text=Chủ Nhà – đồng hồ tổng'); const last = d0.db.masterReadings.slice(-1)[0];
  await pg.click('button[data-act=master-add]'); await pg.waitForSelector('form[data-form=master]'); await pg.fill('form[data-form=master] [name=elec]', String(last.elec + 100)); await pg.fill('[name=water]', String(last.water + 5)); await pg.click('form[data-form=master] button[type=submit]'); await pg.waitForSelector('.badge:has-text("Đang chờ")');
  ok(/Phòng 1/.test(await pg.innerText('.badge:has-text("Đang chờ")')), 'kỳ Chủ Nhà mới: "Đang chờ" phòng chưa ghi số (Phòng 1), kết quả chỉ tạm tính');
  await pg.goto(H + '#/dashboard'); const dash = await pg.innerText('body'); ok(/Đang chờ chốt/.test(dash) || /chờ chốt/.test(dash), 'trên Tổng quan có ghi chú Chủ Nhà đang chờ chốt');
  // Ghi điện nước phòng 1 với "Ngày chốt số"
  await pg.goto(H + '#/room/room-1'); await pg.waitForSelector('button[data-act=readings]'); await pg.click('button[data-act=readings]'); const hasField = await pg.isVisible('input[name=readDate]');
  if (!hasField) { ok(/Chưa tới kỳ/.test(await pg.innerText('.dialog')), 'chưa tới kỳ tiếp theo (hợp lệ): ô ngày chốt số chỉ hiện khi tới kỳ'); } else ok(true, 'form ghi điện nước có ô "Ngày chốt số"');
  // trình hướng dẫn Google Sheet
  await pg.goto(H + '#/backup'); await pg.waitForSelector('.gs-help'); ok(await pg.isVisible('#gscode'), 'trang Sao lưu có hướng dẫn + mã Apps Script');
  await pg.click('button[data-act=gas-copy]'); ok(/Hãy bấm "Tạo mã bí mật"/.test(await pg.innerText('#toast')), 'chưa tạo mã bí mật thì nhắc làm trước');
  await pg.click('button[data-act=gas-secret]'); const sec = await pg.inputValue('#gssecret'); ok(/^nt44-[A-Za-z0-9]{22}$/.test(sec), 'tạo mã bí mật ngẫu nhiên: ' + sec.slice(0, 9) + '…'); ok((await pg.inputValue('#gscode')).includes(sec) && !(await pg.inputValue('#gscode')).includes('THAY-CHUOI-BI-MAT-CUA-BAN'), 'mã bí mật được điền sẵn vào đoạn mã Apps Script');
  await pg.click('button[data-act=gas-copy]'); const clip = await pg.evaluate(() => navigator.clipboard.readText()); ok(clip.includes(sec) && clip.includes('function doPost') && !/deleteRow|clearContent/.test(clip), 'sao chép mã Apps Script vào clipboard (đã kèm mã bí mật, không có lệnh xóa)');
  console.log(errs.length ? 'LỖI JS: ' + errs.join('|') : 'Không có lỗi JS'); await b.close(); })().catch((e) => { console.error('E2E11 LỖI', e.message.slice(0, 900)); process.exit(1); });
