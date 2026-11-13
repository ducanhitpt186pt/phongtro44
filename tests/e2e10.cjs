// Lịch tháng âm/dương, ngày lễ, sự kiện (thêm/sửa/xóa, lặp, màu, rê chuột), thông báo trước 3 ngày, 3 cỡ màn hình, thẻ Google Sheet.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('dialog', (d) => d.accept());
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) process.exitCode = 1; };
  const H = 'http://localhost:4173/'; const VN = (n = 0) => { const d = new Date(Date.now() + 7 * 3600e3 + n * 86400000); return d.toISOString().slice(0, 10); };
  await pg.goto(H); await pg.waitForSelector('#pubcal .cal-days');
  const pos = await pg.evaluate(() => ({ btn: document.querySelector('.pub-foot a.btn').getBoundingClientRect().bottom, cal: document.querySelector('#pubcal .cal').getBoundingClientRect().top }));
  ok(pos.cal > pos.btn, 'lịch tháng nằm DƯỚI nút "Ghi Điện & Nước - Tính Tiền Phòng"');
  const info = await pg.evaluate(() => ({ cells: document.querySelectorAll('#pubcal .cd:not(.blank)').length, lunar1: [...document.querySelectorAll('#pubcal .ld.m1')].map((e) => e.textContent), today: document.querySelectorAll('#pubcal .cd.today').length, title: document.querySelector('#pubcal h2').textContent, wd: document.querySelector('#pubcal .cal-wd').textContent }));
  ok(info.cells >= 28 && info.today === 1 && info.lunar1.length >= 1 && /T2T3T4T5T6T7CN/.test(info.wd), `lịch có ${info.cells} ngày, mỗi ô có ngày âm (mùng 1: ${info.lunar1.join(',')}), tuần bắt đầu T2, hôm nay được tô; "${info.title}"`);
  ok((await pg.innerText('#pubcal')).includes('Nhà giáo Việt Nam') || (await pg.innerText('#pubcal')).includes('Ngày lễ & sự kiện trong tháng'), 'có mục "Ngày lễ & sự kiện trong tháng"');
  await pg.click('#pubcal [data-act=cal-next]'); await pg.waitForSelector('#pubcal h2:has-text("Tháng")'); ok(!(await pg.url()).includes('login') && (await pg.locator('#pubcal .cal').count()) === 1, 'bấm tháng sau: lịch đổi tháng mà không tải lại trang');
  await pg.click('#pubcal [data-act=cal-today]');
  // đăng nhập, thêm sự kiện
  await pg.goto(H + '#/login'); await pg.fill('input[name=password]', '20101963'); await pg.click('button:has-text("ĐĂNG NHẬP")'); await pg.waitForSelector('.room-card'); await pg.goto(H + '#/dashboard'); await pg.waitForSelector('.cal');
  await pg.click('.cal button[data-act=ev-add] >> nth=0'); ok(await pg.isChecked('input[name=repeat][value="1"]'), 'mặc định "lặp lại hằng năm"');
  await pg.click('#modal button.x'); ok((await pg.locator('#modal .dialog').count()) === 0, 'nút ✕ đóng được hộp thoại'); await pg.click('.cal button[data-act=ev-add] >> nth=0');
  await pg.fill('[name=name]', 'Họp tổ dân phố'); ok(await pg.isChecked('input[name=calendar][value=lunar]'), 'sự kiện mới mặc định theo LỊCH ÂM'); await pg.check('input[name=calendar][value=solar]'); await pg.fill('[name=sdate]', VN(2)); await pg.fill('[name=note]', 'BÍ MẬT-GHI-CHÚ'); await pg.check('input[name=color][value="#ff3b30"]', { force: true }); await pg.waitForSelector('#ev-prev:has-text("Âm lịch tương ứng")'); ok(true, 'xem trước ngày âm khi chọn ngày dương');
  await pg.click('form[data-form=event] button[type=submit]'); await pg.waitForSelector('.evbanner .evn:has-text("Họp tổ dân phố")'); ok((await pg.innerText('.evbanner')).includes('Còn 2 ngày'), 'thông báo ở đầu trang: "Còn 2 ngày" (trước 3 ngày)');
  // sự kiện âm lịch
  await pg.click('.cal button[data-act=ev-add] >> nth=-1'); await pg.fill('[name=name]', 'Rằm tháng này'); await pg.check('input[name=calendar][value=lunar]'); await pg.selectOption('[name=lday]', '15'); await pg.selectOption('[name=lmonth]', '10'); await pg.waitForSelector('#ev-prev:has-text("Dương lịch năm")'); const pv = await pg.innerText('#ev-prev'); ok(/\d{2}\/\d{2}\/\d{4}/.test(pv), 'sự kiện âm lịch: xem trước ngày dương tương ứng (' + pv.replace(/\n/g, ' ') + ')'); await pg.click('form[data-form=event] button[type=submit]'); await pg.waitForSelector('text=Rằm tháng này');
  // hôm nay → "Hôm nay"; hôm qua (1 lần) và 4 ngày tới → không thông báo
  for (const [name, d, rep] of [['Việc hôm nay', VN(0), true], ['Việc hôm qua một lần', VN(-1), false], ['Việc 4 ngày nữa', VN(4), true]]) { await pg.click('.cal button[data-act=ev-add] >> nth=-1'); await pg.fill('[name=name]', name); await pg.check('input[name=calendar][value=solar]'); await pg.fill('[name=sdate]', d); if (!rep) await pg.check('input[name=repeat][value="0"]'); await pg.click('form[data-form=event] button[type=submit]'); await pg.waitForSelector(`text=${name}`); }
  const ban = await pg.innerText('.evbanner'); ok(ban.includes('Việc hôm nay') && ban.includes('Hôm nay') && !ban.includes('hôm qua') && !ban.includes('4 ngày nữa'), 'thông báo: hôm nay có; sự kiện đã qua và còn 4 ngày thì không');
  // rê chuột
  await pg.goto(H + '#/dashboard'); await pg.waitForSelector('.cal'); const cell = pg.locator(`.cd[data-date="${VN(2)}"]`); await cell.hover(); const tip = await cell.evaluate((e) => getComputedStyle(e, '::after').content); ok(tip.includes('Họp tổ dân phố') && tip.includes(VN(2).split('-').reverse().join('/')), 'rê vào ô: hiện tên sự kiện + ngày diễn ra (' + tip.slice(0, 60) + ')');
  const col = await cell.evaluate((e) => getComputedStyle(e).getPropertyValue('--c').trim()); ok(col === '#ff3b30', 'ô lịch có màu của sự kiện (' + col + ')');
  await cell.click(); await pg.waitForSelector('#caldetail:has-text("Họp tổ dân phố")'); ok(true, 'chạm/bấm vào ngày: hiện chi tiết (dùng cho điện thoại/iPad không có rê chuột)');
  // sửa + xóa
  await pg.click('#caldetail button[data-act=ev-edit]'); await pg.fill('[name=name]', 'Họp tổ (đã sửa)'); await pg.click('form[data-form=event] button[type=submit]'); await pg.waitForSelector('text=Họp tổ (đã sửa)'); ok(true, 'sửa sự kiện');
  await pg.locator('.li:has-text("Việc 4 ngày nữa") button[data-act=ev-del]').click(); await pg.waitForTimeout(700); ok(!(await pg.innerText('.cal')).includes('Việc 4 ngày nữa'), 'xóa sự kiện');
  ok((await pg.innerText('.cal')).includes('Danh sách sự kiện cần nhớ'), 'có "Danh sách sự kiện cần nhớ"');
  // trang ngoài (chưa đăng nhập)
  const p2 = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage(); await p2.goto(H); await p2.waitForSelector('#pubcal .cal'); await p2.waitForSelector('#pubbanner .evn'); const t2 = await p2.innerText('body');
  ok(t2.includes('Họp tổ (đã sửa)') && t2.includes('Việc hôm nay') && !t2.includes('BÍ MẬT-GHI-CHÚ'), 'trang ngoài: thấy sự kiện + thông báo đầu trang, KHÔNG thấy ghi chú'); ok((await p2.locator('#pubcal button[data-act=ev-add]').count()) === 0 && (await p2.locator('#pubcal button[data-act=ev-edit]').count()) === 0, 'chưa đăng nhập: không có nút thêm/sửa/xóa sự kiện');
  // thẻ Google Sheet
  await pg.goto(H + '#/backup'); await pg.waitForSelector('text=Sao lưu vào Google Sheet'); ok((await pg.innerText('body')).includes('Chưa kết nối'), 'trang Sao lưu: thẻ Google Sheet báo "Chưa kết nối" khi chưa cấu hình');
  // ba cỡ màn hình: điện thoại, iPad dọc/ngang, máy tính — không tràn ngang
  const sizes = [[390, 844, 'phone'], [820, 1180, 'ipad-dung'], [1180, 820, 'ipad-ngang'], [1440, 900, 'pc']]; const bad = [];
  for (const [w, h, name] of sizes) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); const q = await c.newPage(); await q.goto(H); await q.waitForSelector('#pubcal .cal-days'); const ov = async (label) => { const x = await q.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (x > 1) bad.push(`${name}/${label} tràn ${x}px`); };
    await ov('trang-ngoai'); await q.screenshot({ path: `/tmp/shots/90-${name}-public.png`, fullPage: true });
    await q.goto(H + '#/login'); await q.fill('input[name=password]', '20101963'); await q.click('button:has-text("ĐĂNG NHẬP")'); await q.waitForSelector('.room-card');
    for (const r of ['dashboard', 'calendar', 'tenants', 'reports', 'backup', 'room/room-1']) { await q.goto(H + '#/' + r); await q.waitForTimeout(500); await ov(r); if (r === 'calendar') await q.screenshot({ path: `/tmp/shots/91-${name}-calendar.png`, fullPage: true }); }
    await c.close();
  }
  ok(bad.length === 0, 'không tràn ngang ở điện thoại / iPad dọc / iPad ngang / máy tính ' + (bad.length ? bad.join('; ') : '(6 trang × 4 cỡ)'));
  console.log(errs.length ? 'LỖI JS: ' + errs.join('|') : 'Không có lỗi JS'); await b.close();
})().catch((e) => { console.error('E2E10 LỖI', e.message.slice(0, 500)); process.exit(1); });
