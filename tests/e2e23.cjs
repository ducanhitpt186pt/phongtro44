// Phòng khóa nền xám + icon khóa lớn; trang ngoài: chuông + bấm phòng còn nợ → đăng nhập thanh toán; Chủ Nhà luôn có trong điện nước; ngưỡng 20%; nhật ký 10 dòng + Xem thêm.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('dialog', (d) => d.accept());
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) process.exitCode = 1; }; const H = 'http://localhost:4173/';
  const call = async (m, p, body) => { const c = await pg.evaluate(() => fetch('/api/auth/session').then((r) => r.json()).then((j) => j.csrf)); return pg.evaluate(([m, p, body, c]) => fetch('/api/' + p, { method: m, headers: { 'content-type': 'application/json', 'x-csrf-token': c }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json()), [m, p, body, c]); };
  const get = () => pg.evaluate(() => fetch('/api/data').then((r) => r.json()));
  await pg.goto(H + '#/login'); await pg.fill('input[name=password]', '20101963'); await pg.click('button:has-text("ĐĂNG NHẬP")'); await pg.waitForSelector('.room-card');
  // ---- phòng khóa ----
  await call('PUT', 'rooms/room-5', { status: 'notready', note: 'Đang Bán Trứng' }); await call('PUT', 'rooms/room-6', { status: 'repair', note: 'Thay ống nước' }); await pg.reload(); await pg.waitForSelector('.room-card');
  const lk = await pg.evaluate(() => { const c = document.querySelector('.room-card.st-gray'); const m = c.querySelector('.lockmark'); const r = m.getBoundingClientRect(); return { bg: getComputedStyle(c).backgroundColor, w: Math.round(r.width), svg: !!m.querySelector('svg'), n: document.querySelectorAll('.room-card.st-gray .lockmark').length }; });
  ok(lk.bg === 'rgb(236, 239, 243)' && lk.svg && lk.w >= 100 && lk.n === 1, `phòng khóa: nền xám nhạt (${lk.bg}) + icon khóa lớn (${lk.w}px) chỉ ở phòng khóa`);
  ok((await pg.locator('.room-card.st-red .lockmark').count()) === 0, 'phòng sửa chữa (đỏ) không có icon khóa');
  // ---- trang ngoài: khách Phòng 4 còn nợ (đã ghi điện nước) ----
  const x = new Date(Date.now() + 7 * 3600e3 + 3 * 86400000); x.setUTCMonth(x.getUTCMonth() - 1);
  await call('POST', 'tenants', { roomId: 'room-4', startDate: x.toISOString().slice(0, 10), paidAlready: true, rent: 1000000, elecPrice: 3000, waterPrice: 10000, initElec: 100, initWater: 10, tenant: { fullName: 'Khách Tư', dob: '1990-01-01', gender: 'male', phone: '0900000004', cccd: '001090000004', cccdIssueDate: '2020-01-01', cccdIssuePlace: 'HN', address: 'HN' } });
  let d = await get(); const r4 = d.db.rentals.find((r) => r.roomId === 'room-4' && r.status === 'active'); await call('POST', 'readings', { rentalId: r4.id, periodIndex: d.derived.rentals[r4.id].periods[0].index, elecNew: 150, waterNew: 15 });
  const p2 = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); await p2.goto(H); await p2.waitForSelector('#pubbell'); await p2.waitForSelector('.note');
  const bell = await p2.evaluate(() => { const b = document.querySelector('#pubbell'); return { n: b.querySelector('.bn').textContent, zero: b.classList.contains('zero'), svg: !!b.querySelector('svg'), notes: document.querySelectorAll('.notices .note').length }; });
  ok(bell.svg && bell.n === String(bell.notes) && Number(bell.n) >= 1 && !bell.zero, `trang ngoài: icon chuông + số thông báo (${bell.n}) hiện ở đầu trang`);
  await p2.click('#pubbell'); await p2.waitForTimeout(500); ok((await p2.evaluate(() => document.querySelector('#pubnotices').getBoundingClientRect().top)) < 400, 'bấm chuông: cuộn tới "Tổng quan cần xử lý"');
  await p2.locator('.note', { hasText: 'PHÒNG 4' }).click(); await p2.waitForSelector('#modal .dialog'); const dl = await p2.innerText('#modal .dialog'); ok(/Đăng nhập để thanh toán/.test(dl) && /thanh toán/.test(dl), 'bấm phòng còn nợ ở trang ngoài: yêu cầu ĐĂNG NHẬP để thanh toán');
  await p2.click('button[data-act=pub-login]'); await p2.fill('input[name=password]', '20101963'); await p2.click('button:has-text("ĐĂNG NHẬP")'); await p2.waitForSelector('button[data-act=pay], button[data-act=pay-month]'); ok((await p2.url()).includes('#/room/room-4'), 'đăng nhập xong vào thẳng Phòng 4 để thanh toán');
  // ---- điện nước có cả Chủ Nhà (kể cả chưa có số liệu) ----
  await pg.goto(H + '#/dashboard'); await pg.reload(); await pg.waitForSelector('.ucard'); const un = await pg.innerText('.ucard.owner'); ok(/Chủ Nhà/.test(un) && /Chưa có số liệu/.test(un), 'phần "Điện – nước các phòng so với tháng trước" luôn có thẻ Chủ Nhà (chưa có số: hướng dẫn nhập)');
  await p2.goto(H); await p2.waitForSelector('.ucard'); await p2.evaluate(() => sessionStorage.clear()); ok(/Chủ Nhà/.test(await p2.innerText('body')) , 'trang ngoài cũng có Chủ Nhà trong phần điện nước');
  // ---- ngưỡng 20% ----
  d = await get(); ok(d.derived.usage.threshold === 20 && /quá 20%/.test(await pg.innerText('body')), 'cảnh báo rò rỉ khi tăng quá 20% (hiện ghi chú 20%)');
  // ---- nhật ký 10 dòng + Xem thêm ----
  for (let i = 0; i < 14; i++) await call('POST', 'rooms', { name: 'Phòng log ' + i });
  await pg.goto(H + '#/backup'); await pg.reload(); await pg.waitForSelector('#loglist'); ok((await pg.locator('#loglist .li').count()) === 10, 'nhật ký thao tác: chỉ hiện 10 dòng mới nhất'); const more = await pg.innerText('button[data-act=logs-more]'); ok(/Xem thêm \(còn \d+ dòng\)/.test(more), 'có nút "Xem thêm (còn … dòng)"');
  await pg.click('button[data-act=logs-more]'); await pg.waitForTimeout(400); const n2 = await pg.locator('#loglist .li').count(); ok(n2 > 10 && n2 <= 30, `bấm Xem thêm: hiện thêm dòng (${n2})`); await pg.click('button[data-act=logs-less]'); await pg.waitForTimeout(300); ok((await pg.locator('#loglist .li').count()) === 10, 'Thu gọn về 10 dòng');
  console.log(errs.length ? 'LỖI JS: ' + errs.join('|') : 'Không có lỗi JS'); await b.close(); })().catch((e) => { console.error('E2E23 LỖI', e.message.slice(0, 600)); process.exit(1); });
