// Đặt cọc, hình thức thanh toán, quê quán, gợi ý nơi cấp, thời gian ở người ở cùng, Bên A, Xuất Hợp Đồng, trả phòng trừ cọc.
const fs = require('fs');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const OUT = process.env.OUT || '/tmp/claude-0/e2e26'; fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('dialog', (d) => d.accept());
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) process.exitCode = 1; }; const H = 'http://localhost:4173/';
  const call = async (m, p, body) => { const c = await pg.evaluate(() => fetch('/api/auth/session').then((r) => r.json()).then((j) => j.csrf)); return pg.evaluate(([m, p, body, c]) => fetch('/api/' + p, { method: m, headers: { 'content-type': 'application/json', 'x-csrf-token': c }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json()), [m, p, body, c]); };
  const data = () => pg.evaluate(() => fetch('/api/data').then((x) => x.json()));
  await pg.goto(H + '#/login'); await pg.fill('input[name=password]', '20101963'); await pg.click('button:has-text("ĐĂNG NHẬP")'); await pg.waitForSelector('.room-card');
  // ---- Bên A (phòng Chủ Nhà) ----
  let d = await data(); const ow = d.db.rooms.find((r) => r.kind === 'owner');
  await pg.goto(H + '#/room/' + ow.id); await pg.waitForSelector('form[data-form=landlord]');
  await pg.fill('form[data-form=landlord] input[name=fullName]', 'Phạm Văn Chủ'); await pg.fill('form[data-form=landlord] input[name=dob]', '1975-03-04'); await pg.fill('form[data-form=landlord] input[name=phone]', '0900111222'); await pg.fill('form[data-form=landlord] input[name=cccd]', '001075000111'); await pg.fill('form[data-form=landlord] input[name=cccdIssueDate]', '2021-05-06');
  await pg.click('form[data-form=landlord] .chipbtn'); const lp = await pg.inputValue('form[data-form=landlord] input[name=cccdIssuePlace]'); ok(/CỤC TRƯỞNG CỤC CẢNH SÁT QUẢN LÝ HÀNH CHÍNH VỀ TRẬT TỰ XÃ HỘI/.test(lp), 'gợi ý nơi cấp: bấm chọn điền đúng "' + lp + '"');
  await pg.fill('form[data-form=landlord] input[name=address]', 'Số 1 Lê Văn Phấn, Hà Nội'); await pg.fill('form[data-form=landlord] input[name=houseAddress]', '44 Lê Văn Phấn, Hà Nội'); await pg.fill('form[data-form=landlord] input[name=police]', 'Công An Phường Phú Thủy'); await pg.click('form[data-form=landlord] button[type=submit]'); await pg.waitForTimeout(800);
  d = await data(); ok(d.settings.landlord?.fullName === 'Phạm Văn Chủ' && d.settings.landlord.houseAddress === '44 Lê Văn Phấn, Hà Nội', 'lưu thông tin Bên A trong phòng Chủ Nhà');
  // ---- thêm khách: cọc, hình thức thanh toán, quê quán, người ở cùng có thời gian ở ----
  await pg.goto(H + '#/room/room-2'); await pg.waitForSelector('button[data-act=movein]'); await pg.click('button[data-act=movein]'); await pg.waitForSelector('form[data-form=movein]');
  const F = 'form[data-form=movein] ';
  ok((await pg.inputValue(F + 'input[name=deposit]')) === '0', 'ô "Số Tiền Đặt Cọc" mặc định 0');
  ok(await pg.isChecked(F + 'input[name=payCycle][value=month]'), 'hình thức thanh toán mặc định "Theo tháng"');
  await pg.fill(F + 'input[name=fullName]', 'Nguyễn Văn An'); await pg.fill(F + 'input[name=dob]', '1990-05-12'); await pg.fill(F + 'input[name=phone]', '0912345678'); await pg.check(F + 'input[name=gender][value=male]');
  await pg.fill(F + 'input[name=cccd]', '001090000123'); await pg.fill(F + 'input[name=cccdIssueDate]', '2021-04-10'); await pg.click(F + '.chipbtn'); await pg.fill(F + 'input[name=address]', 'Số 12 ngõ 45 Lê Văn Phấn, Hà Nội'); await pg.fill(F + 'input[name=hometown]', 'Xã Đông Hưng, Thái Bình');
  const start = new Date(Date.now() + 7 * 3600e3 - 5 * 86400000).toISOString().slice(0, 10); await pg.fill(F + 'input[name=startDate]', start);
  await pg.fill(F + 'input[name=rent]', '3000000'); await pg.fill(F + 'input[name=elecPrice]', '3500'); await pg.fill(F + 'input[name=waterPrice]', '15000'); await pg.fill(F + 'input[name=deposit]', '2000000'); await pg.check(F + 'input[name=payCycle][value=quarter]'); await pg.fill(F + 'input[name=initElec]', '100'); await pg.fill(F + 'input[name=initWater]', '10');
  await pg.click(F + '[data-act=add-occ]'); await pg.fill(F + 'input[name=o_name]', 'Trần Thị Mai'); await pg.fill(F + 'input[name=o_dob]', '1992-08-20'); await pg.fill(F + 'input[name=o_cccd]', '001192000456'); await pg.fill(F + 'input[name=o_address]', 'Hà Nội');
  ok(await pg.locator(F + '.occ-to').isHidden(), 'ô "Đến ngày" ẩn khi chọn "Kể từ ngày"'); await pg.check(F + 'input[name^=o_stay_][value=range]'); ok(await pg.locator(F + '.occ-to').isVisible(), 'chọn "Từ ngày … đến ngày …" → hiện ô Đến ngày');
  ok((await pg.inputValue(F + 'input[name=o_from]')) === new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10), 'ngày bắt đầu ở của người ở cùng mặc định = hôm nay'); await pg.fill(F + 'input[name=o_from]', start); await pg.fill(F + 'input[name=o_to]', '2027-12-31'); await pg.fill(F + 'input[name=o_hometown]', 'Nam Định');
  await pg.click(F + 'button[type=submit]'); await pg.waitForTimeout(1200);
  d = await data(); const t = d.db.tenants.find((x) => x.fullName === 'Nguyễn Văn An'); const r2 = d.db.rentals.find((x) => x.roomId === 'room-2' && x.status === 'active'); const oc = d.db.occupants.find((x) => x.tenantId === t.id);
  ok(r2 && r2.deposit === 2000000 && r2.payCycle === 'quarter', 'lưu đặt cọc 2.000.000 + theo quý: ' + (r2 && r2.deposit + '/' + r2.payCycle));
  ok(t.hometown === 'Xã Đông Hưng, Thái Bình' && /CỤC TRƯỞNG/.test(t.cccdIssuePlace), 'lưu quê quán + nơi cấp');
  ok(oc && oc.stayMode === 'range' && oc.stayFrom === start && oc.stayTo === '2027-12-31' && oc.hometown === 'Nam Định' && oc.gender === 'male', 'người ở cùng: từ ngày … đến ngày …, quê quán, giới tính ' + JSON.stringify(oc && [oc.stayMode, oc.stayFrom, oc.stayTo, oc.gender]));
  // ---- thời hạn thống nhất ----
  await pg.goto(H + '#/room/room-2'); await pg.waitForSelector('button[data-act=contract]'); await pg.click('button[data-act=contract]'); await pg.waitForSelector('#modal input[name=termMode]');
  ok(await pg.isChecked('#modal input[name=termMode][value=from]'), 'thời hạn mặc định "Kể từ ngày"');
  await pg.check('#modal input[name=termMode][value=range]'); await pg.fill('#modal input[name=termTo]', '2027-12-31');
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('button[data-act=contract-docx]')]); await dl.saveAs(OUT + '/hd.docx'); await pg.waitForTimeout(500);
  const rid = d.db.rentals.find((x) => x.roomId === 'room-2' && x.status === 'active').id;
  const html = await pg.evaluate((id) => fetch('/api/contract/' + id + '?format=html').then((r) => r.text()), rid); fs.writeFileSync(OUT + '/hd.html', html);
  ok(/Từ ngày [^<]*đến ngày <?[^>]*>?31\/12\/2027/.test(html.replace(/<[^>]+>/g, '')) || /đến ngày\s*31\/12\/2027/.test(html.replace(/<[^>]+>/g, '')), 'hợp đồng ghi "Từ ngày … đến ngày 31/12/2027"');
  ok(!/không xác định thời hạn/.test(html), 'không còn câu thời hạn thứ hai');
  // ---- CT01 ----
  await pg.reload(); await pg.waitForSelector('button[data-act=ct01]');
  const [pd] = await Promise.all([pg.waitForEvent('download'), pg.click('button[data-act=ct01]')]); const pp = OUT + '/ct01.pdf'; await pd.saveAs(pp);
  ok(/^ban-khai-CT01-/.test(pd.suggestedFilename()) && fs.readFileSync(pp).slice(0, 5).toString() === '%PDF-', 'tải Bản Khai CT01: ' + pd.suggestedFilename() + ' (' + fs.statSync(pp).size + ' byte)');
  await pg.goto(H + '#/tenant/' + d.db.tenants.find((x) => x.fullName === 'Nguyễn Văn An').id); await pg.waitForSelector('button[data-act=ct01]'); ok(true, 'nút CT01 có ở hồ sơ khách');
  ok(errs.length === 0, 'không lỗi JS: ' + errs.join('|'));
  await b.close();
})();
