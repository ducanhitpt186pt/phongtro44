// LÕI TÍNH TIỀN - hàm thuần, có kiểm thử (tests/run-tests.js).
// Mô hình: tiền phòng thu TRƯỚC cho kỳ mới (tại ngày đến hạn); điện nước thu SAU (số tiêu thụ của kỳ trước, chốt tại ngày đến hạn).
// "Chuỗi" (chain) = một khách thuê liên tục, kể cả khi chuyển phòng. Nợ chỉ nằm ở HÓA ĐƠN MỚI NHẤT của chuỗi;
// hóa đơn cũ có nợ sẽ được đánh dấu rolledOver (đã chuyển nợ) nên không bao giờ bị tính hai lần.
import { ApiError, bad, notFound } from './errors.js';
import { addDays, diffDays, isValidISO, nowISO, periodEnd, periodIndexOf, periodStart } from './dates.js';

export const uid = (p) => `${p}-${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
const isMoney = (n) => Number.isInteger(n) && n >= 0;
const isNum = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
export const round = (n) => Math.round(n);

export const getRoom = (db, id) => db.rooms.find((r) => r.id === id);
export const getRental = (db, id) => db.rentals.find((r) => r.id === id);
export const chainInvoices = (db, chainId) => db.invoices.filter((i) => i.chainId === chainId);
export const latestInvoice = (db, chainId) => { const l = chainInvoices(db, chainId); return l[l.length - 1] || null; };
const validPays = (db, chainId) => db.payments.filter((p) => p.chainId === chainId && !p.voided);
const idxInChain = (db, inv) => chainInvoices(db, inv.chainId).findIndex((i) => i.id === inv.id) + 1; // 1, 2, 3…
// Số hóa đơn của chuỗi tại thời điểm thanh toán (thanh toán cũ không có thì lấy vị trí hóa đơn của nó)
const payCount = (db, p) => p.invCount || idxInChain(db, db.invoices.find((i) => i.id === p.invoiceId) || { chainId: p.chainId, id: p.invoiceId });
// Tiền còn phải thu của HÓA ĐƠN MỚI NHẤT = tổng − các khoản đã thu SAU khi hóa đơn này được lập (kể cả thu riêng cho tháng cũ). Hóa đơn cũ luôn = 0 (nợ đã chuyển sang hóa đơn mới).
export function remainingOf(db, inv) {
  if (inv.rolledOver) return 0;
  const L = latestInvoice(db, inv.chainId); if (!L || L.id !== inv.id) return 0;
  const idx = idxInChain(db, inv); const paid = validPays(db, inv.chainId).filter((p) => payCount(db, p) >= idx).reduce((s, p) => s + p.amount, 0);
  return Math.max(0, inv.total - paid);
}
export function paidOf(db, invoiceId) {
  const inv = db.invoices.find((i) => i.id === invoiceId); if (!inv) return 0;
  const L = latestInvoice(db, inv.chainId);
  if (L && L.id === inv.id && !inv.rolledOver) return inv.total > 0 ? Math.max(0, Math.min(inv.total, inv.total - remainingOf(db, inv))) : 0;
  return db.payments.filter((p) => p.invoiceId === invoiceId && !p.voided).reduce((s, p) => s + p.amount, 0);
}
// Từng THÁNG (hóa đơn) của một khách: số tiền riêng của tháng, đã trả, còn phải trả. Thu riêng cho tháng nào thì trừ tháng đó; phần dư trừ dần các tháng cũ nhất.
export function monthStates(db, chainId) {
  const invs = chainInvoices(db, chainId); const pays = validPays(db, chainId);
  const isAll = (p) => (p.all !== undefined ? p.all : !p.invCount || p.invCount === idxInChain(db, db.invoices.find((i) => i.id === p.invoiceId) || { chainId, id: p.invoiceId })); // thu cũ (chưa có cờ) trên hóa đơn mới nhất = thu toàn bộ
  const rows = invs.map((inv) => { const own = inv.total - inv.oldDebt; const target = pays.filter((p) => p.invoiceId === inv.id && !isAll(p)).reduce((s, p) => s + p.amount, 0); const need = Math.max(0, own); const alloc = Math.min(need, target); return { inv, own, need, alloc, spill: target - alloc, paid: alloc, outstanding: need - alloc }; });
  let pool = rows.reduce((s, r) => s + r.spill, 0) + pays.filter(isAll).reduce((s, p) => s + p.amount, 0);
  for (const r of rows) { if (pool <= 0) break; const take = Math.min(pool, r.outstanding); r.outstanding -= take; r.paid += take; pool -= take; }
  return rows;
}
// Các tháng còn chưa thanh toán đủ (để báo "Chưa thanh toán tháng 5, tháng 6")
export function unpaidMonths(db, chainId) {
  return monthStates(db, chainId).filter((r) => r.outstanding > 0 && r.inv.kind === 'periodic').map((r) => ({ invoiceId: r.inv.id, ym: r.inv.dueDate.slice(0, 7), dueDate: r.inv.dueDate, amount: r.outstanding, code: r.inv.code }));
}
export function invoiceTotal(inv) {
  return inv.rent + (inv.elec?.amount || 0) + (inv.water?.amount || 0) + inv.oldDebt + (inv.manualDebt || 0) + inv.extrasTotal + (inv.adjustTotal || 0);
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
export function createPeriodicInvoice(db, { rentalId, periodIndex, elecNew, waterNew, extras, note, readDate, manualDebt }, today) {
  const rental = getRental(db, rentalId);
  if (!rental) throw notFound('Không tìm thấy lượt thuê');
  if (rental.status !== 'active') throw bad('Lượt thuê này đã kết thúc');
  const p = Number(periodIndex);
  const expected = nextPeriodToBill(db, rental);
  if (p < expected || chainInvoices(db, rental.chainId).some((i) => i.kind === 'periodic' && i.periodIndex === p)) throw bad('Kỳ này đã có hóa đơn', 'DUPLICATE');
  if (!Number.isInteger(p) || p > expected + 24) throw bad('Kỳ không hợp lệ', 'WRONG_PERIOD');
  const md = manualDebt === undefined || manualDebt === '' || manualDebt === null ? 0 : Number(manualDebt);
  if (!Number.isInteger(md) || md < 0) throw bad('Nợ cũ nhập thêm phải là số nguyên không âm');
  const rd = readDate || today; const lastRd = db.readings.filter((r) => r.rentalId === rental.id).map((r) => r.date).sort().pop();
  if (!isValidISO(rd)) throw bad('Ngày chốt số không hợp lệ');
  if (rd > today) throw bad('Ngày chốt số không được ở tương lai');
  if (lastRd && rd < lastRd) throw bad(`Ngày chốt số không được trước lần ghi trước (${lastRd.split('-').reverse().join('/')})`);
  const due = periodStart(rental.anchorDate, p);
  if (diffDays(today, due) > 7) throw bad(`Chưa tới kỳ này (đến hạn ${due}). Chỉ lập hóa đơn trước hạn tối đa 7 ngày.`, 'TOO_EARLY');
  const room = getRoom(db, rental.roomId);
  const tenant = db.tenants.find((t) => t.id === rental.tenantId);
  for (let q = expected; q < p; q++) { // tháng đi vắng không ghi điện nước: lập hóa đơn chỉ có tiền phòng, điện nước sẽ tính gộp ở kỳ sau
    const sk = basicInvoice(db, rental, room, tenant); const dueQ = periodStart(rental.anchorDate, q); sk.kind = 'periodic'; sk.periodIndex = q; sk.periodStart = dueQ; sk.periodEnd = periodEnd(rental.anchorDate, q); sk.dueDate = dueQ; sk.issuedDate = today; sk.rent = priceAt(db, rental.id, dueQ).rent;
    sk.note = 'Không ghi điện nước kỳ này – điện nước tính gộp vào kỳ sau'; sk.oldDebtMonths = unpaidMonths(db, rental.chainId).map((m) => ({ ym: m.ym, amount: m.amount })); sk.oldDebt = rollDebt(db, rental.chainId, sk, today); sk.total = invoiceTotal(sk); db.invoices.push(sk); log(db, 'Lập hóa đơn (bỏ qua điện nước)', `${sk.code} - ${room.name} - kỳ ${q + 1}`);
  }
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
  db.readings.push({ id: uid('rd'), rentalId: rental.id, roomId: room.id, periodIndex: p, date: rd, elecOld: base.elec, elecNew: inv.elec.new, waterOld: base.water, waterNew: inv.water.new, elecPrice: prevPrice.elecPrice, waterPrice: prevPrice.waterPrice, history: [], createdAt: nowISO() });
  inv.extras = cleanExtras(extras); inv.extrasTotal = inv.extras.reduce((s, e) => s + e.amount, 0);
  inv.manualDebt = md;
  inv.note = [p > expected ? `Điện nước tính gộp từ kỳ ${expected + 1}` : '', String(note || '').slice(0, 300)].filter(Boolean).join('. ');
  inv.oldDebtMonths = unpaidMonths(db, rental.chainId).map((m) => ({ ym: m.ym, amount: m.amount })); // nợ cũ còn lại của từng tháng trước
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
export function addPayment(db, { invoiceId, amount, date, note, allMonths, extraAmount, extraLabel }, today) {
  const inv = db.invoices.find((i) => i.id === invoiceId);
  if (!inv) throw notFound('Không tìm thấy hóa đơn');
  const ex = extraAmount === undefined || extraAmount === '' || extraAmount === null ? 0 : Number(extraAmount);
  if (!Number.isInteger(ex) || ex < 0) throw bad('Tiền phát sinh phải là số nguyên không âm');
  if (ex > 0) { // phát sinh khi thu tiền: cộng vào hóa đơn mới nhất của khách (kèm nội dung), rồi mới ghi nhận khoản thu
    const Lx = latestInvoice(db, inv.chainId);
    if (Lx.kind !== 'periodic') throw bad('Hóa đơn trả phòng / chuyển phòng không thêm phát sinh được ở đây. Hãy nhập ở ô "Chi phí khác" khi trả phòng.', 'LOCKED');
    const label = String(extraLabel || '').trim().slice(0, 100) || 'Chi phí khác'; const before = { total: Lx.total, extras: JSON.parse(JSON.stringify(Lx.extras)) };
    Lx.extras.push({ label, amount: ex }); Lx.extrasTotal = Lx.extras.reduce((s, e) => s + e.amount, 0); Lx.total = invoiceTotal(Lx);
    Lx.adjustments.push({ at: nowISO(), reason: `Phát sinh khi thu tiền: ${label}`, before, after: { extras: Lx.extras, total: Lx.total } }); log(db, 'Thêm phát sinh khi thu tiền', `${Lx.code} - ${label} - ${ex}đ`);
  }
  const L = latestInvoice(db, inv.chainId); const isLatest = L.id === inv.id;
  const amt = Number(amount);
  if (!Number.isInteger(amt) || amt <= 0) throw bad('Số tiền phải là số nguyên lớn hơn 0');
  const chainRem = remainingOf(db, L);
  if (chainRem <= 0) throw bad('Khách này không còn khoản phải thu');
  // allMonths (chỉ trên hóa đơn mới nhất): thu cho toàn bộ khoản nợ, trừ dần tháng cũ nhất trước. Ngược lại: thu riêng cho đúng tháng này.
  const all = isLatest ? allMonths !== false : false; // hóa đơn mới nhất: mặc định thu toàn bộ (trừ tháng cũ nhất trước); allMonths:false = chỉ thu riêng tháng này
  const cap = all ? chainRem : Math.min(chainRem, monthStates(db, inv.chainId).find((r) => r.inv.id === inv.id).outstanding);
  if (cap <= 0) throw bad('Tháng này đã thanh toán đủ', 'PAID');
  if (amt > cap) throw bad(`Số tiền vượt quá khoản còn phải thu${all ? '' : ' của tháng này'} (${cap.toLocaleString('vi-VN')}đ)`, 'OVERPAY');
  const d = date || today;
  if (d > today) throw bad('Ngày thanh toán không được ở tương lai');
  const pay = { id: uid('pay'), invoiceId: inv.id, chainId: inv.chainId, rentalId: inv.rentalId, roomId: inv.roomId, amount: amt, date: d, note: String(note || '').slice(0, 200), voided: false, all, invCount: chainInvoices(db, inv.chainId).length, createdAt: nowISO() };
  db.payments.push(pay);
  log(db, 'Thu tiền', `${inv.code} - ${inv.roomName} - ${amt}đ`);
  return pay;
}
export function voidPayment(db, id, reason) {
  const p = db.payments.find((x) => x.id === id);
  if (!p) throw notFound('Không tìm thấy giao dịch');
  if (p.voided) throw bad('Giao dịch đã hủy trước đó');
  const inv = db.invoices.find((i) => i.id === p.invoiceId); const L = latestInvoice(db, inv.chainId);
  if (payCount(db, p) < idxInChain(db, L)) throw bad('Giao dịch này đã được chốt vào hóa đơn kỳ sau nên không hủy được. Hãy thêm khoản điều chỉnh ở hóa đơn mới nhất.', 'LOCKED');
  if (!String(reason || '').trim()) throw bad('Phải nhập lý do hủy giao dịch');
  p.voided = true; p.voidReason = String(reason).slice(0, 200); p.voidedAt = nowISO();
  log(db, 'Hủy giao dịch thu tiền', `${inv.code} - ${p.amount}đ - ${reason}`);
  return p;
}

// Xóa hóa đơn của một tháng VÀ các tháng sau nó (nhập nhầm...). Xóa kèm các lần thu tiền và chỉ số điện nước của các kỳ đó; nợ tháng trước trở lại như trước khi lập.
// Hóa đơn đầu tiên (lập khi vào ở) không xóa riêng được: dùng undoMoveIn.
export function deleteInvoice(db, id) {
  const inv = db.invoices.find((i) => i.id === id); if (!inv) throw notFound('Không tìm thấy hóa đơn');
  const chain = chainInvoices(db, inv.chainId); const idx = chain.findIndex((i) => i.id === id);
  const rental = activeRentalOfChain(db, inv.chainId); const ended = !rental || rental.status !== 'active';
  if (ended) return deleteEnded(db, inv, chain, idx);
  if (idx === 0) throw bad('Đây là hóa đơn đầu tiên (lập khi khách vào ở). Nếu nhập nhầm khách, hãy dùng "Xóa khách (nhập nhầm)". Muốn xóa hóa đơn này riêng thì phải xóa các hóa đơn sau nó trước.', 'LOCKED');
  const gone = chain.slice(idx); if (gone.some((i) => i.kind !== 'periodic')) throw bad('Hóa đơn trả phòng / chuyển phòng không xóa được tại đây.', 'LOCKED');
  const ids = new Set(gone.map((i) => i.id)); const pays = db.payments.filter((p) => ids.has(p.invoiceId)); const amount = pays.filter((p) => !p.voided).reduce((s, p) => s + p.amount, 0);
  db.payments = db.payments.filter((p) => !ids.has(p.invoiceId));
  db.readings = db.readings.filter((r) => !(r.rentalId === inv.rentalId && !r.final && gone.some((i) => i.periodIndex === r.periodIndex)));
  db.invoices = db.invoices.filter((i) => !ids.has(i.id));
  const prev = chain[idx - 1]; if (prev.rolledOver && ids.has(prev.rolledOver.toInvoiceId)) delete prev.rolledOver;
  log(db, 'XÓA hóa đơn', `${gone.map((i) => i.code).join(', ')} - ${inv.roomName}; đã xóa ${pays.length} lần thu (${amount}đ)`);
  return { codes: gone.map((i) => i.code), invoicesRemoved: gone.length, paymentsRemoved: pays.length, amountRemoved: amount, paths: [] };
}
// Khách ĐÃ TRẢ PHÒNG / đã chuyển: xóa dòng này và các dòng sau nó (kể cả hóa đơn trả phòng + bản ghi hoàn tiền). Xóa dòng đầu tiên = xóa toàn bộ lịch sử thuê của lượt này (và hồ sơ khách nếu không còn lượt thuê nào khác).
function deleteEnded(db, inv, chain, idx) {
  const whole = idx === 0; const gone = whole ? chain : chain.slice(idx); const ids = new Set(gone.map((i) => i.id));
  const rentalIds = new Set(db.rentals.filter((r) => r.chainId === inv.chainId).map((r) => r.id));
  const pays = db.payments.filter((p) => ids.has(p.invoiceId)); const amount = pays.filter((p) => !p.voided).reduce((s, p) => s + p.amount, 0);
  db.payments = db.payments.filter((p) => !ids.has(p.invoiceId));
  db.checkoutRecords = db.checkoutRecords.filter((c) => !ids.has(c.invoiceId)); db.roomTransfers = db.roomTransfers.filter((t) => !ids.has(t.invoiceId));
  const hasFinal = gone.some((i) => i.kind !== 'periodic');
  db.readings = db.readings.filter((r) => { if (!rentalIds.has(r.rentalId)) return true; if (whole) return false; if (r.final) return !hasFinal; return !gone.some((i) => i.kind === 'periodic' && i.periodIndex === r.periodIndex); });
  db.invoices = db.invoices.filter((i) => !ids.has(i.id));
  const paths = []; let tenantRemoved = false;
  if (whole) {
    const tenantIds = new Set(db.rentals.filter((r) => r.chainId === inv.chainId).map((r) => r.tenantId));
    db.priceHistories = db.priceHistories.filter((x) => !rentalIds.has(x.rentalId)); db.rentals = db.rentals.filter((r) => r.chainId !== inv.chainId);
    for (const tid of tenantIds) { const tenant = db.tenants.find((t) => t.id === tid); if (!tenant || db.rentals.some((x) => x.tenantId === tid)) continue;
      for (const k of ['front', 'back']) if (tenant.idImages?.[k]) paths.push(tenant.idImages[k].pathname);
      for (const o of db.occupants.filter((x) => x.tenantId === tid)) for (const k of ['front', 'back']) if (o.idImages?.[k]) paths.push(o.idImages[k].pathname);
      db.occupants = db.occupants.filter((o) => o.tenantId !== tid); db.tenants = db.tenants.filter((t) => t.id !== tid); tenantRemoved = true; }
  } else { const prev = chain[idx - 1]; if (prev.rolledOver && ids.has(prev.rolledOver.toInvoiceId)) delete prev.rolledOver; }
  log(db, 'XÓA hóa đơn (khách đã trả phòng)', `${gone.map((i) => i.code).join(', ')} - ${inv.roomName}${whole ? ' - xóa toàn bộ lịch sử thuê' : ''}; đã xóa ${pays.length} lần thu (${amount}đ)`);
  return { codes: gone.map((i) => i.code), invoicesRemoved: gone.length, paymentsRemoved: pays.length, amountRemoved: amount, paths, tenantRemoved, whole };
}

// Hủy việc nhận khách (nhập nhầm): chỉ khi khách mới có hóa đơn đầu tiên. Xóa khách + người ở cùng + ảnh + hóa đơn + thu tiền; phòng về Trống.
export function undoMoveIn(db, rentalId) {
  const r = getRental(db, rentalId); if (!r) throw notFound('Không tìm thấy lượt thuê');
  if (r.status !== 'active') throw bad('Chỉ hủy được khách đang thuê.', 'LOCKED');
  if (r.chainId !== r.id || chainInvoices(db, r.chainId).length !== 1) throw bad('Khách đã có hóa đơn tháng sau (hoặc đã chuyển phòng). Hãy xóa các hóa đơn tháng sau trước (từ tháng mới nhất lùi dần), hoặc dùng Trả phòng.', 'LOCKED');
  const paths = []; const room = getRoom(db, r.roomId); const tenant = db.tenants.find((t) => t.id === r.tenantId);
  db.payments = db.payments.filter((p) => p.chainId !== r.chainId); db.invoices = db.invoices.filter((i) => i.chainId !== r.chainId); db.readings = db.readings.filter((x) => x.rentalId !== r.id);
  db.priceHistories = db.priceHistories.filter((x) => x.rentalId !== r.id); db.rentals = db.rentals.filter((x) => x.id !== r.id); if (room) room.status = 'empty';
  let tenantRemoved = false;
  if (tenant && !db.rentals.some((x) => x.tenantId === tenant.id)) {
    for (const k of ['front', 'back']) if (tenant.idImages?.[k]) paths.push(tenant.idImages[k].pathname);
    for (const o of db.occupants.filter((x) => x.tenantId === tenant.id)) for (const k of ['front', 'back']) if (o.idImages?.[k]) paths.push(o.idImages[k].pathname);
    db.occupants = db.occupants.filter((o) => o.tenantId !== tenant.id); db.tenants = db.tenants.filter((t) => t.id !== tenant.id); tenantRemoved = true;
  }
  log(db, 'XÓA khách nhập nhầm', `${room?.name || ''} - ${tenant?.fullName || ''}`); return { paths, tenantRemoved };
}

// Sửa ngày nhận phòng: chỉ khi khách mới có hóa đơn đầu tiên (chưa có tháng sau) để các kỳ thu tiền không bị lệch.
export function changeStartDate(db, rentalId, newStart, today) {
  const r = getRental(db, rentalId); if (!r || r.status !== 'active') throw notFound('Không tìm thấy lượt thuê đang hoạt động');
  if (!isValidISO(newStart)) throw bad('Ngày nhận phòng không hợp lệ'); if (newStart > today) throw bad('Ngày nhận phòng không được ở tương lai');
  if (r.chainId !== r.id || chainInvoices(db, r.chainId).length !== 1 || db.priceHistories.filter((x) => x.rentalId === r.id).length !== 1) throw bad('Khách đã có hóa đơn tháng sau hoặc đã đổi giá, sửa ngày nhận phòng sẽ làm lệch các kỳ thu tiền. Hãy xóa các hóa đơn tháng sau trước (từ tháng mới nhất lùi dần) rồi sửa.', 'LOCKED');
  const inv = chainInvoices(db, r.chainId)[0]; const k = periodIndexOf(newStart, today); const wasExisting = (r.firstPeriodIndex || 0) > 0; const first = wasExisting ? Math.max(k, 0) : 0; const old = r.startDate; // khách nhận như khách mới: giữ hóa đơn đầu là kỳ 0; các kỳ sau tới hạn sẽ báo ghi điện nước ngay
  r.startDate = newStart; r.anchorDate = newStart; r.firstPeriodIndex = first;
  inv.periodIndex = first; inv.periodStart = periodStart(newStart, first); inv.periodEnd = periodEnd(newStart, first); inv.dueDate = inv.periodStart;
  inv.note = wasExisting ? 'Hóa đơn mở đầu khi nhập khách đang ở sẵn' : 'Kỳ đầu - thu đủ tiền phòng';
  for (const ph of db.priceHistories.filter((x) => x.rentalId === r.id)) ph.effectiveFrom = newStart;
  log(db, 'Sửa ngày nhận phòng', `${inv.roomName}: ${old} → ${newStart}`); return r;
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
  if (kind === 'checkout') { inv.monthRent = c.monthRent; inv.rentBilled = c.billed; inv.carryBefore = c.carry; inv.daysUsed = c.days; inv.rentPerDay = c.rentPerDay; inv.actualRent = c.actualRent; inv.carryNet = c.carry - (c.billed ? c.monthRent : 0); } // để hóa đơn trả phòng hiện dòng Tiền phòng (giá thuê)
  inv.oldDebt = rollDebt(db, c.rental.chainId, inv, today);
  inv.total = invoiceTotal(inv);
  inv.note = label;
  db.invoices.push(inv);
  return inv;
}
export function confirmCheckout(db, input, today) {
  const c = computeCheckout(db, input, today);
  const { rental } = c;
  const inv = finalInvoice(db, 'checkout', c, input.date, today, 'Trả phòng');
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
  const existing = input.mode === 'existing' || k > 0; // tự nhận biết: ngày vào đã quá 1 kỳ => hóa đơn mở đầu cho kỳ đang chạy
  const t = input.tenant;
  const tenant = { id: uid('ten'), ...t, idImages: { front: null, back: null }, createdAt: nowISO() };
  db.tenants.push(tenant);
  const occupants = [];
  for (const o of input.occupants || []) { const rec = { id: uid('occ'), tenantId: tenant.id, ...o, idImages: { front: null, back: null }, createdAt: nowISO() }; db.occupants.push(rec); occupants.push(rec); }
  const first = existing ? Math.max(k, 0) : 0;
  const rental = { id: uid('rental'), roomId: room.id, tenantId: tenant.id, status: 'active', anchorDate: start, startDate: start, endDate: null, firstPeriodIndex: first, initElec: Number(input.initElec), initWater: Number(input.initWater), note: String(input.note || '').slice(0, 300), createdAt: nowISO() };
  rental.chainId = rental.id;
  db.rentals.push(rental);
  db.priceHistories.push({ id: uid('pr'), rentalId: rental.id, roomId: room.id, effectiveFrom: start, rent, elecPrice: ep, waterPrice: wp, old: null, reason: 'Giá ban đầu khi vào ở', createdAt: nowISO() });
  room.status = 'occupied';
  const inv = basicInvoice(db, rental, room, tenant);
  inv.kind = 'periodic'; inv.periodIndex = first; inv.periodStart = periodStart(start, first); inv.periodEnd = periodEnd(start, first); inv.dueDate = inv.periodStart; inv.issuedDate = today;
  inv.rent = rent;
  if (existing && Number(input.openingDebt) > 0) { if (!Number.isInteger(Number(input.openingDebt))) throw bad('Nợ cũ phải là số nguyên'); inv.manualDebt = Number(input.openingDebt); }
  inv.note = existing ? 'Hóa đơn mở đầu khi nhập khách đang ở sẵn' : 'Kỳ đầu - thu đủ tiền phòng';
  inv.total = invoiceTotal(inv);
  db.invoices.push(inv);
  // Tiền phòng kỳ đầu thường thu ngay lúc nhận phòng: tick "đã thu" thì ghi nhận luôn khoản thu (ngày thu = ngày nhận phòng, hoặc hôm nay nếu nhập khách đang ở sẵn)
  if (input.paidAlready && inv.total - (inv.manualDebt || 0) > 0) db.payments.push({ id: uid('pay'), invoiceId: inv.id, chainId: inv.chainId, rentalId: rental.id, roomId: room.id, amount: inv.total - (inv.manualDebt || 0), date: input.paidDate && input.paidDate <= today ? input.paidDate : existing ? today : (start <= today ? start : today), note: existing ? 'Đã thu trước khi nhập vào hệ thống' : 'Thu tiền phòng kỳ đầu khi nhận phòng', voided: false, all: true, invCount: 1, createdAt: nowISO() });
  log(db, 'Thêm khách thuê', `${tenant.fullName} - ${room.name}`);
  return { tenant, rental, invoice: inv, occupants };
}
