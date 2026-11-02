// LÕI TÍNH TIỀN - hàm thuần, có kiểm thử (tests/run-tests.js).
// Mô hình: tiền phòng thu TRƯỚC cho kỳ mới (tại ngày đến hạn); điện nước thu SAU (số tiêu thụ của kỳ trước, chốt tại ngày đến hạn).
// "Chuỗi" (chain) = một khách thuê liên tục, kể cả khi chuyển phòng. Nợ chỉ nằm ở HÓA ĐƠN MỚI NHẤT của chuỗi;
// hóa đơn cũ có nợ sẽ được đánh dấu rolledOver (đã chuyển nợ) nên không bao giờ bị tính hai lần.
import { ApiError, bad, notFound } from './errors.js';
import { addDays, diffDays, nowISO, periodEnd, periodIndexOf, periodStart } from './dates.js';

export const uid = (p) => `${p}-${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
const isMoney = (n) => Number.isInteger(n) && n >= 0;
const isNum = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
export const round = (n) => Math.round(n);

export const getRoom = (db, id) => db.rooms.find((r) => r.id === id);
export const getRental = (db, id) => db.rentals.find((r) => r.id === id);
export const chainInvoices = (db, chainId) => db.invoices.filter((i) => i.chainId === chainId);
export const latestInvoice = (db, chainId) => { const l = chainInvoices(db, chainId); return l[l.length - 1] || null; };
export const paidOf = (db, invoiceId) => db.payments.filter((p) => p.invoiceId === invoiceId && !p.voided).reduce((s, p) => s + p.amount, 0);

export function invoiceTotal(inv) {
  return inv.rent + (inv.elec?.amount || 0) + (inv.water?.amount || 0) + inv.oldDebt + inv.extrasTotal + (inv.adjustTotal || 0);
}
// Số tiền còn nợ của hóa đơn (không âm). Hóa đơn đã chuyển nợ => 0 (nợ nằm ở hóa đơn sau).
export function remainingOf(db, inv) {
  if (inv.rolledOver) return 0;
  return Math.max(0, inv.total - paidOf(db, inv.id));
}
export function statusOf(db, inv, today) {
  if (inv.rolledOver) return 'rolled';
  const paid = paidOf(db, inv.id);
  if (inv.total < 0) return 'refund';
  if (inv.total === 0 || paid >= inv.total) return 'paid';
  if (today > inv.dueDate) return 'overdue';
  return paid > 0 ? 'partial' : 'unpaid';
}
export function priceAt(db, rentalId, date) {
  const list = db.priceHistories.filter((p) => p.rentalId === rentalId).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom) || a.createdAt.localeCompare(b.createdAt));
  if (!list.length) throw new ApiError(500, 'Thiếu lịch sử giá của lượt thuê', 'NO_PRICE');
  let cur = list[0];
  for (const p of list) if (p.effectiveFrom <= date) cur = p;
  return cur;
}
// Chỉ số gần nhất (làm "chỉ số cũ" cho lần ghi tiếp theo)
export function baseline(db, rental) {
  const rs = db.readings.filter((r) => r.rentalId === rental.id).sort((a, b) => a.periodIndex - b.periodIndex);
  const last = rs[rs.length - 1];
  return last ? { elec: last.elecNew, water: last.waterNew } : { elec: rental.initElec, water: rental.initWater };
}
export function nextPeriodToBill(db, rental) {
  const ps = chainInvoices(db, rental.chainId).filter((i) => i.kind === 'periodic').map((i) => i.periodIndex);
  return ps.length ? Math.max(...ps) + 1 : rental.firstPeriodIndex;
}
export function activeRentalOfChain(db, chainId) {
  const rs = db.rentals.filter((r) => r.chainId === chainId);
  return rs.find((r) => r.status === 'active') || rs[rs.length - 1];
}
export function log(db, action, detail = '') {
  db.activityLogs.push({ id: uid('log'), at: nowISO(), action, detail });
  if (db.activityLogs.length > 1500) db.activityLogs.splice(0, db.activityLogs.length - 1500);
}
const code = (db) => { db.counters.invoice += 1; return `HD-${String(db.counters.invoice).padStart(5, '0')}`; };
function cleanExtras(extras) {
  const out = [];
  for (const e of extras || []) {
    const label = String(e.label || '').trim().slice(0, 100);
    const amount = Number(e.amount);
    if (!label && !e.amount) continue;
    if (!label) throw bad('Khoản phát sinh phải có nội dung');
    if (!Number.isInteger(amount) || amount === 0) throw bad(`Khoản phát sinh "${label}" phải là số tiền nguyên khác 0`);
    out.push({ label, amount });
  }
  return out;
}
function meterPart(oldV, newV, price, name) {
  if (!isNum(newV)) throw bad(`Chỉ số ${name} mới không hợp lệ`);
  if (newV < oldV) throw bad(`Chỉ số ${name} mới (${newV}) nhỏ hơn chỉ số cũ (${oldV}). Hãy kiểm tra lại đồng hồ.`, 'METER_DECREASED');
  const usage = Math.round((newV - oldV) * 1000) / 1000;
  return { old: oldV, new: newV, usage, price, amount: round(usage * price) };
}
function basicInvoice(db, rental, room, tenant) {
  return {
    id: uid('inv'), code: code(db), chainId: rental.chainId, rentalId: rental.id, roomId: room.id, roomName: room.name,
    tenantId: tenant.id, tenantName: tenant.fullName, createdAt: nowISO(), issuedDate: '', adjustments: [], rolledOver: null,
    extras: [], extrasTotal: 0, adjustLines: [], adjustTotal: 0, oldDebt: 0, rent: 0, elec: null, water: null, note: '',
  };
}
// Chuyển nợ của hóa đơn mới nhất sang hóa đơn mới => trả về số nợ chuyển.
function rollDebt(db, chainId, newInv, today) {
  const prev = latestInvoice(db, chainId);
  if (!prev) return 0;
  const rem = remainingOf(db, prev);
  if (rem > 0) prev.rolledOver = { amount: rem, toInvoiceId: newInv.id, date: today };
  else if (!prev.rolledOver) prev.settledFlag = true;
  return rem;
}

// ---- Lập hóa đơn kỳ p (kỳ >=1 cần chỉ số điện nước) ----
export function createPeriodicInvoice(db, { rentalId, periodIndex, elecNew, waterNew, extras, note }, today) {
  const rental = getRental(db, rentalId);
  if (!rental) throw notFound('Không tìm thấy lượt thuê');
  if (rental.status !== 'active') throw bad('Lượt thuê này đã kết thúc');
  const p = Number(periodIndex);
  const expected = nextPeriodToBill(db, rental);
  if (p !== expected) throw bad(`Kỳ cần lập tiếp theo là kỳ số ${expected + 1}. Không được bỏ kỳ hoặc lập trùng kỳ.`, 'WRONG_PERIOD');
  if (chainInvoices(db, rental.chainId).some((i) => i.kind === 'periodic' && i.periodIndex === p)) throw bad('Kỳ này đã có hóa đơn', 'DUPLICATE');
  const due = periodStart(rental.anchorDate, p);
  if (diffDays(today, due) > 7) throw bad(`Chưa tới kỳ này (đến hạn ${due}). Chỉ lập hóa đơn trước hạn tối đa 7 ngày.`, 'TOO_EARLY');
  const room = getRoom(db, rental.roomId);
  const tenant = db.tenants.find((t) => t.id === rental.tenantId);
  const inv = basicInvoice(db, rental, room, tenant);
  const price = priceAt(db, rental.id, due);
  inv.kind = 'periodic'; inv.periodIndex = p;
  inv.periodStart = due; inv.periodEnd = periodEnd(rental.anchorDate, p); inv.dueDate = due; inv.issuedDate = today;
  inv.rent = price.rent;
  const base = baseline(db, rental);
  // Kỳ lập qua hàm này luôn cần chỉ số mới (kỳ đầu tiên của khách được tạo khi vào ở, không cần chỉ số).
  const prevPrice = priceAt(db, rental.id, periodStart(rental.anchorDate, Math.max(p - 1, 0)));
  inv.elec = meterPart(base.elec, Number(elecNew), prevPrice.elecPrice, 'điện');
  inv.water = meterPart(base.water, Number(waterNew), prevPrice.waterPrice, 'nước');
  db.readings.push({ id: uid('rd'), rentalId: rental.id, roomId: room.id, periodIndex: p, date: today, elecOld: base.elec, elecNew: inv.elec.new, waterOld: base.water, waterNew: inv.water.new, elecPrice: prevPrice.elecPrice, waterPrice: prevPrice.waterPrice, history: [], createdAt: nowISO() });
  inv.extras = cleanExtras(extras); inv.extrasTotal = inv.extras.reduce((s, e) => s + e.amount, 0);
  inv.note = String(note || '').slice(0, 300);
  inv.oldDebt = rollDebt(db, rental.chainId, inv, today);
  inv.total = invoiceTotal(inv);
  db.invoices.push(inv);
  log(db, 'Lập hóa đơn', `${inv.code} - ${room.name} - kỳ ${p + 1} - ${inv.total}đ`);
  return inv;
}

// ---- Điều chỉnh hóa đơn MỚI NHẤT của chuỗi (có lưu lịch sử) ----
export function adjustInvoice(db, id, { elecNew, waterNew, extras, note, reason }, today) {
  const inv = db.invoices.find((i) => i.id === id);
  if (!inv) throw notFound('Không tìm thấy hóa đơn');
  if (latestInvoice(db, inv.chainId).id !== inv.id || inv.rolledOver) throw bad('Chỉ được điều chỉnh hóa đơn mới nhất của khách (hóa đơn cũ đã chốt, nợ đã chuyển kỳ sau).', 'LOCKED');
  if (inv.kind !== 'periodic') throw bad('Hóa đơn quyết toán/chuyển phòng không điều chỉnh tại đây', 'LOCKED');
  if (!String(reason || '').trim()) throw bad('Phải nhập lý do điều chỉnh');
  const before = JSON.parse(JSON.stringify({ elec: inv.elec, water: inv.water, extras: inv.extras, total: inv.total, note: inv.note }));
  const rd = db.readings.find((r) => r.rentalId === inv.rentalId && r.periodIndex === inv.periodIndex);
  if (inv.elec && elecNew !== undefined && waterNew !== undefined) {
    inv.elec = meterPart(inv.elec.old, Number(elecNew), inv.elec.price, 'điện');
    inv.water = meterPart(inv.water.old, Number(waterNew), inv.water.price, 'nước');
    if (rd) { rd.history.push({ at: nowISO(), elecNew: rd.elecNew, waterNew: rd.waterNew, reason }); rd.elecNew = inv.elec.new; rd.waterNew = inv.water.new; }
  }
  if (extras) { inv.extras = cleanExtras(extras); inv.extrasTotal = inv.extras.reduce((s, e) => s + e.amount, 0); }
  if (note !== undefined) inv.note = String(note).slice(0, 300);
  const newTotal = invoiceTotal(inv);
  if (newTotal < paidOf(db, inv.id)) throw bad('Tổng mới nhỏ hơn số tiền đã thu. Hãy hủy giao dịch thanh toán sai trước.', 'BELOW_PAID');
  inv.total = newTotal;
  inv.adjustments.push({ at: nowISO(), reason: String(reason).slice(0, 200), before, after: { elec: inv.elec, water: inv.water, extras: inv.extras, total: inv.total, note: inv.note } });
  log(db, 'Điều chỉnh hóa đơn', `${inv.code}: ${reason}`);
  return inv;
}

// ---- Thanh toán ----
export function addPayment(db, { invoiceId, amount, date, note }, today) {
  const inv = db.invoices.find((i) => i.id === invoiceId);
  if (!inv) throw notFound('Không tìm thấy hóa đơn');
  if (latestInvoice(db, inv.chainId).id !== inv.id || inv.rolledOver) throw bad('Hóa đơn này đã chuyển nợ sang kỳ sau. Hãy thu tiền ở hóa đơn mới nhất.', 'ROLLED');
  const amt = Number(amount);
  if (!Number.isInteger(amt) || amt <= 0) throw bad('Số tiền phải là số nguyên lớn hơn 0');
  const rem = remainingOf(db, inv);
  if (rem <= 0) throw bad('Hóa đơn này không còn khoản phải thu');
  if (amt > rem) throw bad(`Số tiền vượt quá khoản còn phải thu (${rem.toLocaleString('vi-VN')}đ)`, 'OVERPAY');
  const d = date || today;
  if (d > today) throw bad('Ngày thanh toán không được ở tương lai');
  const pay = { id: uid('pay'), invoiceId: inv.id, chainId: inv.chainId, rentalId: inv.rentalId, roomId: inv.roomId, amount: amt, date: d, note: String(note || '').slice(0, 200), voided: false, createdAt: nowISO() };
  db.payments.push(pay);
  log(db, 'Thu tiền', `${inv.code} - ${inv.roomName} - ${amt}đ`);
  return pay;
}
export function voidPayment(db, id, reason) {
  const p = db.payments.find((x) => x.id === id);
  if (!p) throw notFound('Không tìm thấy giao dịch');
  if (p.voided) throw bad('Giao dịch đã hủy trước đó');
  const inv = db.invoices.find((i) => i.id === p.invoiceId);
  if (latestInvoice(db, inv.chainId).id !== inv.id || inv.rolledOver) throw bad('Chỉ hủy được giao dịch của hóa đơn mới nhất (hóa đơn cũ đã chốt).', 'LOCKED');
  if (!String(reason || '').trim()) throw bad('Phải nhập lý do hủy giao dịch');
  p.voided = true; p.voidReason = String(reason).slice(0, 200); p.voidedAt = nowISO();
  log(db, 'Hủy giao dịch thu tiền', `${inv.code} - ${p.amount}đ - ${reason}`);
  return p;
}

// ---- Đổi giá ----
export function changePrice(db, { rentalId, rent, elecPrice, waterPrice, effectiveFrom, reason }, today) {
  const rental = getRental(db, rentalId);
  if (!rental || rental.status !== 'active') throw bad('Không tìm thấy lượt thuê đang hoạt động');
  if (![rent, elecPrice, waterPrice].every(isMoney) || rent <= 0) throw bad('Giá thuê/điện/nước phải là số nguyên không âm');
  const eff = effectiveFrom || today;
  const cur = priceAt(db, rental.id, eff);
  const lastBilled = Math.max(-1, ...chainInvoices(db, rental.chainId).filter((i) => i.kind === 'periodic').map((i) => i.periodIndex));
  if (lastBilled >= 0 && eff < periodStart(rental.anchorDate, lastBilled)) throw bad('Giá mới không được áp dụng lùi về kỳ đã lập hóa đơn (hóa đơn đã chốt không đổi). Hãy chọn ngày áp dụng từ kỳ chưa lập.', 'PAST_PRICE');
  const rec = { id: uid('pr'), rentalId: rental.id, roomId: rental.roomId, effectiveFrom: eff, rent, elecPrice, waterPrice, old: { rent: cur.rent, elecPrice: cur.elecPrice, waterPrice: cur.waterPrice }, reason: String(reason || '').slice(0, 200), createdAt: nowISO() };
  db.priceHistories.push(rec);
  log(db, 'Đổi giá', `${getRoom(db, rental.roomId).name}: ${cur.rent}→${rent}, điện ${cur.elecPrice}→${elecPrice}, nước ${cur.waterPrice}→${waterPrice} từ ${eff}`);
  return rec;
}

// ---- Trả phòng ----
// Quy tắc đã xác nhận: giá ngày = giá tháng / 30; tiền phòng thực tế = giá ngày x số ngày ở (tối đa bằng 1 tháng).
// Tổng quyết toán (total) = nợ còn lại của hóa đơn mới nhất + (điều chỉnh tiền phòng) + điện + nước + phát sinh.
//   - Nếu kỳ hiện tại ĐÃ lập hóa đơn: điều chỉnh = -(tiền phòng kỳ - tiền phòng thực tế)  [trả lại phần chưa dùng]
//   - Nếu kỳ hiện tại CHƯA lập hóa đơn: điều chỉnh = +tiền phòng thực tế
// total < 0: chủ nhà hoàn lại khách; total > 0: khách còn phải trả; total = 0: đã quyết toán.
// Kỳ chưa thanh toán KHÔNG được trừ tiền trả trước: phần chưa thu nằm trong "nợ còn lại" nên tự được cấn trừ đúng.
export function computeCheckout(db, { rentalId, date, elecFinal, waterFinal, extras }, today) {
  const rental = getRental(db, rentalId);
  if (!rental || rental.status !== 'active') throw bad('Không tìm thấy lượt thuê đang hoạt động');
  if (date > today) throw bad('Ngày trả phòng không được ở tương lai');
  if (date < rental.startDate) throw bad('Ngày trả phòng không được trước ngày vào ở');
  const k = periodIndexOf(rental.anchorDate, date);
  const L = latestInvoice(db, rental.chainId);
  if (!L) throw bad('Chưa có hóa đơn nào cho khách này');
  const lastPeriodic = Math.max(...chainInvoices(db, rental.chainId).filter((i) => i.kind === 'periodic').map((i) => i.periodIndex));
  if (lastPeriodic < k - 1) throw bad(`Còn kỳ chưa lập hóa đơn trước kỳ hiện tại. Hãy lập hóa đơn kỳ ${lastPeriodic + 2} trước khi trả phòng.`, 'UNBILLED');
  if (lastPeriodic > k) throw bad(`Đã lập hóa đơn kỳ ${lastPeriodic + 1} (bắt đầu ${periodStart(rental.anchorDate, lastPeriodic)}). Ngày trả phòng phải từ ngày đó trở đi, hoặc điều chỉnh/thu xếp hóa đơn kỳ này trước.`, 'BILLED_AHEAD');
  const billed = lastPeriodic === k;
  const periodStartDate = periodStart(rental.anchorDate, k);
  const days = Math.max(0, diffDays(periodStartDate, date));
  const currentPrice = priceAt(db, rental.id, periodStartDate);
  const monthRent = billed ? chainInvoices(db, rental.chainId).find((i) => i.kind === 'periodic' && i.periodIndex === k).rent : currentPrice.rent;
  const rentPerDay = monthRent / 30;
  const actualRent = Math.min(monthRent, round(rentPerDay * days));
  const base = baseline(db, rental);
  const pr = priceAt(db, rental.id, periodStart(rental.anchorDate, billed ? k : k - 1));
  const elec = meterPart(base.elec, Number(elecFinal), pr.elecPrice, 'điện');
  const water = meterPart(base.water, Number(waterFinal), pr.waterPrice, 'nước');
  const ex = cleanExtras(extras); const exTotal = ex.reduce((s, e) => s + e.amount, 0);
  const carry = remainingOf(db, L);
  const unused = monthRent - actualRent;
  const adjustLines = billed
    ? [{ label: `Trừ tiền thuê chưa sử dụng (kỳ đã lập: ${monthRent.toLocaleString('vi-VN')}đ - thực tế ${days} ngày ${actualRent.toLocaleString('vi-VN')}đ)`, amount: -unused }]
    : [{ label: `Tiền phòng thực tế ${days} ngày x ${Math.round(rentPerDay).toLocaleString('vi-VN')}đ`, amount: actualRent }];
  const adjustTotal = adjustLines.reduce((s, l) => s + l.amount, 0);
  const total = carry + adjustTotal + elec.amount + water.amount + exTotal;
  return { rental, L, billed, k, periodStartDate, days, monthRent, rentPerDay, actualRent, unused, elec, water, extras: ex, extrasTotal: exTotal, carry, adjustLines, adjustTotal, total, direction: total < 0 ? 'refund' : total > 0 ? 'owe' : 'settled' };
}
function finalInvoice(db, kind, c, date, today, label) {
  const room = getRoom(db, c.rental.roomId);
  const tenant = db.tenants.find((t) => t.id === c.rental.tenantId);
  const inv = basicInvoice(db, c.rental, room, tenant);
  inv.kind = kind; inv.periodIndex = c.k; inv.periodStart = c.periodStartDate; inv.periodEnd = date; inv.dueDate = date; inv.issuedDate = today;
  inv.elec = c.elec; inv.water = c.water; inv.extras = c.extras; inv.extrasTotal = c.extrasTotal;
  inv.adjustLines = kind === 'checkout' ? c.adjustLines : []; inv.adjustTotal = kind === 'checkout' ? c.adjustTotal : 0;
  inv.oldDebt = rollDebt(db, c.rental.chainId, inv, today);
  inv.total = invoiceTotal(inv);
  inv.note = label;
  db.invoices.push(inv);
  return inv;
}
export function confirmCheckout(db, input, today) {
  const c = computeCheckout(db, input, today);
  const { rental } = c;
  const inv = finalInvoice(db, 'checkout', c, input.date, today, 'Quyết toán trả phòng');
  db.readings.push({ id: uid('rd'), rentalId: rental.id, roomId: rental.roomId, periodIndex: 1000 + c.k, date: input.date, elecOld: c.elec.old, elecNew: c.elec.new, waterOld: c.water.old, waterNew: c.water.new, elecPrice: c.elec.price, waterPrice: c.water.price, history: [], final: true, createdAt: nowISO() });
  rental.status = 'ended'; rental.endDate = input.date;
  const room = getRoom(db, rental.roomId); room.status = 'empty';
  const rec = { id: uid('co'), rentalId: rental.id, chainId: rental.chainId, roomId: rental.roomId, tenantId: rental.tenantId, date: input.date, days: c.days, monthRent: c.monthRent, rentPerDay: c.rentPerDay, actualRent: c.actualRent, billedPeriod: c.billed, carry: c.carry, elec: c.elec, water: c.water, extras: c.extras, total: inv.total, direction: inv.total < 0 ? 'refund' : inv.total > 0 ? 'owe' : 'settled', invoiceId: inv.id, refund: inv.total < 0 ? { amount: -inv.total, status: 'pending', date: null } : null, note: String(input.note || '').slice(0, 300), createdAt: nowISO() };
  db.checkoutRecords.push(rec);
  log(db, 'Trả phòng', `${room.name} - ${rec.direction} ${Math.abs(inv.total)}đ`);
  return { record: rec, invoice: inv };
}
export function markRefunded(db, recordId, date, today) {
  const r = db.checkoutRecords.find((x) => x.id === recordId);
  if (!r || !r.refund) throw bad('Không có khoản hoàn tiền');
  if (r.refund.status === 'done') throw bad('Khoản hoàn tiền đã được xác nhận');
  r.refund.status = 'done'; r.refund.date = date || today;
  log(db, 'Xác nhận hoàn tiền trả phòng', `${r.refund.amount}đ`);
  return r;
}

// ---- Chuyển phòng ----
// Phòng cũ: lập hóa đơn "chuyển phòng" gồm điện nước đến ngày chuyển + nợ còn lại. Tiền phòng kỳ hiện tại (đã lập) được giữ nguyên cho phòng mới
// đến hết kỳ; chu kỳ thu tiền giữ nguyên theo ngày vào ở ban đầu. Giá thuê mới (nếu khác) áp dụng từ kỳ sau.
export function transferRoom(db, input, today) {
  const { rentalId, date, elecFinal, waterFinal, newRoomId, newInitElec, newInitWater, newRent, newElecPrice, newWaterPrice, extras } = input;
  const old = getRental(db, rentalId);
  if (!old || old.status !== 'active') throw bad('Không tìm thấy lượt thuê đang hoạt động');
  const newRoom = getRoom(db, newRoomId);
  if (!newRoom) throw bad('Chưa chọn phòng mới');
  if (newRoom.id === old.roomId) throw bad('Phòng mới phải khác phòng cũ');
  if (newRoom.status !== 'empty') throw bad('Phòng mới phải ở trạng thái Trống');
  if (date > today) throw bad('Ngày chuyển không được ở tương lai');
  if (date < old.startDate) throw bad('Ngày chuyển không được trước ngày vào ở');
  if (!isNum(Number(newInitElec)) || !isNum(Number(newInitWater))) throw bad('Chỉ số điện nước ban đầu của phòng mới không hợp lệ');
  const k = periodIndexOf(old.anchorDate, date);
  const lastPeriodic = Math.max(...chainInvoices(db, old.chainId).filter((i) => i.kind === 'periodic').map((i) => i.periodIndex));
  if (lastPeriodic !== k) throw bad('Hãy lập hóa đơn kỳ hiện tại trước khi chuyển phòng.', 'UNBILLED');
  const base = baseline(db, old);
  const oldPrice = priceAt(db, old.id, date);
  const elec = meterPart(base.elec, Number(elecFinal), oldPrice.elecPrice, 'điện');
  const water = meterPart(base.water, Number(waterFinal), oldPrice.waterPrice, 'nước');
  const ex = cleanExtras(extras);
  const c = { rental: old, k, periodStartDate: periodStart(old.anchorDate, k), elec, water, extras: ex, extrasTotal: ex.reduce((s, e) => s + e.amount, 0) };
  const inv = finalInvoice(db, 'transfer', c, date, today, `Chốt phòng cũ khi chuyển sang ${newRoom.name}`);
  const oldRoom = getRoom(db, old.roomId);
  old.status = 'transferred'; old.endDate = date; oldRoom.status = 'empty';
  const rent = newRent !== undefined && newRent !== '' ? Number(newRent) : oldPrice.rent;
  const ep = newElecPrice !== undefined && newElecPrice !== '' ? Number(newElecPrice) : oldPrice.elecPrice;
  const wp = newWaterPrice !== undefined && newWaterPrice !== '' ? Number(newWaterPrice) : oldPrice.waterPrice;
  if (![rent, ep, wp].every(isMoney) || rent <= 0) throw bad('Giá phòng mới không hợp lệ');
  const nr = { id: uid('rental'), chainId: old.chainId, roomId: newRoom.id, tenantId: old.tenantId, status: 'active', anchorDate: old.anchorDate, startDate: date, endDate: null, firstPeriodIndex: k + 1, initElec: Number(newInitElec), initWater: Number(newInitWater), headcount: old.headcount, note: old.note, transferredFrom: old.id, createdAt: nowISO() };
  db.rentals.push(nr);
  // giá mới có hiệu lực: điện/nước từ ngày chuyển; tiền phòng kỳ k+1 lấy theo giá này
  db.priceHistories.push({ id: uid('pr'), rentalId: nr.id, roomId: newRoom.id, effectiveFrom: date, rent, elecPrice: ep, waterPrice: wp, old: null, reason: `Chuyển từ ${oldRoom.name}`, createdAt: nowISO() });
  newRoom.status = 'occupied';
  db.roomTransfers.push({ id: uid('tf'), chainId: old.chainId, tenantId: old.tenantId, fromRentalId: old.id, toRentalId: nr.id, fromRoomId: oldRoom.id, toRoomId: newRoom.id, date, invoiceId: inv.id, createdAt: nowISO() });
  log(db, 'Chuyển phòng', `${oldRoom.name} → ${newRoom.name}`);
  return { invoice: inv, rental: nr };
}

// ---- Thêm khách thuê (vào phòng trống) ----
export function moveIn(db, input, today) {
  const room = getRoom(db, input.roomId);
  if (!room) throw bad('Chưa chọn phòng');
  if (room.status !== 'empty') throw bad(`${room.name} không ở trạng thái Trống nên không thêm khách mới được`);
  const rent = Number(input.rent), ep = Number(input.elecPrice), wp = Number(input.waterPrice);
  if (!Number.isInteger(rent) || rent <= 0) throw bad('Giá thuê phòng phải là số nguyên lớn hơn 0');
  if (!isMoney(ep) || !isMoney(wp)) throw bad('Giá điện/nước phải là số nguyên không âm');
  if (!isNum(Number(input.initElec)) || !isNum(Number(input.initWater))) throw bad('Chỉ số điện/nước ban đầu không hợp lệ');
  const start = input.startDate;
  const k = periodIndexOf(start, today);
  const existing = input.mode === 'existing';
  if (!existing && k > 0) throw bad('Khách đã ở quá 1 kỳ. Hãy chọn "Khách đã ở sẵn" và nhập chỉ số hiện tại của kỳ đang chạy.', 'USE_EXISTING');
  const t = input.tenant;
  const tenant = { id: uid('ten'), ...t, idImages: { front: null, back: null }, createdAt: nowISO() };
  db.tenants.push(tenant);
  for (const o of input.occupants || []) db.occupants.push({ id: uid('occ'), tenantId: tenant.id, ...o });
  const first = existing ? Math.max(k, 0) : 0;
  const rental = { id: uid('rental'), roomId: room.id, tenantId: tenant.id, status: 'active', anchorDate: start, startDate: start, endDate: null, firstPeriodIndex: first, initElec: Number(input.initElec), initWater: Number(input.initWater), headcount: Number(input.headcount) || 1, note: String(input.note || '').slice(0, 300), createdAt: nowISO() };
  rental.chainId = rental.id;
  db.rentals.push(rental);
  db.priceHistories.push({ id: uid('pr'), rentalId: rental.id, roomId: room.id, effectiveFrom: start, rent, elecPrice: ep, waterPrice: wp, old: null, reason: 'Giá ban đầu khi vào ở', createdAt: nowISO() });
  room.status = 'occupied';
  const inv = basicInvoice(db, rental, room, tenant);
  inv.kind = 'periodic'; inv.periodIndex = first; inv.periodStart = periodStart(start, first); inv.periodEnd = periodEnd(start, first); inv.dueDate = inv.periodStart; inv.issuedDate = today;
  inv.rent = rent;
  if (existing && Number(input.openingDebt) > 0) { if (!Number.isInteger(Number(input.openingDebt))) throw bad('Nợ cũ phải là số nguyên'); inv.oldDebt = Number(input.openingDebt); }
  inv.note = existing ? 'Hóa đơn mở đầu khi nhập khách đang ở sẵn' : 'Kỳ đầu - thu đủ tiền phòng';
  inv.total = invoiceTotal(inv);
  db.invoices.push(inv);
  if (existing && input.paidAlready && inv.total > 0) db.payments.push({ id: uid('pay'), invoiceId: inv.id, chainId: inv.chainId, rentalId: rental.id, roomId: room.id, amount: inv.total, date: input.paidDate && input.paidDate <= today ? input.paidDate : today, note: 'Đã thu trước khi nhập vào hệ thống', voided: false, createdAt: nowISO() });
  log(db, 'Thêm khách thuê', `${tenant.fullName} - ${room.name}`);
  return { tenant, rental, invoice: inv };
}
