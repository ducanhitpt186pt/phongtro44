import assert from 'node:assert/strict';
import { addMonthsClamp, periodIndexOf, periodStart, todayVN } from '../lib/dates.js';
import { emptyDb, validateDb } from '../lib/schema.js';
import * as B from '../lib/billing.js';
import { buildReminders, publicReminders } from '../lib/reminders.js';
import { purgeOld, storageInfo } from '../lib/cleanup.js';
import { buildSystem } from '../lib/health.js';

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n   ', e.message); } };
const throwsCode = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.code, code, `mã lỗi ${e.code} ≠ ${code}: ${e.message}`); return; } assert.fail('Phải ném lỗi ' + code); };
const person = { fullName: 'Nguyễn Văn A', dob: '1990-05-20', gender: 'male', phone: '0901234567', cccd: '001090000001', cccdIssueDate: '2021-01-01', cccdIssuePlace: 'Cục CS', address: 'Hà Nội' };
function setup(startDate, today, extra = {}) {
  const db = emptyDb('2026-01-01');
  const r = B.moveIn(db, { roomId: 'room-1', startDate, rent: 1200000, elecPrice: 2000, waterPrice: 15000, initElec: 100, initWater: 10, headcount: 1, tenant: person, ...extra }, today);
  return { db, rental: r.rental, inv0: r.invoice };
}

console.log('NGÀY ĐẾN HẠN');
t('10/11 → 10/12 → 10/01', () => { assert.equal(periodStart('2026-11-10', 1), '2026-12-10'); assert.equal(periodStart('2026-11-10', 2), '2027-01-10'); });
t('31/01 → cuối tháng 2 (không nhảy sang tháng 3), rồi 31/03', () => { assert.equal(periodStart('2026-01-31', 1), '2026-02-28'); assert.equal(periodStart('2026-01-31', 2), '2026-03-31'); assert.equal(periodStart('2028-01-31', 1), '2028-02-29'); });
t('30/01 và 29/01 năm nhuận', () => { assert.equal(periodStart('2026-01-30', 1), '2026-02-28'); assert.equal(periodStart('2027-12-31', 2), '2028-02-29'); });
t('kỳ hiện tại theo ngày', () => { assert.equal(periodIndexOf('2026-11-10', '2026-12-09'), 0); assert.equal(periodIndexOf('2026-11-10', '2026-12-10'), 1); assert.equal(periodIndexOf('2026-01-31', '2026-03-01'), 1); assert.equal(periodIndexOf('2026-01-31', '2026-03-31'), 2); });
t('múi giờ VN: 17:30 UTC ngày 31/10 = 01/11 VN', () => assert.equal(todayVN(new Date('2026-10-31T17:30:00Z')), '2026-11-01'));

console.log('VÀO Ở / KỲ ĐẦU');
t('kỳ đầu thu đủ tiền phòng, không điện nước', () => { const { inv0 } = setup('2026-11-10', '2026-11-10'); assert.equal(inv0.total, 1200000); assert.equal(inv0.elec, null); assert.equal(inv0.dueDate, '2026-11-10'); });
t('không thêm phòng đã có khách', () => { const { db } = setup('2026-11-10', '2026-11-10'); throwsCode(() => B.moveIn(db, { roomId: 'room-1', startDate: '2026-11-10', rent: 1, elecPrice: 1, waterPrice: 1, initElec: 0, initWater: 0, tenant: person }, '2026-11-10'), 'BAD_REQUEST'); });
t('khách đã ở quá 1 kỳ phải dùng chế độ "đã ở sẵn"', () => { const db = emptyDb(); throwsCode(() => B.moveIn(db, { roomId: 'room-2', startDate: '2026-08-10', rent: 1000000, elecPrice: 1, waterPrice: 1, initElec: 0, initWater: 0, tenant: person }, '2026-11-01'), 'USE_EXISTING'); });
t('khách đã ở sẵn: hóa đơn mở đầu đúng kỳ hiện tại + nợ cũ', () => { const db = emptyDb(); const r = B.moveIn(db, { mode: 'existing', openingDebt: 300000, roomId: 'room-2', startDate: '2026-08-10', rent: 1000000, elecPrice: 1, waterPrice: 1, initElec: 5, initWater: 5, tenant: person }, '2026-11-01'); assert.equal(r.invoice.periodIndex, 2); assert.equal(r.invoice.dueDate, '2026-10-10'); assert.equal(r.invoice.total, 1300000); validateDb(db); });

console.log('ĐIỆN NƯỚC / HÓA ĐƠN / CÔNG NỢ');
t('hóa đơn kỳ 2: tính điện nước đúng, chỉ số mới thành chỉ số cũ kỳ sau', () => {
  const { db, rental } = setup('2026-11-10', '2026-11-10');
  B.addPayment(db, { invoiceId: db.invoices[0].id, amount: 1200000 }, '2026-11-10');
  const inv = B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 150, waterNew: 12 }, '2026-12-10');
  assert.equal(inv.elec.usage, 50); assert.equal(inv.elec.amount, 100000); assert.equal(inv.water.amount, 30000); assert.equal(inv.total, 1330000);
  B.addPayment(db, { invoiceId: inv.id, amount: 1330000 }, '2026-12-10');
  const inv2 = B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 2, elecNew: 160, waterNew: 13 }, '2027-01-10');
  assert.equal(inv2.elec.old, 150); assert.equal(inv2.elec.amount, 20000); assert.equal(inv2.dueDate, '2027-01-10'); validateDb(db);
});
t('chỉ số nhỏ hơn chỉ số cũ bị từ chối', () => { const { db, rental } = setup('2026-11-10', '2026-11-10'); throwsCode(() => B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 90, waterNew: 12 }, '2026-12-10'), 'METER_DECREASED'); assert.equal(db.invoices.length, 1); });
t('không lập trùng kỳ, không bỏ kỳ, không lập quá sớm', () => {
  const { db, rental } = setup('2026-11-10', '2026-11-10');
  B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 150, waterNew: 12 }, '2026-12-10');
  throwsCode(() => B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 160, waterNew: 12 }, '2026-12-10'), 'WRONG_PERIOD');
  throwsCode(() => B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 3, elecNew: 160, waterNew: 12 }, '2027-02-10'), 'WRONG_PERIOD');
  throwsCode(() => B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 2, elecNew: 160, waterNew: 12 }, '2026-12-11'), 'TOO_EARLY');
});
t('thanh toán 1 phần → còn nợ → nhiều lần → đủ; không âm, không vượt', () => {
  const { db } = setup('2026-11-10', '2026-11-10'); const id = db.invoices[0].id;
  throwsCode(() => B.addPayment(db, { invoiceId: id, amount: -5 }, '2026-11-10'), 'BAD_REQUEST');
  B.addPayment(db, { invoiceId: id, amount: 1000000 }, '2026-11-10');
  assert.equal(B.remainingOf(db, db.invoices[0]), 200000); assert.equal(B.statusOf(db, db.invoices[0], '2026-11-10'), 'partial');
  throwsCode(() => B.addPayment(db, { invoiceId: id, amount: 200001 }, '2026-11-10'), 'OVERPAY');
  B.addPayment(db, { invoiceId: id, amount: 200000 }, '2026-11-12');
  assert.equal(B.remainingOf(db, db.invoices[0]), 0); assert.equal(B.statusOf(db, db.invoices[0], '2026-11-12'), 'paid'); assert.equal(db.payments.length, 2);
});
t('NỢ CŨ chuyển đúng, không tính trùng (ví dụ trong yêu cầu: 1.200.000+150.000+50.000+200.000=1.600.000)', () => {
  const { db, rental } = setup('2026-11-10', '2026-11-10');
  B.addPayment(db, { invoiceId: db.invoices[0].id, amount: 1000000 }, '2026-11-10'); // còn nợ 200.000
  // điện 150.000 = 75 số x 2000 ; nước 50.000 -> giá nước 15000 nên dùng 10 số x 5000: đổi giá để khớp ví dụ
  B.changePrice(db, { rentalId: rental.id, rent: 1200000, elecPrice: 2000, waterPrice: 5000, effectiveFrom: '2026-11-10', reason: 'khớp ví dụ' }, '2026-11-10');
  const inv = B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 175, waterNew: 20 }, '2026-12-10');
  assert.equal(inv.oldDebt, 200000); assert.equal(inv.total, 1600000);
  assert.equal(db.invoices[0].rolledOver.amount, 200000);
  assert.equal(B.remainingOf(db, db.invoices[0]), 0); // hóa đơn cũ không còn bị tính nợ
  const totalOutstanding = db.invoices.reduce((s, i) => s + B.remainingOf(db, i), 0);
  assert.equal(totalOutstanding, 1600000); // không bị cộng đôi 200.000
  throwsCode(() => B.addPayment(db, { invoiceId: db.invoices[0].id, amount: 100 }, '2026-12-10'), 'ROLLED');
  B.addPayment(db, { invoiceId: inv.id, amount: 1600000 }, '2026-12-11');
  assert.equal(db.invoices.reduce((s, i) => s + B.remainingOf(db, i), 0), 0);
});
t('đổi giá không làm thay đổi hóa đơn đã chốt, có lưu giá cũ/mới', () => {
  const { db, rental } = setup('2026-11-10', '2026-11-10');
  const rec = B.changePrice(db, { rentalId: rental.id, rent: 1300000, elecPrice: 3000, waterPrice: 15000, effectiveFrom: '2026-12-10', reason: 'tăng giá' }, '2026-11-20');
  assert.equal(rec.old.rent, 1200000); assert.equal(db.invoices[0].total, 1200000);
  B.addPayment(db, { invoiceId: db.invoices[0].id, amount: 1200000 }, '2026-11-20');
  const inv = B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 110, waterNew: 11 }, '2026-12-10');
  assert.equal(inv.rent, 1300000); assert.equal(inv.elec.price, 2000); // điện kỳ trước tính giá cũ
  throwsCode(() => B.changePrice(db, { rentalId: rental.id, rent: 1, elecPrice: 1, waterPrice: 1, effectiveFrom: '2026-11-15' }, '2026-12-10'), 'PAST_PRICE');
});
t('hủy giao dịch có lý do, không xóa; sửa hóa đơn mới nhất có lịch sử', () => {
  const { db } = setup('2026-11-10', '2026-11-10'); const id = db.invoices[0].id;
  const p = B.addPayment(db, { invoiceId: id, amount: 500000 }, '2026-11-10');
  throwsCode(() => B.voidPayment(db, p.id, ''), 'BAD_REQUEST');
  B.voidPayment(db, p.id, 'nhập nhầm'); assert.equal(db.payments.length, 1); assert.equal(B.remainingOf(db, db.invoices[0]), 1200000);
  B.adjustInvoice(db, id, { extras: [{ label: 'Sửa khóa', amount: 50000 }], reason: 'phát sinh' }, '2026-11-11');
  assert.equal(db.invoices[0].total, 1250000); assert.equal(db.invoices[0].adjustments.length, 1);
});

console.log('TRẢ PHÒNG');
function scenario(payP1) {
  const { db, rental } = setup('2026-11-10', '2026-11-10');
  B.addPayment(db, { invoiceId: db.invoices[0].id, amount: 1200000 }, '2026-11-10');
  const inv = B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 150, waterNew: 12 }, '2026-12-10'); // điện 100.000 nước 30.000
  if (payP1) B.addPayment(db, { invoiceId: inv.id, amount: inv.total }, '2026-12-10');
  return { db, rental, inv };
}
t('VÍ DỤ CHUẨN: 1.200.000, 5 ngày, điện 100.000, nước 30.000 → hoàn 870.000', () => {
  // Kỳ mới đã trả đủ; kỳ này khách thuê 1.2M, trả phòng 15/12. Điện nước đã nằm trong hóa đơn kỳ mới → ở đây trả đủ kỳ mới (tiền phòng 1.2M).
  const { db, rental, inv } = scenario(true);
  // Điện nước còn thiếu từ 10/12 đến 15/12: 50 số x 2000 = 100.000 ; 2 khối x 15.000 = 30.000
  const c = B.computeCheckout(db, { rentalId: rental.id, date: '2026-12-15', elecFinal: 200, waterFinal: 14 }, '2026-12-15');
  assert.equal(c.rentPerDay, 40000); assert.equal(c.days, 5); assert.equal(c.actualRent, 200000);
  assert.equal(c.elec.amount, 100000); assert.equal(c.water.amount, 30000);
  assert.equal(c.carry, 0); assert.equal(c.total, -870000); assert.equal(c.direction, 'refund');
  const r = B.confirmCheckout(db, { rentalId: rental.id, date: '2026-12-15', elecFinal: 200, waterFinal: 14 }, '2026-12-15');
  assert.equal(r.record.refund.amount, 870000); assert.equal(db.rooms[0].status, 'empty'); assert.equal(db.rentals[0].status, 'ended'); validateDb(db);
  assert.equal(inv.rent, 1200000);
});
t('KỲ MỚI CHƯA THANH TOÁN: không trừ tiền trả trước, khách còn phải trả riêng', () => {
  const { db, rental, inv } = scenario(false); // nợ: 1.2M + 130.000 = 1.330.000, chưa trả đồng nào
  const c = B.computeCheckout(db, { rentalId: rental.id, date: '2026-12-15', elecFinal: 200, waterFinal: 14 }, '2026-12-15');
  // khách thực sự nợ: điện nước kỳ trước 130.000 + tiền phòng 5 ngày 200.000 + điện nước 5 ngày 130.000 = 460.000
  assert.equal(c.carry, inv.total); assert.equal(c.total, 460000); assert.equal(c.direction, 'owe');
  const r = B.confirmCheckout(db, { rentalId: rental.id, date: '2026-12-15', elecFinal: 200, waterFinal: 14 }, '2026-12-15');
  assert.equal(r.invoice.oldDebt, 1330000); assert.equal(B.remainingOf(db, db.invoices.find((i) => i.id === inv.id)), 0);
  assert.equal(db.invoices.reduce((s, i) => s + B.remainingOf(db, i), 0), 460000); // chỉ còn đúng 460.000, không tính hai lần
  B.addPayment(db, { invoiceId: r.invoice.id, amount: 460000 }, '2026-12-15');
  assert.equal(db.invoices.reduce((s, i) => s + B.remainingOf(db, i), 0), 0);
});
t('trả phòng khi kỳ mới CHƯA lập hóa đơn: tính tiền phòng theo ngày', () => {
  const { db, rental } = setup('2026-11-10', '2026-11-10'); B.addPayment(db, { invoiceId: db.invoices[0].id, amount: 1200000 }, '2026-11-10');
  const c = B.computeCheckout(db, { rentalId: rental.id, date: '2026-12-15', elecFinal: 200, waterFinal: 14 }, '2026-12-15');
  assert.equal(c.billed, false); assert.equal(c.actualRent, 200000); assert.equal(c.total, 200000 + 200000 + 60000);
});
t('trả phòng đúng ngày đầu kỳ (0 ngày) hoàn đủ tiền kỳ', () => { const { db, rental } = scenario(true); const c = B.computeCheckout(db, { rentalId: rental.id, date: '2026-12-10', elecFinal: 150, waterFinal: 12 }, '2026-12-10'); assert.equal(c.total, -1200000); });
t('trả phòng ngày 31 không vượt 1 tháng tiền phòng', () => { const { db, rental } = setup('2026-01-31', '2026-01-31'); B.addPayment(db, { invoiceId: db.invoices[0].id, amount: 1200000 }, '2026-01-31'); const c = B.computeCheckout(db, { rentalId: rental.id, date: '2026-02-27', elecFinal: 100, waterFinal: 10 }, '2026-02-27'); assert.equal(c.days, 27); assert.ok(c.actualRent <= 1200000); });

t('đã lập hóa đơn trước hạn kỳ sau thì không cho trả phòng trước ngày kỳ đó (tránh tính sai)', () => { const { db, rental } = setup('2026-11-10', '2026-11-10'); B.addPayment(db, { invoiceId: db.invoices[0].id, amount: 1200000 }, '2026-11-10'); B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 120, waterNew: 11 }, '2026-12-05'); throwsCode(() => B.computeCheckout(db, { rentalId: rental.id, date: '2026-12-06', elecFinal: 130, waterFinal: 12 }, '2026-12-06'), 'BILLED_AHEAD'); });

console.log('CHUYỂN PHÒNG');
t('chuyển phòng giữ chu kỳ, nợ liên kết đúng, lịch sử phòng cũ còn nguyên', () => {
  const { db, rental } = scenario(true);
  const out = B.transferRoom(db, { rentalId: rental.id, date: '2026-12-20', elecFinal: 180, waterFinal: 13, newRoomId: 'room-2', newInitElec: 0, newInitWater: 0 }, '2026-12-20');
  assert.equal(out.invoice.kind, 'transfer'); assert.equal(out.invoice.roomName, 'Phòng 1'); assert.equal(out.invoice.elec.amount, 60000);
  assert.equal(db.rooms[0].status, 'empty'); assert.equal(db.rooms[1].status, 'occupied');
  assert.equal(out.rental.chainId, rental.chainId); assert.equal(out.rental.firstPeriodIndex, 2);
  assert.equal(db.invoices.find((i) => i.kind === 'periodic' && i.periodIndex === 1).roomName, 'Phòng 1'); // hóa đơn cũ vẫn gắn phòng cũ
  const nxt = B.createPeriodicInvoice(db, { rentalId: out.rental.id, periodIndex: 2, elecNew: 30, waterNew: 2 }, '2027-01-10');
  assert.equal(nxt.roomName, 'Phòng 2'); assert.equal(nxt.oldDebt, out.invoice.total); assert.equal(out.invoice.total, 60000 + 15000); validateDb(db);
});

console.log('THÔNG BÁO');
t('chu trình thông báo: chưa ghi điện nước → chưa thanh toán → một phần → đủ → sắp tới kỳ', () => {
  const { db, rental } = setup('2026-11-10', '2026-11-10');
  assert.equal(buildReminders(db, '2026-11-10')[0].type, 'unpaid');
  B.addPayment(db, { invoiceId: db.invoices[0].id, amount: 800000 }, '2026-11-10');
  assert.equal(buildReminders(db, '2026-11-10')[0].type, 'partial');
  assert.equal(buildReminders(db, '2026-11-10')[0].remaining, 400000);
  assert.equal(buildReminders(db, '2026-11-10').length, 1);
  assert.equal(buildReminders(db, '2026-11-11')[0].type, 'overdue'); // qua ngày đến hạn mà còn nợ
  B.addPayment(db, { invoiceId: db.invoices[0].id, amount: 400000 }, '2026-11-11');
  assert.equal(buildReminders(db, '2026-11-12').length, 0);
  assert.equal(buildReminders(db, '2026-12-05')[0].type, 'upcoming');
  assert.equal(buildReminders(db, '2026-12-10')[0].type, 'need_readings');
  B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 120, waterNew: 11 }, '2026-12-10');
  assert.equal(buildReminders(db, '2026-12-10')[0].type, 'unpaid'); // thông báo "chưa ghi điện nước" biến mất
  assert.equal(buildReminders(db, '2026-12-11')[0].type, 'overdue');
});
t('quá hạn ưu tiên cao hơn; phòng trống/không khách không có thông báo; trả phòng không sinh kỳ mới', () => {
  const { db, rental } = setup('2026-11-10', '2026-11-10');
  assert.equal(buildReminders(db, '2026-11-10').filter((r) => r.roomName === 'Phòng 2').length, 0);
  B.addPayment(db, { invoiceId: db.invoices[0].id, amount: 1200000 }, '2026-11-10');
  B.confirmCheckout(db, { rentalId: rental.id, date: '2026-11-12', elecFinal: 100, waterFinal: 10 }, '2026-11-12');
  assert.equal(buildReminders(db, '2026-12-20').filter((r) => r.type === 'need_readings').length, 0);
  assert.ok(buildReminders(db, '2026-11-13').some((r) => r.type === 'refund_pending'));
});
t('API công khai KHÔNG chứa thông tin khách', () => {
  const { db } = setup('2026-11-10', '2026-11-10');
  const s = JSON.stringify(publicReminders(db, '2026-11-12'));
  for (const secret of ['Nguyễn Văn A', '0901234567', '001090000001', 'Hà Nội', '1990-05-20', 'Cục CS', 'tenantId', 'tenantName', 'rentalId']) assert.ok(!s.includes(secret), 'Lộ: ' + secret);
});
t('kiểm tra toàn vẹn dữ liệu bắt lỗi', () => { const db = emptyDb(); db.rooms[0].status = 'xxx'; throwsCode(() => validateDb(db), 'INVALID_DB'); });
console.log('DỌN DỮ LIỆU CŨ');
t('chỉ dọn khách trả phòng ≥ 2 năm; khách đang thuê (dù vào >2 năm) và khách mới trả KHÔNG bị đụng; giữ số liệu tiền', () => {
  const db = emptyDb('2023-01-01'); const mk = (room, start) => B.moveIn(db, { roomId: room, startDate: start, rent: 1000000, elecPrice: 1, waterPrice: 1, initElec: 0, initWater: 0, tenant: { ...person, fullName: 'Khách ' + room }, occupants: [{ fullName: 'Con ' + room, dob: '2015-01-01', gender: 'male' }] }, start);
  const old = mk('room-1', '2023-01-10'); B.addPayment(db, { invoiceId: old.invoice.id, amount: 1000000 }, '2023-01-10'); const co = B.confirmCheckout(db, { rentalId: old.rental.id, date: '2023-01-20', elecFinal: 0, waterFinal: 0 }, '2023-01-20');
  const longStay = mk('room-2', '2023-01-10'); B.addPayment(db, { invoiceId: longStay.invoice.id, amount: 1000000 }, '2023-01-10');
  db.tenants.find((x) => x.id === old.tenant.id).idImages.front = { id: 'i1', pathname: 'cccd/a/front.jpg', size: 1500000 };
  const today = '2026-11-02';
  let info = storageInfo(db, today); const e = info.eligible.find((x) => x.tenantId === old.tenant.id);
  assert.equal(info.eligible.length, 1); assert.equal(e.blocked, 'Chưa xác nhận hoàn tiền cho khách'); assert.equal(purgeOld(db, today).count, 0); // còn nợ hoàn tiền => giữ
  B.markRefunded(db, co.record.id, '2023-01-21', '2023-01-21');
  const r = purgeOld(db, today); assert.equal(r.count, 1); assert.deepEqual(r.paths, ['cccd/a/front.jpg']);
  const t = db.tenants.find((x) => x.id === old.tenant.id); assert.equal(t.cccd, ''); assert.equal(t.phone, ''); assert.equal(t.fullName, '(Đã xóa hồ sơ)');
  assert.equal(db.occupants.filter((o) => o.tenantId === old.tenant.id).length, 0); assert.equal(db.occupants.length, 1);
  assert.ok(!JSON.stringify(db.activityLogs).includes('Khách room-1')); assert.ok(db.invoices.some((i) => i.total !== undefined && i.tenantName === '(Đã xóa hồ sơ)'));
  assert.equal(db.tenants.find((x) => x.id === longStay.tenant.id).cccd, person.cccd); assert.equal(db.rentals.find((x) => x.id === longStay.rental.id).status, 'active');
  validateDb(db); assert.equal(purgeOld(db, today).count, 0); // chạy lại không làm gì
});
t('khách trả phòng mới 1 năm trước chưa bị dọn; cảnh báo dung lượng tính đúng %', () => {
  const db = emptyDb('2025-01-01'); const m = B.moveIn(db, { roomId: 'room-1', startDate: '2025-11-01', rent: 1000000, elecPrice: 1, waterPrice: 1, initElec: 0, initWater: 0, tenant: person }, '2025-11-01');
  B.addPayment(db, { invoiceId: m.invoice.id, amount: 1000000 }, '2025-11-01'); B.confirmCheckout(db, { rentalId: m.rental.id, date: '2025-11-01', elecFinal: 0, waterFinal: 0 }, '2025-11-01');
  db.tenants[0].idImages.front = { id: 'a', pathname: 'p', size: 950 * 1048576 / 1.9 };
  const i = storageInfo(db, '2026-11-02', 1024); assert.equal(i.eligible.length, 0); assert.ok(i.pct > 48 && i.pct < 49);
  assert.ok(storageInfo(db, '2026-11-02', 500).pct >= 90);
});

console.log('DÒNG TRẠNG THÁI');
t('bình thường: chỉ có % lưu trữ, không cảnh báo; token sắp hết/hết hạn thì có cảnh báo', () => {
  process.env.BLOB_READ_WRITE_TOKEN = 'x'; const st = { pct: 12.3, usedBytes: 126 * 1048576, limitBytes: 1024 * 1048576 };
  assert.equal(buildSystem({ today: '2026-11-02', tokenExpires: null, storage: st }).alerts.length, 0);
  assert.equal(buildSystem({ today: '2026-11-02', tokenExpires: '2027-11-01', storage: st }).alerts.length, 0);
  const a = buildSystem({ today: '2026-11-02', tokenExpires: '2026-11-20', storage: st }).alerts; assert.equal(a.length, 1); assert.equal(a[0].level, 'orange'); assert.match(a[0].text, /còn 18 ngày/);
  const b = buildSystem({ today: '2026-11-02', tokenExpires: '2026-11-01', storage: st }).alerts; assert.equal(b[0].level, 'red'); assert.match(b[0].text, /đã hết hạn/);
  delete process.env.BLOB_READ_WRITE_TOKEN; assert.match(buildSystem({ today: '2026-11-02', tokenExpires: null, storage: st }).alerts[0].text, /Vercel Blob/);
});

console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
