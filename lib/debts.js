// Nhắc Nợ: sổ nợ riêng (không gắn với phòng). Mỗi khoản nợ có nhiều lần trả; còn lại = số nợ − tổng đã trả.
import { bad } from './errors.js';
const iso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const money = (v, label) => { const n = Number(v); if (!Number.isInteger(n) || n <= 0 || n > 100_000_000_000) throw bad(`${label} phải là số nguyên lớn hơn 0`); return n; };
export const KINDS = ['receivable', 'payable']; // Cần Thu (người khác nợ mình) / Cần Trả (mình nợ người khác)
export const kindOf = (d) => (d.kind === 'payable' ? 'payable' : 'receivable');
export const paidOf = (d) => (d.payments || []).reduce((s, p) => s + p.amount, 0);
export const remainingOf = (d) => Math.max(0, d.amount - paidOf(d));

export function cleanUnit(b) {
  const name = str(b.name, 100); if (!name) throw bad('Chưa nhập tên đơn vị nợ');
  const phone = str(b.phone, 20).replace(/[\s.-]/g, ''); if (phone && !/^\+?\d{8,15}$/.test(phone)) throw bad('Số điện thoại không hợp lệ');
  return { name, phone, note: str(b.note, 300) };
}
export function cleanDebt(b, today, units = []) {
  const name = str(b.name, 100); if (!name) throw bad('Chưa nhập tên người/đơn vị nợ');
  const date = str(b.date, 10) || today; if (!iso(date)) throw bad('Ngày nợ không hợp lệ');
  const unitId = str(b.unitId, 40); if (unitId && !units.some((u) => u.id === unitId)) throw bad('Đơn vị nợ đã chọn không còn trong danh sách');
  const kind = b.kind === undefined ? 'receivable' : b.kind; if (!KINDS.includes(kind)) throw bad('Chọn Cần Thu hoặc Cần Trả');
  return { kind, name, unitId, date, amount: money(b.amount, 'Số tiền nợ'), note: str(b.note, 2000) };
}
// b.all = true => trả hết phần còn lại
export function cleanPayment(b, d, today) {
  const date = str(b.date, 10) || today; if (!iso(date)) throw bad('Ngày trả không hợp lệ');
  const rem = remainingOf(d); if (rem <= 0) throw bad('Khoản nợ này đã trả hết');
  const amount = b.all ? rem : money(b.amount, 'Số tiền trả'); if (amount > rem) throw bad('Số tiền trả lớn hơn số còn nợ');
  return { date, amount, note: str(b.note, 1000) };
}
// Thống kê: tổng nợ phát sinh / đã thu theo tháng và năm (theo ngày nợ, ngày trả), + còn nợ theo từng đơn vị
export function debtStats(db, kind = 'receivable') {
  const debts = (db.debts || []).filter((d) => kindOf(d) === kind); const months = {}; const years = {}; const ensure = (m) => { const y = m.slice(0, 4); months[m] = months[m] || { ym: m, lent: 0, paid: 0 }; years[y] = years[y] || { year: y, lent: 0, paid: 0 }; return [months[m], years[y]]; };
  let total = 0, remaining = 0; const byUnit = {};
  for (const d of debts) {
    for (const o of ensure(d.date.slice(0, 7))) o.lent += d.amount; total += d.amount;
    for (const p of d.payments || []) for (const o of ensure(p.date.slice(0, 7))) o.paid += p.amount;
    const rem = remainingOf(d); remaining += rem; const k = d.unitId || `n:${d.name.toLowerCase()}`; const u = byUnit[k] = byUnit[k] || { key: k, name: d.name, unitId: d.unitId || '', lent: 0, paid: 0, remaining: 0, open: 0 };
    u.lent += d.amount; u.paid += d.amount - rem; u.remaining += rem; if (rem > 0) u.open++;
  }
  const arr = (o, k) => Object.values(o).sort((a, b) => b[k].localeCompare(a[k]));
  return { count: debts.length, openCount: debts.filter((d) => remainingOf(d) > 0).length, total, paid: total - remaining, remaining, months: arr(months, 'ym'), years: arr(years, 'year'), units: Object.values(byUnit).sort((a, b) => b.remaining - a.remaining || a.name.localeCompare(b.name)) };
}
// Trang công khai: chỉ tên + số còn nợ + ngày nợ (không lộ SĐT/ghi chú)
export function publicDebts(db, today) {
  const items = (db.debts || []).filter((d) => kindOf(d) === 'receivable' && remainingOf(d) > 0).map((d) => ({ id: d.id, name: d.name, date: d.date, remaining: remainingOf(d), days: Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${d.date}T00:00:00Z`)) / 86400000)) })).sort((a, b) => a.date.localeCompare(b.date));
  return { total: items.reduce((s, i) => s + i.remaining, 0), items };
}
