// Tự tính thông báo + số liệu dẫn xuất từ dữ liệu. Không lưu thông báo vào DB nên luôn đúng theo dữ liệu hiện tại.
import { diffDays, periodIndexOf, periodStart } from './dates.js';
import { activeRentalOfChain, baseline, chainInvoices, getRoom, latestInvoice, nextPeriodToBill, paidOf, priceAt, remainingOf, statusOf } from './billing.js';

export const UPCOMING_DAYS = 5;
const PRIORITY = { overdue: 1, debt: 2, need_readings: 3, unpaid: 4, partial: 5, upcoming: 6, ended_debt: 2, refund_pending: 3 };

export function invoiceDerived(db, today) {
  const out = {};
  for (const i of db.invoices) out[i.id] = { paid: paidOf(db, i.id), remaining: remainingOf(db, i), status: statusOf(db, i, today) };
  return out;
}

export function buildReminders(db, today) {
  const items = [];
  const chains = [...new Set(db.rentals.map((r) => r.chainId))];
  for (const chainId of chains) {
    const rental = activeRentalOfChain(db, chainId);
    const room = getRoom(db, rental.roomId);
    const inv = latestInvoice(db, chainId);
    if (!inv) continue;
    const rem = remainingOf(db, inv), paid = paidOf(db, inv.id);
    const base = { roomId: room.id, roomName: room.name, chainId };
    if (rental.status !== 'active') {
      if (rem > 0) items.push({ ...base, type: 'ended_debt', priority: PRIORITY.ended_debt, level: 'red', label: 'Còn nợ sau khi trả phòng', invoiceId: inv.id, total: inv.total, paid, remaining: rem, dueDate: inv.dueDate, periodLabel: inv.periodStart.slice(0, 7) });
      const co = db.checkoutRecords.find((c) => c.chainId === chainId && c.refund && c.refund.status === 'pending');
      if (co) items.push({ ...base, type: 'refund_pending', priority: PRIORITY.refund_pending, level: 'orange', label: 'Cần hoàn tiền cho khách đã trả phòng', invoiceId: inv.id, total: co.refund.amount, paid: 0, remaining: co.refund.amount, dueDate: co.date, periodLabel: co.date.slice(0, 7) });
      continue;
    }
    const nextP = nextPeriodToBill(db, rental);
    const nextDue = periodStart(rental.anchorDate, nextP);
    const flags = [];
    const common = { ...base, invoiceId: inv.id, total: inv.total, paid, remaining: rem, dueDate: inv.dueDate, periodLabel: inv.periodStart.slice(0, 7) };
    if (rem > 0 && today > inv.dueDate) flags.push({ type: 'overdue', level: 'red', label: 'Quá hạn thanh toán', ...common });
    else if (rem > 0 && inv.oldDebt > 0) flags.push({ type: 'debt', level: 'red', label: 'Còn công nợ (có nợ cũ)', ...common });
    if (today >= nextDue) flags.push({ type: 'need_readings', level: 'orange', label: 'Chưa ghi chỉ số điện nước', ...base, invoiceId: null, total: 0, paid: 0, remaining: 0, dueDate: nextDue, periodLabel: nextDue.slice(0, 7) });
    if (rem > 0 && !flags.some((f) => f.type === 'overdue' || f.type === 'debt')) {
      flags.push(paid > 0 ? { type: 'partial', level: 'orange', label: 'Đã thanh toán một phần', ...common } : { type: 'unpaid', level: 'orange', label: 'Chưa thanh toán', ...common });
    }
    if (!flags.length && rem === 0 && diffDays(today, nextDue) >= 0 && diffDays(today, nextDue) <= UPCOMING_DAYS) {
      flags.push({ type: 'upcoming', level: 'blue', label: 'Sắp đến ngày thu tiền', ...base, invoiceId: null, total: 0, paid: 0, remaining: 0, dueDate: nextDue, periodLabel: nextDue.slice(0, 7) });
    }
    if (!flags.length) continue;
    flags.sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type]);
    const top = flags[0];
    items.push({ ...top, priority: PRIORITY[top.type], also: flags.slice(1).map((f) => f.label), tenantId: rental.tenantId });
  }
  items.sort((a, b) => a.priority - b.priority || a.dueDate.localeCompare(b.dueDate) || a.roomName.localeCompare(b.roomName, 'vi', { numeric: true }));
  return items;
}

export function buildSummary(db, reminders) {
  const open = db.invoices.length ? [...new Set(db.rentals.map((r) => r.chainId))].map((c) => latestInvoice(db, c)).filter(Boolean) : [];
  const totalRemaining = open.reduce((s, i) => s + remainingOf(db, i), 0);
  const refundPending = reminders.filter((r) => r.type === 'refund_pending').reduce((s, r) => s + r.remaining, 0);
  return {
    rooms: db.rooms.length,
    needReadings: reminders.filter((r) => r.type === 'need_readings' || r.also?.includes('Chưa ghi chỉ số điện nước')).length,
    unpaidRooms: reminders.filter((r) => ['overdue', 'debt', 'unpaid', 'partial', 'ended_debt'].includes(r.type)).length,
    overdue: reminders.filter((r) => r.type === 'overdue').length,
    totalRemaining, refundPending,
  };
}

// Thông tin từng lượt thuê đang hoạt động để giao diện biết "kỳ tiếp theo", chỉ số cũ, giá hiện hành...
export function rentalDerived(db, today) {
  const out = {};
  for (const r of db.rentals) {
    if (r.status !== 'active') continue;
    const nextP = nextPeriodToBill(db, r);
    const b = baseline(db, r);
    const inv = latestInvoice(db, r.chainId);
    const nextDue = periodStart(r.anchorDate, nextP);
    out[r.id] = { currentPeriod: periodIndexOf(r.anchorDate, today), nextPeriod: nextP, nextDue, baseElec: b.elec, baseWater: b.water, price: priceAt(db, r.id, today > nextDue ? today : nextDue), canBill: diffDays(today, nextDue) <= 7, latestInvoiceId: inv?.id || null };
  }
  return out;
}

// Dữ liệu CÔNG KHAI: chỉ số phòng + số tiền + trạng thái. Tuyệt đối không có tên/SĐT/CCCD/địa chỉ.
export function publicReminders(db, today) {
  const list = buildReminders(db, today);
  const s = buildSummary(db, list);
  return {
    today, summary: s,
    items: list.map((r) => ({ roomName: r.roomName, type: r.type, level: r.level, label: r.label, also: r.also || [], period: r.periodLabel, dueDate: r.dueDate, total: r.total, paid: r.paid, remaining: r.remaining })),
  };
}
