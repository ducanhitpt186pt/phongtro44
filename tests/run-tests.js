import assert from 'node:assert/strict';
import fs from 'node:fs';
import { addMonthsClamp, periodIndexOf, periodStart, todayVN } from '../lib/dates.js';
import { emptyDb, validateDb } from '../lib/schema.js';
import * as B from '../lib/billing.js';
import { buildReminders, buildSummary, publicReminders, readingsDue } from '../lib/reminders.js';
import { purgeOld, storageInfo } from '../lib/cleanup.js';
import { buildSystem } from '../lib/health.js';
import { solarToLunar, lunarToSolar } from '../public/js/lunar.js';
import * as EV from '../public/js/events-core.js';
import { analyze, roomSeries, usageOverview, ownerSeries, roomUsageBetween } from '../lib/usage.js';

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
t('ngày vào đã quá 1 kỳ: tự nhận biết, tạo hóa đơn mở đầu cho kỳ đang chạy (không cần chọn chế độ)', () => { const db = emptyDb(); const r = B.moveIn(db, { roomId: 'room-2', startDate: '2026-08-10', rent: 1000000, elecPrice: 1, waterPrice: 1, initElec: 0, initWater: 0, tenant: person }, '2026-11-01'); assert.equal(r.invoice.periodIndex, 2); assert.equal(r.invoice.total, 1000000); validateDb(db); });
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
t('không lập trùng kỳ, không lập quá sớm (bỏ qua tháng đi vắng có test riêng bên dưới)', () => {
  const { db, rental } = setup('2026-11-10', '2026-11-10');
  B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 150, waterNew: 12 }, '2026-12-10');
  throwsCode(() => B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 160, waterNew: 12 }, '2026-12-10'), 'DUPLICATE');
  throwsCode(() => B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 0, elecNew: 160, waterNew: 12 }, '2026-12-10'), 'DUPLICATE');
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
  const mo = B.monthStates(db, db.invoices[0].chainId); assert.equal(mo[0].outstanding, 200000); assert.equal(mo[1].outstanding, 1400000 - 200000 + 0 - 0 + 0 - 0 === 1200000 ? 1400000 : 1400000);
  B.addPayment(db, { invoiceId: db.invoices[0].id, amount: 100 }, '2026-12-10'); assert.equal(B.remainingOf(db, inv), 1600000 - 100); // thu riêng cho tháng cũ cũng trừ vào tổng, không tính trùng
  B.voidPayment(db, db.payments.slice(-1)[0].id, 'thử'); assert.equal(B.remainingOf(db, inv), 1600000);
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
t('chu trình thông báo: kỳ đầu (chưa ghi điện nước) chưa tính là nợ → ghi điện nước → chưa thanh toán → một phần → quá hạn → đủ', () => {
  const { db, rental } = setup('2026-11-10', '2026-11-10');
  assert.equal(buildReminders(db, '2026-11-10').length, 0, 'vào ở 10/11, chưa nhập điện nước: chưa có nợ, chưa có thông báo');
  assert.equal(buildReminders(db, '2026-11-25').length, 0, 'giữa tháng vẫn chưa tính là nợ (kể cả khi chưa nhận tiền phòng đầu kỳ)'); assert.equal(buildSummary(db, buildReminders(db, '2026-11-25')).totalRemaining, 0, 'tổng cần thu = 0 vì chưa tới kỳ ghi điện nước');
  assert.equal(buildReminders(db, '2026-12-05')[0].type, 'upcoming'); assert.equal(buildReminders(db, '2026-12-10')[0].type, 'need_readings');
  B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 120, waterNew: 11 }, '2026-12-10');
  const un = buildReminders(db, '2026-12-10')[0]; assert.equal(un.type, 'overdue', 'tiền phòng kỳ đầu chưa nhận, nay đã ghi điện nước kỳ sau → phát sinh nợ, đã quá hạn từ 11/11'); assert.equal(un.months.length, 2); assert.ok(buildSummary(db, buildReminders(db, '2026-12-10')).totalRemaining > 0, 'đã ghi điện nước → mới phát sinh nợ');
  B.addPayment(db, { invoiceId: db.invoices[0].id, amount: B.monthStates(db, rental.chainId)[0].outstanding }, '2026-12-10'); assert.equal(buildReminders(db, '2026-12-10')[0].type, 'unpaid', 'đã trả tháng 11: còn tháng 12 chưa trả, chưa tới hạn → Chưa thanh toán');
  assert.equal(buildReminders(db, '2026-12-11')[0].type, 'overdue', 'quá hạn chỉ từ sau ngày đến hạn của kỳ đã ghi điện nước (đến hạn 10/12 → quá hạn từ 11/12)');
  const inv2 = B.latestInvoice(db, rental.chainId); B.addPayment(db, { invoiceId: inv2.id, amount: 800000 }, '2026-12-11'); assert.equal(buildReminders(db, '2026-12-11')[0].type, 'overdue', 'trả một phần vẫn còn quá hạn');
  B.addPayment(db, { invoiceId: inv2.id, amount: B.remainingOf(db, inv2) }, '2026-12-11'); assert.equal(buildReminders(db, '2026-12-12').length, 0, 'thanh toán đủ: hết thông báo');
});
t('quá hạn ưu tiên cao hơn; phòng trống/không khách không có thông báo; trả phòng không sinh kỳ mới', () => {
  const { db, rental } = setup('2026-11-10', '2026-11-10');
  assert.equal(buildReminders(db, '2026-11-10').filter((r) => r.roomName === 'Phòng 2').length, 0);
  B.addPayment(db, { invoiceId: db.invoices[0].id, amount: 1200000 }, '2026-11-10');
  B.confirmCheckout(db, { rentalId: rental.id, date: '2026-11-12', elecFinal: 100, waterFinal: 10 }, '2026-11-12');
  assert.equal(buildReminders(db, '2026-12-20').filter((r) => r.type === 'need_readings').length, 0);
  assert.ok(buildReminders(db, '2026-11-13').some((r) => r.type === 'refund_pending'));
});
t('API công khai: KHÔNG BAO GIỜ có SĐT/CCCD/ngày sinh/địa chỉ/tên người ở cùng; họ tên chỉ hiện khi bật (mặc định bật), tắt là ẩn hẳn', () => {
  const { db } = setup('2026-11-10', '2026-11-10');
  db.occupants.push({ id: 'occ-test', tenantId: db.tenants[0].id, fullName: 'Người Ở Cùng X', dob: '2015-01-01', gender: 'male', phone: '0999999999', cccd: '001099000009', note: 'bí mật', noId: false, idImages: { front: null, back: null } });
  db.monthlyNotes.push({ id: 'n1', roomId: 'room-1', ym: '2026-11', text: 'mượn 500', updatedAt: '' });
  const on = publicReminders(db, '2026-11-12'); const s = JSON.stringify(on);
  for (const secret of ['0901234567', '001090000001', 'Hà Nội', '1990-05-20', 'Cục CS', 'tenantId', 'rentalId', 'Người Ở Cùng X', '0999999999', '001099000009', 'bí mật']) assert.ok(!s.includes(secret), 'Lộ: ' + secret);
  const r1 = on.roster.find((x) => x.roomName === 'Phòng 1'); assert.equal(r1.tenantName, 'Nguyễn Văn A'); assert.equal(r1.people, 2); assert.equal(r1.note, 'mượn 500'); assert.equal(r1.debt, 0, 'kỳ đầu chưa ghi điện nước: chưa tính là nợ'); assert.equal(on.roster.find((x) => x.roomName === 'Phòng 2').status, 'empty');
  db.meta.publicShowTenant = false; const off = JSON.stringify(publicReminders(db, '2026-11-12')); assert.ok(!off.includes('Nguyễn Văn A') && !off.includes('mượn 500'), 'tắt thì không được lộ tên/ghi chú');
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

console.log('ĐIỆN NƯỚC: XU HƯỚNG, RÒ RỈ, CHỦ NHÀ');
function monthsDb(elecUsages, waterUsages, start = '2026-01-10') {
  const db = emptyDb('2026-01-01'); const m = B.moveIn(db, { roomId: 'room-1', startDate: start, rent: 1000000, elecPrice: 1000, waterPrice: 1000, initElec: 1000, initWater: 100, tenant: person }, start);
  let e = 1000, w = 100;
  elecUsages.forEach((u, i) => { e += u; w += waterUsages[i]; const d = B.createPeriodicInvoice(db, { rentalId: m.rental.id, periodIndex: i + 1, elecNew: e, waterNew: w }, periodStart(start, i + 1)); B.addPayment(db, { invoiceId: d.id, amount: d.total }, periodStart(start, i + 1)); });
  return { db, rental: m.rental };
}
t('so với tháng trước + trung bình năm: điện tăng, nước giảm, cảnh báo khi vượt 30% so với TB', () => {
  const { db } = monthsDb([50, 50, 50, 70], [10, 10, 10, 5]); const a = analyze(roomSeries(db, 'room-1'), '2026-05-12');
  assert.equal(a.elec.cur, 70); assert.equal(a.elec.prev, 50); assert.equal(a.elec.trend, 'up'); assert.equal(a.elec.avg, 50); assert.ok(a.elec.alert, 'điện +40% so với TB phải cảnh báo');
  assert.equal(a.water.cur, 5); assert.equal(a.water.trend, 'down'); assert.ok(!a.water.alert, 'nước giảm không cảnh báo'); assert.equal(a.label, '2026-04');
  const o = usageOverview(db, '2026-05-12'); assert.equal(o.alerts.length, 1); assert.match(o.alerts[0].text, /Phòng 1: điện tăng 40%.*rò rỉ/);
});
t('tăng dưới 30% hoặc đúng 30% thì KHÔNG cảnh báo; dữ liệu 1 tháng dùng tháng trước làm mốc', () => {
  const { db } = monthsDb([50, 50, 50, 64], [10, 10, 10, 10]); assert.ok(!analyze(roomSeries(db, 'room-1'), '2026-05-12').elec.alert);
  const one = monthsDb([50, 70], [10, 10]); const a = analyze(roomSeries(one.db, 'room-1'), '2026-03-12'); assert.equal(a.elec.avg, 50); assert.ok(a.elec.alert);
});
t('phòng Chủ Nhà = đồng hồ tổng − tổng các phòng (nội suy theo ngày, ước tính phần sau lần ghi cuối)', () => {
  const { db } = monthsDb([50], [10]); // phòng 1: 10/01 chỉ số 1000 → 10/02 chỉ số 1050 (50 số / 31 ngày)
  assert.ok(db.rooms.some((r) => r.kind === 'owner')); 
  db.masterReadings.push({ id: 'm1', date: '2026-01-10', elec: 5000, water: 500, note: '', createdAt: '' }, { id: 'm2', date: '2026-02-10', elec: 5130, water: 520, note: '', createdAt: '' });
  const s = ownerSeries(db); assert.equal(s.length, 1); assert.equal(Math.round(s[0].rooms.elec), 50); assert.equal(Math.round(s[0].owner.elec), 80); assert.equal(Math.round(s[0].owner.water), 10);
  db.masterReadings.push({ id: 'm3', date: '2026-02-20', elec: 5200, water: 530, note: '', createdAt: '' }); const s2 = ownerSeries(db); assert.equal(s2[1].estimated, true); assert.ok(Math.abs(s2[1].rooms.elec - (50 / 31) * 10) < 0.01);
  validateDb(db); assert.equal(db.rooms.filter((r) => !r.kind).length, 7);
});
t('đồng hồ tổng: cảnh báo khi chủ nhà dùng tăng > 30% so với trung bình (sau khi mọi phòng đã chốt số)', () => {
  const { db } = monthsDb([0, 0, 0, 0], [0, 0, 0, 0]); const base = { elec: 5000, water: 500 }; const ms = [['2026-01-10', 0, 0], ['2026-02-10', 100, 10], ['2026-03-10', 200, 20], ['2026-04-10', 300, 30], ['2026-05-10', 450, 30]];
  ms.forEach(([d, e, w], i) => db.masterReadings.push({ id: 'm' + i, date: d, elec: base.elec + e, water: base.water + w, note: '', createdAt: '' }));
  const o = usageOverview(db, '2026-05-12'); assert.ok(o.owner.elec.alert); assert.ok(!o.owner.water.alert); assert.ok(o.alerts.some((a) => a.roomName === 'Chủ Nhà' && a.kind === 'elec'));
});

console.log('LỊCH ÂM – DƯƠNG, NGÀY LỄ, SỰ KIỆN');
t('đổi âm → dương khớp các mốc đã biết và đổi ngược lại đúng (2015–2040)', () => {
  assert.deepEqual(lunarToSolar(1, 1, 2026), [17, 2, 2026]); assert.deepEqual(lunarToSolar(15, 8, 2026), [25, 9, 2026]); assert.deepEqual(lunarToSolar(1, 1, 2025), [29, 1, 2025]); assert.deepEqual(lunarToSolar(1, 1, 2024), [10, 2, 2024]);
  let n = 0; for (let y = 2015; y <= 2040; y++) for (let m = 1; m <= 12; m++) for (const d of [1, 8, 15, 29]) { const s = lunarToSolar(d, m, y); assert.ok(s, `${d}/${m}/${y}`); const b = solarToLunar(s[0], s[1], s[2]); assert.ok(b.day === d && b.month === m && !b.leap, `${d}/${m}/${y} → ${s} → ${b.day}/${b.month}`); n++; } assert.ok(n > 1000);
  for (let dd = 0; dd < 4000; dd += 7) { const t0 = new Date(Date.UTC(2020, 0, 1) + dd * 86400000); const l = solarToLunar(t0.getUTCDate(), t0.getUTCMonth() + 1, t0.getUTCFullYear()); const back = lunarToSolar(l.day, l.month, l.year, l.leap); assert.deepEqual(back, [t0.getUTCDate(), t0.getUTCMonth() + 1, t0.getUTCFullYear()], `vòng 2 chiều ${t0.toISOString()}`); }
});
t('ngày lễ 2026: Tết 17/02, Giao thừa 16/02, Giỗ Tổ, Trung Thu 25/09, Quốc khánh 02/09', () => {
  const h = EV.holidaysInYear(2026); const f = (n) => h.find((x) => x.name.startsWith(n)).date;
  assert.equal(f('Mùng 1 Tết'), '2026-02-17'); assert.equal(f('Giao thừa'), '2026-02-16'); assert.equal(f('Tết Trung Thu'), '2026-09-25'); assert.equal(f('Quốc khánh'), '2026-09-02'); assert.equal(f('Rằm tháng Giêng'), '2026-03-03');
  assert.ok(EV.holidaysInMonth(2026, 9).length >= 2);
});
t('sự kiện dương lịch lặp hằng năm / 1 lần; âm lịch lặp hằng năm / 1 lần; 29/2 và 30 âm được xử lý', () => {
  const sol = { calendar: 'solar', day: 15, month: 3, year: 2026, repeat: true }; assert.deepEqual(EV.eventDatesInYear(sol, 2030), ['2030-03-15']);
  assert.deepEqual(EV.eventDatesInYear({ ...sol, repeat: false }, 2026), ['2026-03-15']); assert.deepEqual(EV.eventDatesInYear({ ...sol, repeat: false }, 2027), []);
  assert.deepEqual(EV.eventDatesInYear({ calendar: 'solar', day: 29, month: 2, repeat: true }, 2027), ['2027-02-28']);
  const lun = { calendar: 'lunar', day: 15, month: 8, year: 2026, repeat: true }; assert.deepEqual(EV.eventDatesInYear(lun, 2026), ['2026-09-25']); assert.deepEqual(EV.eventDatesInYear({ ...lun, repeat: false }, 2026), ['2026-09-25']); assert.deepEqual(EV.eventDatesInYear({ ...lun, repeat: false }, 2027), []);
  const dec = { calendar: 'lunar', day: 23, month: 12, repeat: true }; const all = [2026, 2027].flatMap((y) => EV.eventDatesInYear(dec, y)); assert.ok(all.length >= 2 && all.every((d) => d >= '2026-01-01'));
});
t('thông báo trước 3 ngày: hiện từ còn 3 ngày đến hết ngày diễn ra, qua ngày là hết; không trùng', () => {
  const ev = [{ id: 'a', name: 'Giỗ ông', calendar: 'solar', day: 20, month: 11, repeat: true }];
  assert.equal(EV.upcoming(ev, '2026-11-16').length, 0); assert.equal(EV.upcoming(ev, '2026-11-17')[0].left, 3); assert.equal(EV.upcoming(ev, '2026-11-20')[0].left, 0); assert.equal(EV.upcoming(ev, '2026-11-21').length, 0);
  const cross = [{ id: 'b', name: 'Sinh nhật', calendar: 'solar', day: 2, month: 1, repeat: true }]; assert.equal(EV.upcoming(cross, '2026-12-30').length, 1); // qua năm mới
  const once = [{ id: 'c', name: 'Họp', calendar: 'solar', day: 5, month: 6, year: 2026, repeat: false }]; assert.equal(EV.upcoming(once, '2027-06-04').length, 0);
});
t('lưới tháng bắt đầu Thứ Hai và có đủ số ngày', () => { const g = EV.monthGrid(2026, 11); assert.equal(g.length % 7, 0); assert.equal(g.filter(Boolean).length, 30); assert.equal(g.indexOf('2026-11-01'), 6); /* 01/11/2026 là Chủ nhật */ });

t('CHỦ NHÀ chỉ chốt & cảnh báo vào ngày của phòng tính tiền TRỄ NHẤT (các phòng chốt ngày 5, 10, 20 → ngày 20)', () => {
  const db = emptyDb('2026-01-01'); const mk = (room, start) => B.moveIn(db, { roomId: room, startDate: start, rent: 1000000, elecPrice: 1, waterPrice: 1, initElec: 0, initWater: 0, tenant: { ...person, fullName: 'K ' + room } }, start);
  const r1 = mk('room-1', '2026-01-05').rental, r2 = mk('room-2', '2026-01-10').rental, r3 = mk('room-3', '2026-01-20').rental;
  let n = 0; const bill = (r, p, e, today) => B.createPeriodicInvoice(db, { rentalId: r.id, periodIndex: p, elecNew: e, waterNew: 0 }, today);
  const base = [['2026-02-05', 'r1'], ['2026-02-10', 'r2']]; let e1 = 0, e2 = 0, e3 = 0;
  const master = (d, e) => db.masterReadings.push({ id: 'm' + ++n, date: d, elec: e, water: 0, note: '', createdAt: '' });
  master('2026-01-02', 1000); // mốc đầu (trước ngày các phòng vào ở)
  e1 = 100; bill(r1, 1, e1, '2026-02-05'); e2 = 100; bill(r2, 1, e2, '2026-02-10'); // phòng 3 chưa tới ngày 20
  master('2026-02-01', 1400); // kỳ [02/01 → 01/02]: phòng ghi 05/02 và 10/02 đã phủ; phòng 3 phải đợi đến 20/02
  let o = usageOverview(db, '2026-02-12'); assert.equal(o.owner, null, 'chưa chốt thì chưa có kết quả/cảnh báo'); assert.deepEqual(o.ownerPending.waiting.map((x) => x.room), ['Phòng 3']); assert.equal(o.ownerPending.waiting[0].expected, '2026-02-20');
  e3 = 100; bill(r3, 1, e3, '2026-02-20'); // phòng 3 ghi số ngày 20 → kỳ được chốt
  o = usageOverview(db, '2026-02-20'); assert.ok(o.owner && o.owner.completedOn === '2026-02-20', 'chốt vào ngày 20 (phòng trễ nhất)'); assert.equal(o.ownerPending, null); assert.ok(ownerSeries(db)[0].complete);
});
t('ngày chốt số: mặc định hôm nay; chọn ngày trong quá khứ được; tương lai / trước lần ghi trước bị từ chối; dùng cho nội suy', () => {
  const { db, rental } = setup('2026-11-10', '2026-11-10'); B.addPayment(db, { invoiceId: db.invoices[0].id, amount: 1200000 }, '2026-11-10');
  throwsCode(() => B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 150, waterNew: 12, readDate: '2026-12-20' }, '2026-12-10'), 'BAD_REQUEST');
  const inv = B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 150, waterNew: 12, readDate: '2026-12-08' }, '2026-12-10'); assert.equal(db.readings[0].date, '2026-12-08'); assert.equal(inv.issuedDate, '2026-12-10');
  B.addPayment(db, { invoiceId: inv.id, amount: inv.total }, '2026-12-10'); throwsCode(() => B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 2, elecNew: 160, waterNew: 13, readDate: '2026-12-07' }, '2027-01-10'), 'BAD_REQUEST');
});

t('mã Apps Script nhúng trong web (public/js/gas-code.js) GIỐNG HỆT docs/google-apps-script.gs; chỉ có thao tác thêm dòng', () => {
  const doc = fs.readFileSync(new URL('../docs/google-apps-script.gs', import.meta.url), 'utf8'); const js = fs.readFileSync(new URL('../public/js/gas-code.js', import.meta.url), 'utf8');
  assert.ok(js.includes(doc), 'gas-code.js lệch so với docs/google-apps-script.gs'); assert.ok(!/deleteRow|clearContent|clear\(|deleteSheet|setValue\(/.test(doc.replace(/setValues/g, '')), 'mã Apps Script không được có lệnh xóa/sửa'); assert.ok(doc.includes('THAY-CHUOI-BI-MAT-CUA-BAN'));
});

console.log('THANH TOÁN THEO THÁNG, BỎ QUA THÁNG ĐI VẮNG');
function monthsOwed(n) { // n tháng liên tiếp có hóa đơn, chưa ai trả
  const { db, rental } = setup('2026-01-10', '2026-01-10'); let e = 100; for (let i = 1; i < n; i++) { e += 10; B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: i, elecNew: e, waterNew: 10 }, periodStart('2026-01-10', i)); } return { db, rental };
}
t('ĐI VẮNG: tháng 6 không ghi → tháng 7 ghi, điện nước tính gộp từ số cũ của tháng 5; tháng 6 chỉ có tiền phòng', () => {
  const { db, rental } = setup('2026-01-10', '2026-01-10'); let e = 100, w = 10;
  for (let i = 1; i <= 4; i++) { e += 100; w += 10; const inv = B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: i, elecNew: e, waterNew: w }, periodStart('2026-01-10', i)); B.addPayment(db, { invoiceId: inv.id, amount: inv.total }, periodStart('2026-01-10', i)); } // đã ghi tới tháng 5 (kỳ 4): điện 500, nước 50
  assert.equal(db.readings.slice(-1)[0].elecNew, 500);
  const jul = B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 6, elecNew: 700, waterNew: 80, readDate: '2026-07-10' }, '2026-07-10'); // bỏ kỳ 5 (tháng 6)
  const periodic = db.invoices.filter((i) => i.kind === 'periodic').sort((a, b) => a.periodIndex - b.periodIndex);
  assert.deepEqual(periodic.map((i) => i.periodIndex), [0, 1, 2, 3, 4, 5, 6]); const jun = periodic[5];
  assert.equal(jun.elec, null); assert.equal(jun.total, 1200000); assert.match(jun.note, /tính gộp/);
  assert.equal(jul.elec.old, 500); assert.equal(jul.elec.new, 700); assert.equal(jul.elec.usage, 200); assert.equal(jul.water.usage, 30); assert.equal(jul.oldDebt, 1200000); assert.equal(jul.total, 1200000 + 200 * 2000 + 30 * 15000 + 1200000); validateDb(db);
  const um = B.unpaidMonths(db, jul.chainId); assert.deepEqual(um.map((m) => m.ym), ['2026-06', '2026-07']); // "Chưa thanh toán tháng 6, tháng 7"
});
t('THU RIÊNG TỪNG THÁNG: chọn tháng nào thu tháng đó; thông báo tháng đó biến mất; tổng nợ khớp, không tính trùng', () => {
  const { db, rental } = monthsOwed(3); const [m0, m1, m2] = db.invoices.filter((i) => i.kind === 'periodic'); const L = m2; const own = (i) => i.total - i.oldDebt;
  assert.equal(B.unpaidMonths(db, L.chainId).length, 3); assert.equal(B.remainingOf(db, L), L.total);
  B.addPayment(db, { invoiceId: m1.id, amount: own(m1) }, '2026-03-10'); // chỉ trả tháng 2 (tháng giữa)
  assert.deepEqual(B.unpaidMonths(db, L.chainId).map((m) => m.invoiceId), [m0.id, m2.id], 'tháng 2 hết nợ, tháng 1 và 3 còn');
  assert.equal(B.remainingOf(db, L), L.total - own(m1), 'tổng còn nợ giảm đúng số đã thu cho tháng 2');
  assert.equal(B.statusOf(db, L, '2026-03-12') === 'paid', false);
  throwsCode(() => B.addPayment(db, { invoiceId: m1.id, amount: 1 }, '2026-03-10'), 'PAID'); throwsCode(() => B.addPayment(db, { invoiceId: m0.id, amount: own(m0) + 1 }, '2026-03-10'), 'OVERPAY');
  B.addPayment(db, { invoiceId: m0.id, amount: own(m0) }, '2026-03-10'); B.addPayment(db, { invoiceId: L.id, amount: B.remainingOf(db, L), allMonths: true }, '2026-03-10');
  assert.equal(B.unpaidMonths(db, L.chainId).length, 0); assert.equal(B.remainingOf(db, L), 0); assert.equal(buildReminders(db, '2026-03-11').filter((r) => ['unpaid', 'partial', 'overdue', 'debt'].includes(r.type)).length, 0);
});
t('trả vào hóa đơn mới nhất: tự trừ dần các tháng cũ nhất trước (không bỏ sót tháng nào)', () => {
  const { db } = monthsOwed(3); const [m0, m1, m2] = db.invoices.filter((i) => i.kind === 'periodic'); const own = (i) => i.total - i.oldDebt; B.addPayment(db, { invoiceId: m2.id, amount: own(m0) + 500, allMonths: true }, '2026-03-10');
  const ms = B.monthStates(db, m2.chainId); assert.equal(ms[0].outstanding, 0); assert.equal(ms[1].outstanding, own(m1) - 500); assert.equal(ms[2].outstanding, own(m2));
});
t('BẤT BIẾN (kiểm thử ngẫu nhiên): tổng còn nợ của khách luôn = Σ tiền riêng từng tháng − Σ đã thu; mọi tháng ≥ 0; không bao giờ tính trùng', () => {
  let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let run = 0; run < 40; run++) {
    const { db, rental } = setup('2026-01-10', '2026-01-10'); let e = 100; let idx = 0; const chain = rental.chainId;
    for (let step = 0; step < 25; step++) {
      const L = B.latestInvoice(db, chain); const act = rnd();
      if (act < 0.35 && idx < 8) { idx = B.nextPeriodToBill(db, rental) + Math.floor(rnd() * 2); e += Math.floor(rnd() * 120); try { B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: idx, elecNew: e, waterNew: 10 + idx, manualDebt: rnd() < 0.1 ? 50000 : 0 }, periodStart('2026-01-10', idx)); } catch (x) { if (!x.code) throw x; } }
      else { const ms = B.monthStates(db, chain).filter((r) => r.outstanding > 0); if (ms.length) { const pick = ms[Math.floor(rnd() * ms.length)]; const all = rnd() < 0.4; const target = all ? L : pick.inv; const cap = all ? B.remainingOf(db, L) : pick.outstanding; if (cap > 0) B.addPayment(db, { invoiceId: target.id, amount: Math.max(1, Math.floor(cap * (0.2 + rnd() * 0.8))), allMonths: all }, '2026-12-31'); } }
      const states = B.monthStates(db, chain); const sumOwn = states.reduce((s, r) => s + Math.max(0, r.own), 0); const sumPaid = db.payments.filter((p) => p.chainId === chain && !p.voided).reduce((s, p) => s + p.amount, 0);
      const outstanding = states.reduce((s, r) => s + r.outstanding, 0); assert.ok(states.every((r) => r.outstanding >= 0), 'có tháng âm');
      assert.equal(B.remainingOf(db, B.latestInvoice(db, chain)), Math.max(0, sumOwn - sumPaid), `lần ${run}/${step}: tổng nợ lệch`); assert.equal(outstanding, Math.max(0, sumOwn - sumPaid), 'tổng các tháng ≠ tổng nợ');
    }
    validateDb(db);
  }
});

t('TRẢ PHÒNG: tiền phòng = số ngày × (giá ÷ 30); đã đóng đầu kỳ thì Nợ cũ = 0 và số đã thu được trừ riêng; chưa đóng thì hiện là Nợ cũ', () => {
  const { db, rental } = setup('2026-11-01', '2026-11-01'); const first = db.invoices[0]; B.addPayment(db, { invoiceId: first.id, amount: first.total }, '2026-11-01'); const base = B.baseline(db, rental);
  const r = B.confirmCheckout(db, { rentalId: rental.id, date: '2026-11-11', elecFinal: base.elec + 10, waterFinal: base.water + 1, extras: [] }, '2026-11-11'); const inv = r.invoice; const monthRent = first.rent;
  assert.equal(inv.daysUsed, 10); assert.equal(inv.actualRent, Math.round((monthRent / 30) * 10)); assert.equal(inv.carryNet, -monthRent, 'đã đóng đủ đầu kỳ → khoản đã thu trước = giá thuê, Nợ cũ = 0');
  assert.equal(inv.total, inv.actualRent + inv.elec.amount + inv.water.amount - monthRent, 'tổng = tiền phòng theo ngày + điện + nước − đã thu trước');
  const u = setup('2026-11-01', '2026-11-01'); const b2 = B.baseline(u.db, u.rental); const r2 = B.confirmCheckout(u.db, { rentalId: u.rental.id, date: '2026-11-11', elecFinal: b2.elec, waterFinal: b2.water, extras: [] }, '2026-11-11'); // chưa đóng đồng nào
  assert.equal(r2.invoice.carryNet, 0, 'chưa đóng: chưa thu = tiền phòng cả tháng, trừ đi phần thay bằng tiền phòng theo ngày → Nợ cũ 0'); assert.equal(r2.invoice.total, r2.invoice.actualRent, 'khách chưa đóng gì: chỉ còn phải trả tiền phòng đúng 10 ngày');
});

console.log('NỢ CŨ THEO THÁNG, PHÁT SINH KHI THU TIỀN, XÓA HÓA ĐƠN');
t('NỢ CŨ mặc định 0; chỉ là phần các tháng trước CHƯA TRẢ HẾT và ghi rõ nợ của tháng nào', () => {
  const { db, rental } = setup('2026-01-10', '2026-01-10'); const first = db.invoices[0]; B.addPayment(db, { invoiceId: first.id, amount: first.total - 200000 }, '2026-01-10');
  const i2 = B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 150, waterNew: 12 }, '2026-02-10'); assert.equal(i2.oldDebt, 200000); assert.deepEqual(i2.oldDebtMonths, [{ ym: '2026-01', amount: 200000 }], 'ghi rõ nợ của tháng 1');
  B.addPayment(db, { invoiceId: i2.id, amount: B.remainingOf(db, i2) }, '2026-02-10'); const i3 = B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 2, elecNew: 160, waterNew: 13 }, '2026-03-10'); assert.equal(i3.oldDebt, 0); assert.deepEqual(i3.oldDebtMonths, [], 'trả hết thì nợ cũ = 0');
});
t('PHÁT SINH khi bấm nhận tiền: cộng vào hóa đơn mới nhất kèm nội dung, rồi thu; hóa đơn trả phòng thì không', () => {
  const { db, rental } = setup('2026-01-10', '2026-01-10'); const inv = B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 150, waterNew: 12 }, '2026-02-10'); const t0 = inv.total;
  throwsCode(() => B.addPayment(db, { invoiceId: inv.id, amount: 1000, extraAmount: -5 }, '2026-02-10'), 'BAD_REQUEST');
  B.addPayment(db, { invoiceId: inv.id, amount: 100000, extraAmount: 50000, extraLabel: 'Sửa khóa cửa' }, '2026-02-10');
  assert.equal(inv.total, t0 + 50000); assert.deepEqual(inv.extras.slice(-1)[0], { label: 'Sửa khóa cửa', amount: 50000 }); assert.equal(B.remainingOf(db, inv), t0 + 50000 - 100000); assert.match(inv.adjustments.slice(-1)[0].reason, /Sửa khóa cửa/); validateDb(db);
  B.addPayment(db, { invoiceId: inv.id, amount: B.remainingOf(db, inv) }, '2026-02-10'); assert.equal(B.remainingOf(db, inv), 0);
  const { db: d2, rental: r2 } = setup('2026-11-01', '2026-11-01'); const b = B.baseline(d2, r2); const co = B.confirmCheckout(d2, { rentalId: r2.id, date: '2026-11-11', elecFinal: b.elec + 10, waterFinal: b.water + 1, extras: [] }, '2026-11-11'); if (co.invoice.total > 0) throwsCode(() => B.addPayment(d2, { invoiceId: co.invoice.id, amount: 1, extraAmount: 1000 }, '2026-11-11'), 'LOCKED');
});
t('XÓA hóa đơn từ một tháng trở đi (không phải hóa đơn đầu / trả phòng); xóa kèm thu tiền + chỉ số; nợ kỳ trước trở lại như cũ', () => {
  const { db, rental } = setup('2026-01-10', '2026-01-10'); const first = db.invoices[0]; B.addPayment(db, { invoiceId: first.id, amount: first.total - 300000 }, '2026-01-10');
  const remBefore = B.remainingOf(db, first); const nRead = db.readings.length; const i2 = B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 150, waterNew: 12 }, '2026-02-10'); B.addPayment(db, { invoiceId: i2.id, amount: 100000 }, '2026-02-10');
  assert.ok(first.rolledOver); const res = B.deleteInvoice(db, i2.id); assert.equal(res.paymentsRemoved, 1); assert.equal(res.amountRemoved, 100000);
  assert.equal(db.invoices.length, 1); assert.equal(first.rolledOver, undefined, 'bỏ dấu chuyển nợ'); assert.equal(B.remainingOf(db, first), remBefore, 'nợ tháng trước trở lại như cũ'); assert.equal(db.readings.length, nRead, 'chỉ số điện nước kỳ đó cũng bị xóa'); validateDb(db);
  throwsCode(() => B.deleteInvoice(db, first.id), 'LOCKED'); // hóa đơn đầu tiên
  const j2 = B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 150, waterNew: 12 }, '2026-02-10'); const j3 = B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 2, elecNew: 160, waterNew: 13 }, '2026-03-10');
  const res2 = B.deleteInvoice(db, j2.id); assert.equal(res2.invoicesRemoved, 2, 'xóa tháng 2 thì xóa luôn các tháng sau nó (tháng 3)'); assert.equal(db.invoices.length, 1); assert.equal(first.rolledOver, undefined); validateDb(db);
});

t('LỜI NHẮC ĐIỆN THOẠI (.ics): 6h sáng, báo trước 3 ngày + 1 ngày + đúng ngày; sự kiện lặp tạo nhiều lần; ký tự đặc biệt được thoát; dòng ≤ 75 byte', () => {
  const ev = [{ id: 'e1', name: 'Giỗ ông, bà; nhớ "thắp hương"', calendar: 'solar', day: 25, month: 12, repeat: true, note: 'bí mật' }]; const { count, ics } = EV.buildIcs(ev, { today: '2026-11-13', now: new Date('2026-11-13T00:00:00Z') });
  assert.equal(count, 3, '3 năm tới = 3 lần'); assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n')); assert.ok(ics.includes('DTSTART:20261225T060000') && ics.includes('DTSTART:20271225T060000'), 'bắt đầu 06:00');
  for (const tr of ['TRIGGER:-P3D', 'TRIGGER:-P1D', 'TRIGGER:PT0S']) assert.equal(ics.split(tr).length - 1, 3, tr); assert.ok(ics.includes('SUMMARY:Giỗ ông\\, bà\\; nhớ'), 'thoát dấu phẩy/chấm phẩy'); assert.ok(!ics.includes('bí mật'), 'không đưa ghi chú ra ngoài khi không yêu cầu');
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, 'dòng quá dài: ' + line.slice(0, 40));
  assert.equal(EV.buildIcs(ev, { today: '2026-11-13', alarms: [1], time: '07:30' }).ics.includes('T073000'), true); assert.equal(EV.buildIcs([{ ...ev[0], repeat: false, year: 2020 }], { today: '2026-11-13' }).count, 0, 'sự kiện 1 lần đã qua không có lần nào để nhắc');
  const lun = EV.buildIcs([{ id: 'e2', name: 'Rằm', calendar: 'lunar', day: 15, month: 8, repeat: true }], { today: '2026-11-13' }); assert.ok(lun.ics.includes('DTSTART:20270914T060000') || lun.ics.includes('DTSTART:20270915T060000') || lun.count === 3, 'sự kiện âm lịch: mỗi năm một ngày dương khác nhau');
});

t('XÓA KHÁCH NHẬP NHẦM (chỉ có hóa đơn đầu): xóa khách, hóa đơn, thu tiền; phòng về Trống; đã có tháng sau thì chặn', () => {
  const { db, rental } = setup('2026-11-10', '2026-11-10'); B.addPayment(db, { invoiceId: db.invoices[0].id, amount: 500000 }, '2026-11-10'); const tid = db.tenants[0].id;
  const r2 = B.undoMoveIn(db, rental.id); assert.equal(db.invoices.length, 0); assert.equal(db.payments.length, 0); assert.equal(db.rentals.length, 0); assert.ok(!db.tenants.some((t) => t.id === tid)); assert.equal(db.rooms.find((x) => x.id === 'room-1').status, 'empty'); assert.equal(r2.tenantRemoved, true); validateDb(db);
  const u = setup('2026-11-10', '2026-11-10'); B.createPeriodicInvoice(u.db, { rentalId: u.rental.id, periodIndex: 1, elecNew: 150, waterNew: 12 }, '2026-12-10'); throwsCode(() => B.undoMoveIn(u.db, u.rental.id), 'LOCKED');
});
t('SỬA NGÀY NHẬN PHÒNG: cập nhật mọi mốc của hóa đơn đầu; chặn khi đã có tháng sau hoặc ngày ở tương lai', () => {
  const { db, rental } = setup('2026-11-10', '2026-11-12'); B.addPayment(db, { invoiceId: db.invoices[0].id, amount: 300000 }, '2026-11-12');
  B.changeStartDate(db, rental.id, '2026-11-05', '2026-11-12'); const inv = db.invoices[0]; assert.equal(rental.startDate, '2026-11-05'); assert.equal(rental.anchorDate, '2026-11-05'); assert.equal(inv.dueDate, '2026-11-05'); assert.equal(inv.periodStart, '2026-11-05'); assert.equal(inv.periodEnd, '2026-12-04'); assert.equal(B.paidOf(db, inv.id), 300000, 'tiền đã thu giữ nguyên'); assert.equal(db.priceHistories[0].effectiveFrom, '2026-11-05'); validateDb(db);
  throwsCode(() => B.changeStartDate(db, rental.id, '2026-11-13', '2026-11-12'), 'BAD_REQUEST'); throwsCode(() => B.changeStartDate(db, rental.id, 'abc', '2026-11-12'), 'BAD_REQUEST');
  B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 150, waterNew: 12 }, '2026-12-05'); throwsCode(() => B.changeStartDate(db, rental.id, '2026-11-01', '2026-12-05'), 'LOCKED');
});
t('CHUYỂN PHÒNG: chỉ chuyển vào phòng ĐANG TRỐNG (phòng đang ở / sửa chữa / chưa sẵn sàng / Chủ Nhà bị từ chối)', () => {
  const { db, rental } = setup('2026-11-10', '2026-11-12'); const b = B.baseline(db, rental); const inp = (room) => ({ rentalId: rental.id, date: '2026-11-12', elecFinal: b.elec, waterFinal: b.water, newRoomId: room, newInitElec: 0, newInitWater: 0, newRent: 1000000, newElecPrice: 3000, newWaterPrice: 10000, extras: [] });
  for (const st of ['occupied', 'repair', 'notready']) { db.rooms.find((x) => x.id === 'room-2').status = st; assert.throws(() => B.transferRoom(db, inp('room-2'), '2026-11-12'), /Trống/, st); }
  assert.throws(() => B.transferRoom(db, inp('room-owner'), '2026-11-12'), /Trống/);
});

t('NHẬN KHÁCH MỚI + "đã thu tiền phòng kỳ đầu": ghi nhận thu luôn; không có thông báo nợ T11; T12 chỉ phát sinh nợ khi nhập điện nước', () => {
  const db = emptyDb('2026-01-01'); const m = B.moveIn(db, { roomId: 'room-1', startDate: '2026-11-01', rent: 1200000, elecPrice: 3000, waterPrice: 10000, initElec: 100, initWater: 10, paidAlready: true, tenant: { ...person } }, '2026-11-01');
  assert.equal(B.remainingOf(db, m.invoice), 0); assert.equal(db.payments.length, 1); assert.equal(db.payments[0].date, '2026-11-01'); assert.equal(db.payments[0].amount, 1200000); validateDb(db);
  assert.equal(buildReminders(db, '2026-11-20').length, 0, 'đã thu đầu tháng: không có thông báo chưa thanh toán T11'); assert.equal(B.unpaidMonths(db, m.rental.chainId).length, 0);
  const t12 = B.createPeriodicInvoice(db, { rentalId: m.rental.id, periodIndex: 1, elecNew: 150, waterNew: 15 }, '2026-12-01'); assert.equal(t12.oldDebt, 0, 'Nợ cũ = 0'); const um = B.unpaidMonths(db, m.rental.chainId); assert.deepEqual(um.map((x) => x.ym), ['2026-12'], 'chỉ nợ T12'); assert.equal(buildReminders(db, '2026-12-01')[0].type, 'unpaid'); assert.equal(buildReminders(db, '2026-12-02')[0].type, 'overdue');
  const u = emptyDb('2026-01-01'); const m2 = B.moveIn(u, { roomId: 'room-1', startDate: '2026-11-01', rent: 1200000, elecPrice: 3000, waterPrice: 10000, initElec: 100, initWater: 10, tenant: { ...person } }, '2026-11-01'); assert.equal(B.remainingOf(u, m2.invoice), 1200000, 'không tick thì vẫn chưa thu (cách cũ)');
});

t('ĐỔI NGÀY NHẬN PHÒNG sớm hơn: cập nhật ngay → tới/qua ngày ghi điện nước thì báo cần ghi (không còn "Không có việc cần xử lý")', () => {
  const { db, rental } = setup('2026-11-01', '2026-11-13'); assert.equal(buildReminders(db, '2026-11-13').length, 0, 'vào 1/11, hôm nay 13/11: chưa tới kỳ'); assert.equal(readingsDue(db, '2026-11-13').due.length, 0);
  B.changeStartDate(db, rental.id, '2026-10-01', '2026-11-13'); assert.equal(rental.firstPeriodIndex, 0); assert.equal(db.invoices[0].periodIndex, 0);
  const n = buildReminders(db, '2026-11-13'); assert.equal(n[0].type, 'need_readings', 'đã qua 1/11 mà chưa ghi điện nước → báo ngay'); assert.equal(n[0].dueDate, '2026-11-01');
  const r = readingsDue(db, '2026-11-13'); assert.equal(r.due.length, 1); assert.equal(r.due[0].roomName, 'Phòng 1'); assert.equal(r.due[0].daysLate, 12);
  assert.equal(readingsDue(db, '2026-10-27').soon[0].daysLeft, 5, 'sắp tới ngày ghi (trong 7 ngày) cũng được nhắc'); validateDb(db);
});

t('XÓA DÒNG của khách ĐÃ TRẢ PHÒNG (kể cả đã thanh toán / thanh toán 1 phần): xóa từ dòng đó trở đi; dòng đầu = xóa toàn bộ lịch sử thuê và hồ sơ khách', () => {
  const mk = () => { const { db, rental } = setup('2026-01-10', '2026-01-10'); const f = db.invoices[0]; B.addPayment(db, { invoiceId: f.id, amount: f.total }, '2026-01-10'); const i2 = B.createPeriodicInvoice(db, { rentalId: rental.id, periodIndex: 1, elecNew: 150, waterNew: 12 }, '2026-02-10'); B.addPayment(db, { invoiceId: i2.id, amount: 100000 }, '2026-02-10'); const b = B.baseline(db, rental); const co = B.confirmCheckout(db, { rentalId: rental.id, date: '2026-02-20', elecFinal: b.elec + 5, waterFinal: b.water + 1, extras: [] }, '2026-02-20'); return { db, rental, f, i2, co }; };
  let { db, f, i2, co } = mk(); assert.equal(db.rentals[0].status, 'ended'); const r1 = B.deleteInvoice(db, co.invoice.id); assert.equal(r1.invoicesRemoved, 1); assert.equal(db.checkoutRecords.length, 0, 'xóa hóa đơn trả phòng thì xóa luôn bản ghi hoàn tiền'); assert.equal(db.invoices.length, 2); assert.equal(i2.rolledOver, undefined); assert.equal(db.readings.filter((x) => x.final).length, 0); validateDb(db);
  ({ db, f, i2, co } = mk()); const r2 = B.deleteInvoice(db, i2.id); assert.equal(r2.invoicesRemoved, 2, 'xóa tháng 2 (đã thanh toán 1 phần) kéo theo hóa đơn trả phòng'); assert.equal(db.invoices.length, 1); assert.equal(db.checkoutRecords.length, 0); validateDb(db);
  ({ db, f, i2, co } = mk()); db.tenants[0].idImages.front = { id: 'img1', pathname: 'cccd/x.jpg', size: 1, uploadedAt: '2026-01-10T00:00:00Z' }; const r3 = B.deleteInvoice(db, f.id); assert.equal(r3.whole, true); assert.equal(db.invoices.length, 0); assert.equal(db.rentals.length, 0); assert.equal(db.tenants.length, 0, 'không còn lượt thuê nào → xóa hồ sơ khách'); assert.deepEqual(r3.paths, ['cccd/x.jpg']); assert.equal(db.payments.length, 0); assert.equal(db.readings.length, 0); assert.equal(db.priceHistories.length, 0); validateDb(db);
});

console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
