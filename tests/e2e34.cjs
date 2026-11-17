// 2026-11-30-l: ghi chú nợ cũ / tiền thu thêm (chữ đỏ) ở thẻ "Cần làm" + hóa đơn; khối chuyển khoản chữ trên – QR dưới; báo cáo tự cập nhật
const { execSync } = require('child_process'); const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] }); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('dialog', (d) => d.accept());
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) process.exitCode = 1; }; const H = 'http://localhost:4173/';
  const day = (k) => new Date(Date.now() + 7 * 3600e3 + k * 86400000).toISOString().slice(0, 10); const data = () => pg.evaluate(() => fetch('/api/data').then((r) => r.json()));
  const call = (m, p, body) => pg.evaluate(async ([m, p, body]) => { const s = await fetch('/api/auth/session').then((r) => r.json()); return fetch('/api/' + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': s.csrf }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json()); }, [m, p, body]);
  await pg.goto(H + '#/login'); await pg.fill('input[name=password]', '20101963'); await pg.click('button:has-text("ĐĂNG NHẬP")'); await pg.waitForSelector('.room-card');
  await call('PUT', 'settings', { bank: { bankName: 'BIDV', accountNumber: '8829401809', accountName: 'PHẠM THỊ XOÈ' } });
  const jpg = fs.readFileSync(__dirname + '/sample-cccd.jpg').toString('base64');
  await pg.evaluate(async (b64) => { const s = await fetch('/api/auth/session').then((r) => r.json()); const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); await fetch('/api/storage/upload?ownerId=bank-qr&side=qr', { method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'X-CSRF-Token': s.csrf }, body: bin }); }, jpg);
  // khách vào 1 tháng trước (nhập trễ) để có kỳ cần tính tiền
  const F = 'form[data-form=movein] '; await pg.goto(H + '#/room/room-4'); await pg.waitForSelector('button[data-act=movein]'); await pg.click('button[data-act=movein]'); await pg.waitForSelector(F);
  await pg.fill(F + 'input[name=fullName]', 'Phạm Văn Tư'); await pg.fill(F + 'input[name=dob]', '1990-05-06'); await pg.fill(F + 'input[name=phone]', '0935444555'); await pg.check(F + 'input[name=gender][value=male]'); await pg.fill(F + 'input[name=cccd]', '001090012345'); await pg.fill(F + 'input[name=cccdIssueDate]', '2021-01-01'); await pg.fill(F + 'input[name=cccdIssuePlace]', 'CA'); await pg.fill(F + 'input[name=address]', 'Đà Nẵng');
  await pg.fill(F + 'input[name=startDate]', day(-28)); await pg.dispatchEvent(F + 'input[name=startDate]', 'input'); await pg.fill(F + 'input[name=rent]', '1000000'); await pg.fill(F + 'input[name=elecPrice]', '3000'); await pg.fill(F + 'input[name=waterPrice]', '17000'); await pg.fill(F + 'input[name=initElec]', '11701'); await pg.fill(F + 'input[name=initWater]', '587');
  const paid = await pg.$(F + 'input[name=paidAlready]'); if (paid && !(await paid.isChecked())) await paid.check();
  await pg.click(F + 'button[type=submit]'); await pg.waitForTimeout(1200);
  let j = await data(); const r = j.db.rentals.find((x) => x.roomId === 'room-4' && x.status === 'active');
  // Tính tiền: nợ cũ 2.900.000 + ghi chú, thu thêm 200.000 Sửa khóa
  await pg.goto(H + '#/room/room-4'); await pg.reload(); await pg.waitForSelector('button[data-act=readings]'); await pg.click('button[data-act=readings]'); const R = 'form[data-form=readings] '; await pg.waitForSelector(R);
  ok(await pg.isVisible(R + 'input[name=manualDebtNote]') && await pg.isVisible(R + 'input[name=otherLabel]'), 'form Tính tiền có ô Ghi chú nợ cũ + Ghi chú tiền thu thêm');
  await pg.fill(R + 'input[name=elecNew]', '11701'); await pg.fill(R + 'input[name=waterNew]', '587'); await pg.fill(R + 'input[name=manualDebt]', '2900000'); await pg.fill(R + 'input[name=manualDebtNote]', 'Nợ tiền phòng tháng 10'); await pg.fill(R + 'input[name=otherAmount]', '200000'); await pg.fill(R + 'input[name=otherLabel]', 'Sửa khóa');
  await pg.click(R + 'button[type=submit]'); await pg.waitForSelector('#bill');
  const bill = await pg.innerText('#bill'); ok(bill.includes('Ghi chú: Nợ tiền phòng tháng 10') && !bill.includes('Nợ nhập thêm') && bill.includes('Tiền thu thêm') && bill.includes('Ghi chú: Sửa khóa'), 'hóa đơn có ghi chú nợ cũ + tiền thu thêm');
  ok(await pg.$$eval('#bill .bnr', (els) => els.length === 2 && els.every((e) => getComputedStyle(e).color === 'rgb(196, 42, 29)')), 'ghi chú hóa đơn chữ ĐỎ');
  // khối chuyển khoản
  for (const [w, h, name] of [[390, 844, 'điện thoại'], [320, 640, 'điện thoại nhỏ'], [820, 1180, 'iPad dọc'], [1180, 820, 'iPad ngang'], [1366, 900, 'máy tính']]) {
    await pg.setViewportSize({ width: w, height: h }); await pg.waitForTimeout(150);
    const g = await pg.evaluate(() => { const rows = [...document.querySelectorAll('#bill .bbank .bk')].map((e) => { const dd = e.querySelector('dd'); const lh = parseFloat(getComputedStyle(dd).lineHeight) || 24; return { lines: Math.round(dd.getBoundingClientRect().height / lh), bottom: e.getBoundingClientRect().bottom, t: dd.innerText }; }); const q = document.querySelector('#bill .bqr').getBoundingClientRect(); const bk = document.querySelector('#bill .bbank').getBoundingClientRect(); return { rows, qTop: q.top, qCenter: q.left + q.width / 2, bkCenter: bk.left + bk.width / 2, over: document.documentElement.scrollWidth > innerWidth }; });
    ok(g.rows.length === 3 && g.rows.every((x) => x.lines <= 1) && g.qTop >= g.rows[2].bottom && Math.abs(g.qCenter - g.bkCenter) < 4 && !g.over, `${name} ${w}px: Ngân hàng / STK / Chủ TK mỗi thứ 1 dòng (${g.rows.map((x) => x.t).join(' | ')}), QR ở dưới giữa, không tràn`);
    await pg.screenshot({ path: `/tmp/shot-bank-${w}.png`, fullPage: false, clip: undefined }).catch(() => {});
  }
  await pg.setViewportSize({ width: 390, height: 844 });
  // ảnh JPG
  const jp = await pg.evaluate(async () => { const m = await import('/js/invoice-img.js'); const api = await import('/js/api.js'); const i = api.D().invoices.find((x) => x.id === location.hash.split('/')[2]); const mm = m.billModel(i, api.invD(i.id), api.S.snap.settings.bank, api.S.snap.settings.bankQr); const bl = await m.renderBill(mm); return { size: bl.size, red: mm.calc.filter((c) => c.red).map((c) => c.red) }; });
  ok(jp.size > 20000 && jp.red.length === 2, `ảnh JPG hóa đơn tạo được (${jp.size} byte), có 2 ghi chú đỏ`);
  // thẻ Cần làm (trang trong)
  await pg.goto(H + '#/dashboard'); await pg.reload(); await pg.waitForSelector('.note.task'); const cards = await pg.$$eval('.note.task', (e) => e.map((x) => x.innerText)); const c4 = cards.find((x) => x.startsWith('Phòng 4')) || '';
  ok(c4.includes('Cần làm: Thu tiền') && c4.includes('Nợ cũ: 2.900.000 đ – Nợ tiền phòng tháng 10') && c4.includes('Thu thêm: 200.000 đ – Sửa khóa'), 'Tổng quan (trong): ghi chú nợ cũ + thu thêm dưới dòng Cần làm');
  ok(await pg.$$eval('.note.task .t-note', (els) => els.length >= 2 && els.every((e) => getComputedStyle(e).color !== 'rgb(0, 0, 0)')), 'ghi chú thẻ chữ đỏ');
  // báo cáo: hóa đơn vừa lập phải có (kể cả đến hạn sau hôm nay), tự cập nhật
  await pg.goto(H + '#/reports'); await pg.waitForSelector('.rep-group'); let rep = await pg.innerText('#rep'); const inv = (await data()).db.invoices.filter((x) => x.roomId === 'room-4').pop();
  ok(rep.includes('Phạm Văn Tư') && (await pg.inputValue('input[name=to]')).endsWith('-12-31'), `báo cáo mặc định cả năm, có hóa đơn mới lập (đến hạn ${inv.dueDate})`);
  await call('POST', 'payments', { invoiceId: inv.id, amount: 1000000, date: day(0) }); // thay đổi từ "máy khác"
  await pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await pg.waitForTimeout(1500); rep = await pg.innerText('#rep');
  ok(/Thu một phần/.test(rep), 'báo cáo tự cập nhật khi dữ liệu thay đổi (không cần bấm lại)');
  // SỬA HÓA ĐƠN: đổi số nợ cũ + ghi chú, sửa khoản thu thêm, thêm khoản thứ 2, lưu lịch sử
  await pg.goto(H + '#/invoice/' + inv.id); await pg.waitForSelector('#bill'); ok((await pg.innerText('button[data-act=adjust]')).includes('Sửa hóa đơn'), 'nút "Sửa hóa đơn (nợ cũ, thu thêm…)" trên trang hóa đơn');
  await pg.click('button[data-act=adjust]'); const A = 'form[data-form=adjust] '; await pg.waitForSelector(A);
  ok((await pg.inputValue(A + 'input[name=manualDebt]')) === '2.900.000' && (await pg.inputValue(A + 'input[name=manualDebtNote]')) === 'Nợ tiền phòng tháng 10' && (await pg.inputValue(A + 'input[name=exl]')) === 'Sửa khóa', 'form Sửa điền sẵn số nợ cũ, ghi chú nợ cũ, khoản thu thêm hiện tại');
  await pg.fill(A + 'input[name=manualDebt]', '3000000'); await pg.fill(A + 'input[name=manualDebtNote]', 'Nợ tiền T9, T10, T11'); await pg.fill(A + 'input[name=exa]', '250000'); await pg.fill(A + 'input[name=exl]', 'Thay ổ khóa');
  await pg.click('button[data-act=adj-add-ex]'); const ex = await pg.$$(A + 'input[name=exa]'); await ex[1].fill('50000'); await (await pg.$$(A + 'input[name=exl]'))[1].fill('Internet');
  await pg.fill(A + 'input[name=reason]', 'Sửa nợ và thu thêm'); await pg.click(A + 'button[type=submit]'); await pg.waitForTimeout(1200);
  let bt = await pg.innerText('#bill'); ok(bt.includes('3.000.000 đ') && bt.includes('Ghi chú: Nợ tiền T9, T10, T11') && bt.includes('Ghi chú: Thay ổ khóa') && bt.includes('Ghi chú: Internet') && bt.includes('4.300.000 đ'), 'hóa đơn cập nhật: nợ cũ 3.000.000 + ghi chú mới, 2 khoản thu thêm, tổng 4.300.000 đ');
  const hist = await pg.innerText('.adj-hist'); ok(hist.includes('Sửa nợ và thu thêm') && hist.includes('Nợ cũ: 2.900.000 đ → 3.000.000 đ') && hist.includes('Ghi chú nợ cũ: "Nợ tiền phòng tháng 10" → "Nợ tiền T9, T10, T11"') && hist.includes('Tiền thu thêm: 200.000 đ (Sửa khóa) → 250.000 đ (Thay ổ khóa) + 50.000 đ (Internet)') && hist.includes('Tổng tiền: 4.100.000 đ → 4.300.000 đ'), 'lịch sử sửa ghi rõ: thời gian, lý do, cũ → mới');
  // bỏ khoản Internet, chỉ đổi ghi chú
  await pg.click('button[data-act=adjust]'); await pg.waitForSelector(A); await (await pg.$$(A + 'input[name=exa]'))[1].fill(''); await pg.fill(A + 'input[name=manualDebtNote]', 'Nợ tháng 9 và 10'); await pg.fill(A + 'input[name=reason]', 'Bỏ internet'); await pg.click(A + 'button[type=submit]'); await pg.waitForTimeout(1200);
  bt = await pg.innerText('#bill'); ok(!bt.includes('Internet') && bt.includes('Ghi chú: Nợ tháng 9 và 10') && (await pg.$$('.adj-hist .ah')).length >= 2, 'xóa trắng số tiền = bỏ khoản thu thêm; lịch sử có 2 lần sửa (mới nhất ở trên)');
  // không đổi gì → báo
  await pg.click('button[data-act=adjust]'); await pg.waitForSelector(A); await pg.fill(A + 'input[name=reason]', 'x'); await pg.click(A + 'button[type=submit]'); await pg.waitForTimeout(800); ok((await pg.innerText('#toast')).includes('Chưa có gì thay đổi'), 'không thay đổi gì → báo "Chưa có gì thay đổi để lưu"'); await pg.keyboard.press('Escape');
  // nút Sửa ở trang phòng + trong hộp thoại Thanh toán
  await pg.goto(H + '#/room/room-4'); await pg.waitForSelector('tr.click'); ok(!!(await pg.$('tr.click button[data-act=adjust]')), 'trang phòng: hóa đơn mới nhất có nút Sửa');
  await pg.goto(H + '#/dashboard'); await pg.waitForSelector('.note.task'); const c4b = (await pg.$$eval('.note.task', (e) => e.map((x) => x.innerText))).find((x) => x.startsWith('Phòng 4')) || ''; ok(c4b.includes('Nợ cũ: 3.000.000 đ – Nợ tháng 9 và 10') && c4b.includes('Thu thêm: 250.000 đ – Thay ổ khóa'), 'thẻ Cần làm cập nhật theo số và ghi chú vừa sửa');
  // trang ngoài
  const pub = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); await pub.goto(H); await pub.waitForSelector('.note.task'); const pc = (await pub.$$eval('.note.task', (e) => e.map((x) => x.innerText))).find((x) => x.startsWith('Phòng 4')) || '';
  ok(pc.includes('Nợ cũ: 3.000.000 đ – Nợ tháng 9 và 10') && pc.includes('Thu thêm: 250.000 đ – Thay ổ khóa'), 'Tổng quan (trang ngoài): có ghi chú nợ cũ + thu thêm');
  ok(!errs.length, 'không lỗi JS ' + errs.join(' | '));
  await b.close();
})();
