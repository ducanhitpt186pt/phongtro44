// 2026-11-30-i: nhập trễ (2 trường hợp), thẻ việc gọn, sự kiện bấm xem chi tiết + nằm trên lịch, Zalo/Gọi, danh sách khách theo phòng, ghi chú khách
const { execSync } = require('child_process'); const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] }); const pg = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('dialog', (d) => d.accept());
  const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) process.exitCode = 1; }; const H = 'http://localhost:4173/';
  const day = (k) => new Date(Date.now() + 7 * 3600e3 + k * 86400000).toISOString().slice(0, 10); const data = () => pg.evaluate(() => fetch('/api/data').then((r) => r.json()));
  await pg.goto(H + '#/login'); await pg.fill('input[name=password]', '20101963'); await pg.click('button:has-text("ĐĂNG NHẬP")'); await pg.waitForSelector('.room-card');
  ok((await pg.innerText('.top h1')).includes('NHÀ TRỌ\n44 LÊ VĂN PHẤN'), 'tên app 2 dòng: NHÀ TRỌ / 44 LÊ VĂN PHẤN');
  ok(await pg.$eval('.top .btn.logout', (e) => getComputedStyle(e).backgroundColor === 'rgb(239, 68, 68)'), 'nút Đăng xuất màu đỏ');
  const fill = async (F, name, phone, start) => { await pg.fill(F + 'input[name=fullName]', name); await pg.fill(F + 'input[name=dob]', '1990-05-06'); await pg.fill(F + 'input[name=phone]', phone); await pg.check(F + 'input[name=gender][value=male]'); await pg.fill(F + 'input[name=cccd]', '0010900' + String(Math.floor(Math.random() * 1e5)).padStart(5, '0')); await pg.fill(F + 'input[name=cccdIssueDate]', '2021-01-01'); await pg.fill(F + 'input[name=cccdIssuePlace]', 'CA'); await pg.fill(F + 'input[name=address]', 'Đà Nẵng'); await pg.fill(F + 'input[name=startDate]', start); await pg.dispatchEvent(F + 'input[name=startDate]', 'input'); await pg.fill(F + 'input[name=rent]', '3000000'); await pg.fill(F + 'input[name=elecPrice]', '3500'); await pg.fill(F + 'input[name=waterPrice]', '15000'); await pg.fill(F + 'input[name=initElec]', '1000'); await pg.fill(F + 'input[name=initWater]', '100'); };
  // 1. Nhập trễ – mặc định "khách mới, tôi nhập trễ"
  const start = day(-41); await pg.goto(H + '#/room/room-2'); await pg.waitForSelector('button[data-act=movein]'); await pg.click('button[data-act=movein]'); const F = 'form[data-form=movein] '; await pg.waitForSelector(F);
  await fill(F, 'Lê Văn Cường', '0935222333', start); await pg.fill(F + 'textarea[name=tnote]', 'Đi làm ca đêm');
  ok(await pg.isVisible('#oldstart') && (await pg.innerText('#oldstart')).includes('Khách mới vào từ ngày đó – tôi nhập trễ') && (await pg.innerText('#oldstart')).includes('đã lấy tiền tháng trước rồi'), 'ngày vào quá 1 tháng → hỏi rõ 2 trường hợp');
  ok(await pg.isChecked(F + 'input[name=mode][value=late]') && !(await pg.isVisible('#existbox')), 'mặc định chọn "khách mới, tôi nhập trễ" (không hiện ô nợ cũ)');
  await pg.check(F + 'input[name=mode][value=existing]'); await pg.dispatchEvent(F + 'input[name=mode][value=existing]', 'input'); ok(await pg.isVisible('#existbox'), 'chọn "khách ở từ trước" → hiện ô nợ cũ còn lại');
  await pg.check(F + 'input[name=mode][value=late]'); await pg.dispatchEvent(F + 'input[name=mode][value=late]', 'input');
  await pg.click(F + 'button[type=submit]'); await pg.waitForTimeout(1200);
  let j = await data(); const t1 = j.db.tenants.find((x) => x.fullName === 'Lê Văn Cường'); const r1 = j.db.rentals.find((x) => x.tenantId === t1.id); const inv1 = j.db.invoices.find((x) => x.rentalId === r1.id);
  ok(inv1.periodIndex === 0 && inv1.dueDate === start && t1.note === 'Đi làm ca đêm', `nhập trễ: hóa đơn đầu là kỳ ngày vào (${start}), lưu ghi chú khách`);
  const rem = j.derived.reminders.find((x) => x.rentalId === r1.id); ok(rem && rem.read && rem.read.due < day(0), `nhắc Ghi điện nước kỳ đã qua (${rem?.read?.due}, trễ)`);
  // 2. Thẻ việc gọn
  await pg.goto(H + '#/dashboard'); await pg.waitForSelector('.note.task'); const card = await pg.innerText('.note.task');
  ok(card.includes('Phòng 2 – LÊ VĂN CƯỜNG') && /Cần làm: Ghi điện nước tháng \d+\/\d{4} \(\d\d\/\d\d\/\d{4} - trễ \d+ ngày\)/.test(card) && card.includes('Tính tiền'), 'thẻ gọn: "Phòng 2 – LÊ VĂN CƯỜNG / Cần làm: Ghi điện nước tháng …(dd/mm/yyyy - trễ n ngày) / Tính tiền"');
  ok(await pg.$eval('.note.task .t-when', (e) => getComputedStyle(e).color === 'rgb(215, 0, 21)' || parseInt(getComputedStyle(e).fontWeight) >= 700), 'phần (ngày - còn/trễ n ngày) chữ đậm màu đỏ');
  // 3. Tính tiền kỳ đã qua → thẻ đổi thành Thu tiền
  await pg.click('.note.task button[data-act=readings]'); await pg.waitForSelector('form[data-form=readings]'); await pg.fill('form[data-form=readings] input[name=elecNew]', '1120'); await pg.fill('form[data-form=readings] input[name=waterNew]', '108'); await pg.click('form[data-form=readings] button[type=submit]'); await pg.waitForTimeout(1000);
  await pg.goto(H + '#/dashboard'); await pg.reload(); await pg.waitForSelector('.room-card'); const card2 = await pg.innerText('main');
  ok(/Cần làm: Thu tiền tháng \d+\/\d{4} – 3\.540\.000 đ/.test(card2) && card2.includes('Đã nhận tiền'), 'ghi điện nước xong → "Cần làm: Thu tiền … 3.540.000 đ" (tiền phòng + điện nước tháng trước)');
  // 4. Khách ở từ trước
  await pg.goto(H + '#/room/room-4'); await pg.waitForSelector('button[data-act=movein]'); await pg.click('button[data-act=movein]'); await pg.waitForSelector(F); await fill(F, 'Trần Văn Bình', '0911222333', day(-41)); await pg.check(F + 'input[name=mode][value=existing]'); await pg.click(F + 'button[type=submit]'); await pg.waitForTimeout(1200);
  j = await data(); const t2 = j.db.tenants.find((x) => x.fullName === 'Trần Văn Bình'); const inv2 = j.db.invoices.find((x) => x.tenantName === 'Trần Văn Bình'); ok(inv2.periodIndex >= 1 && !j.derived.reminders.some((x) => x.tenantId === t2.id), 'khách ở từ trước: chỉ tính từ kỳ đang chạy, không nhắc kỳ cũ');
  // 5. Zalo / Gọi
  await pg.evaluate(async (tid) => { const s = await fetch('/api/auth/session').then((r) => r.json()); await fetch('/api/occupants', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': s.csrf }, body: JSON.stringify({ tenantId: tid, occupant: { fullName: 'Lê Thị Hoa', dob: '1992-01-01', gender: 'female', phone: '', cccd: '001092000999', address: 'ĐN', cccdIssueDate: '2021-01-01', cccdIssuePlace: 'CA' } }) }); }, t1.id);
  await pg.goto(H + '#/room/room-2'); await pg.reload(); await pg.waitForSelector('.contacts'); const rows = await pg.$$eval('.contacts .crow', (els) => els.map((e) => ({ t: e.innerText, z: !!e.querySelector('.zbtn'), c: !!e.querySelector('.cbtn') })));
  ok(rows[0].z && rows[0].c && /Gọi$/.test(rows[0].t.trim()) && !rows[0].t.includes('0935'), 'có SĐT: nút Zalo + nút "Gọi" (không kèm số)');
  ok(!rows[1].z && !rows[1].c && rows[1].t.includes('Chưa có số điện thoại'), 'không có SĐT: ẩn nút Zalo và Gọi');
  ok(await pg.isVisible('button[data-act=cccd-backup][data-room=room-2]') && (await pg.innerText('.room-info')).includes('Đi làm ca đêm'), 'trang phòng: có nút Backup căn cước phòng này, hiện ghi chú khách');
  // 6. Khách thuê: theo số phòng
  await pg.goto(H + '#/tenants'); await pg.waitForSelector('.trow'); const order = await pg.$$eval('.trow .tr-room', (e) => e.map((x) => x.innerText.trim())); ok(order[0] === 'Phòng 2' && order[1] === 'Phòng 4', `tab Khách thuê sắp theo số phòng (${order.join(', ')})`);
  ok((await pg.innerText('.trow')).includes('Số người ở: 2') && (await pg.innerText('.trow')).includes('0935222333'), 'mỗi dòng: Phòng – Tên – Số người ở – SĐT');
  // 7. Sự kiện: danh sách trên lịch, bấm xem chi tiết
  await pg.evaluate(async (d) => { const s = await fetch('/api/auth/session').then((r) => r.json()); await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': s.csrf }, body: JSON.stringify({ name: 'Giỗ Bà Nội', calendar: 'solar', day: Number(d.slice(8)), month: Number(d.slice(5, 7)), year: Number(d.slice(0, 4)), repeat: true, note: 'Mua hoa quả' }) }); }, day(-3));
  await pg.goto(H + '#/dashboard'); await pg.reload(); await pg.waitForSelector('.evrow');
  ok(await pg.evaluate(() => document.querySelector('.evside').getBoundingClientRect().top < document.querySelector('.cal-grid').getBoundingClientRect().top), 'danh sách sự kiện nằm phía trên lịch');
  const row = await pg.innerText('.evrow'); ok(row.includes('Giỗ Bà Nội') && row.includes('Dương lịch') && row.includes('Đã qua') && !row.includes('Mua hoa quả'), `dòng sự kiện gọn: "${row.replace(/\n/g, ' ')}"`);
  await pg.click('.evrow'); await pg.waitForSelector('#modal .ev-kv'); const det = await pg.innerText('#modal'); ok(det.includes('Ngày âm lịch') && det.includes('Lặp lại') && det.includes('Hằng năm') && det.includes('Mua hoa quả') && det.includes('lần tới'), 'bấm vào → chi tiết: âm/dương lịch, lặp lại, ghi chú, lần tới');
  await pg.keyboard.press('Escape'); ok(/ÂM: \(Tháng \d+( - \d+)?\) \S+ \S+/.test(await pg.innerText('.cal-lunar')), `lịch tháng: "${await pg.innerText('.cal-lunar')}"`);
  ok(!errs.length, 'không có lỗi JavaScript ' + errs.join(' | ')); await b.close();
})();
