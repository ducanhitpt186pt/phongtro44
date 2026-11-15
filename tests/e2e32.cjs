// Số thông báo PHẢI giống nhau ở mọi nơi (chuông trong app, số trên biểu tượng app, chuông trang ngoài, thông báo mỗi sáng) và về 0 khi làm xong hết việc
const { execSync } = require('child_process'); const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] }); const ctx = await b.newContext({ viewport: { width: 1100, height: 1000 } });
  await ctx.addInitScript(() => { window.__badge = []; navigator.setAppBadge = (n) => { window.__badge.push(n); return Promise.resolve(); }; navigator.clearAppBadge = () => { window.__badge.push(0); return Promise.resolve(); }; });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('dialog', (d) => d.accept());
  const pubCtx = await b.newContext({ viewport: { width: 390, height: 844 } }); await pubCtx.addInitScript(() => { window.__badge = []; navigator.setAppBadge = (n) => { window.__badge.push(n); return Promise.resolve(); }; navigator.clearAppBadge = () => { window.__badge.push(0); return Promise.resolve(); }; }); const pub = await pubCtx.newPage();
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) process.exitCode = 1; }; const H = 'http://localhost:4173/';
  const day = (k) => new Date(Date.now() + 7 * 3600e3 + k * 86400000).toISOString().slice(0, 10);
  const api = (m, p, body) => pg.evaluate(async ([m, p, body]) => { const s = await fetch('/api/auth/session').then((r) => r.json()); const r = await fetch('/api/' + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': s.csrf }, body: body ? JSON.stringify(body) : undefined }); return r.json(); }, [m, p, body]);
  async function check(expect, label) {
    await pg.goto(H + '#/dashboard'); await pg.reload(); await pg.waitForSelector('.room-card'); await pg.waitForTimeout(300);
    const inside = Number(await pg.innerText('.top .bell .bn')); const badge = await pg.evaluate(() => window.__badge.slice(-1)[0]);
    const server = (await pg.evaluate(() => fetch('/api/data').then((r) => r.json()))).derived.todo; const bar = await pg.innerText('.todo-bar');
    await pub.goto(H); await pub.reload(); await pub.waitForSelector('#pubnotices'); await pub.waitForTimeout(400); const outside = Number(await pub.innerText('#pubbell .bn')); const pbadge = await pub.evaluate(() => window.__badge.slice(-1)[0]); const pbar = await pub.innerText('.todo-bar');
    const parts = server.rooms + server.alerts + server.debts + server.oldDebts + server.phones;
    const same = inside === expect && badge === expect && outside === expect && pbadge === expect && server.count === expect && parts === expect;
    ok(same && (expect ? bar.includes(`${expect} việc cần làm`) && pbar.includes(`${expect} việc cần làm`) : bar.includes('Đã xong hết việc') && pbar.includes('Đã xong hết việc')), `${label}: trong app ${inside} · icon ${badge} · trang ngoài ${outside} · icon (trang ngoài) ${pbadge} · máy chủ/thông báo sáng ${server.count} → đều = ${expect}`);
    return server;
  }
  await pg.goto(H + '#/login'); await pg.fill('input[name=password]', '20101963'); await pg.click('button:has-text("ĐĂNG NHẬP")'); await pg.waitForSelector('.room-card');
  await check(0, 'Lúc đầu (chưa có việc)');
  // khách mới, SĐT lạ, có nợ cũ; còn 5 ngày tới hạn thu (chỉ nhắc trước, không đếm)
  const mv = await api('POST', 'tenants', { roomId: 'room-1', startDate: day(-27), rent: 3000000, elecPrice: 3500, waterPrice: 15000, initElec: 100, initWater: 50, paidAlready: true, tenant: { fullName: 'Trần Thị Mai', dob: '1990-05-06', gender: 'female', phone: '0911111111', cccd: '001090000111', cccdIssueDate: '2021-01-01', cccdIssuePlace: 'CA', address: 'Đà Nẵng' }, oldDebt: { amount: 200000, reason: 'nợ cũ', date: day(-3) } });
  const tid = mv.result.tenant.id, rid = mv.result.rental.id;
  let s = await check(2, 'Thêm khách (1 nợ cũ + 1 SĐT lạ; "sắp đến ngày thu" không đếm)'); ok(s.upcoming === 1, 'có 1 thẻ "Sắp đến ngày thu tiền" nhưng không tính vào số');
  const dashTxt = (await pg.innerText('main')).toLowerCase(); ok(dashTxt.includes('sắp đến ngày thu tiền (1)') && dashTxt.includes('không tính vào số thông báo'), 'Tổng quan ghi rõ thẻ nhắc trước không tính vào số');
  ok((await pub.innerText('.todo-bar')).includes('2 việc riêng'), 'trang ngoài giải thích có 2 việc riêng (cần đăng nhập để xem)');
  const dj = await api('POST', 'debts', { kind: 'receivable', name: 'Anh Tư', amount: 1000000, date: day(-2), note: '' }); const debtId = (dj.result || dj.db?.debts?.slice(-1)[0])?.id || (await pg.evaluate(() => fetch('/api/data').then((r) => r.json()))).db.debts[0].id;
  await check(3, 'Thêm 1 khoản Nhắc Nợ');
  const inv = (await api('POST', 'readings', { rentalId: rid, periodIndex: 1, elecNew: 150, waterNew: 60, readDate: day(0) })).result;
  s = await check(4, 'Ghi điện nước → phòng 1 chưa thanh toán'); ok(s.unpaid === 1 && s.upcoming === 0, 'đúng 1 phòng chưa thanh toán, không còn thẻ nhắc trước');
  // làm xong từng việc → số giảm dần về 0
  await api('POST', 'payments', { invoiceId: inv.id, amount: inv.total, date: day(0), allMonths: true }); await check(3, 'Thu đủ tiền phòng 1');
  await api('POST', `debts/${debtId}/pay`, { amount: 1000000, date: day(0) }); await check(2, 'Thu xong khoản Nhắc Nợ');
  await api('PUT', `tenants/${tid}`, { oldDebt: { amount: 0, date: day(-3), reason: 'đã thu' } }); await check(1, 'Thu hết nợ cũ');
  await pg.goto(H + '#/dashboard'); await pg.waitForSelector('button[data-act=phone-ok]'); await pg.click('button[data-act=phone-ok]'); await pg.waitForTimeout(800);
  await check(0, 'Bấm "Số đúng" → XONG HẾT VIỆC');
  ok(await pg.evaluate(() => window.__badge.slice(-1)[0] === 0), 'số trên biểu tượng app đã xóa (0)');
  const ack = await api('POST', 'usage-ack', { key: 'room-1|elec|2026-11' }); ok(ack.ok === true, 'nút "Đã kiểm tra" cảnh báo điện nước hoạt động');
  ok(!errs.length, 'không có lỗi JavaScript ' + errs.join(' | ')); await b.close();
})();
