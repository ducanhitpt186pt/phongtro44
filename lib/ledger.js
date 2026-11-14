// Quản Lý Thu Chi: sổ thu – chi cá nhân của chủ nhà. Chỉ dùng trong trang quản lý, KHÔNG hiện ra trang ngoài / không tạo thông báo.
import { bad } from './errors.js';
const iso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const str = (v, n) => String(v ?? '').trim().slice(0, n);
export function cleanEntry(b, today) {
  const type = b.type === 'expense' ? 'expense' : b.type === 'income' ? 'income' : null; if (!type) throw bad('Chọn Thu hoặc Chi');
  const date = str(b.date, 10) || today; if (!iso(date)) throw bad('Ngày không hợp lệ');
  const amount = Number(b.amount); if (!Number.isInteger(amount) || amount <= 0 || amount > 100_000_000_000) throw bad('Số tiền phải là số nguyên lớn hơn 0');
  return { type, date, amount, category: str(b.category, 60), note: str(b.note, 300) };
}
export function ledgerStats(db) {
  const days = {}, months = {}, years = {}; let income = 0, expense = 0;
  const add = (o, k, e) => { const r = o[k] = o[k] || { key: k, income: 0, expense: 0, count: 0 }; r[e.type] += e.amount; r.count++; };
  for (const e of db.ledger || []) { add(days, e.date, e); add(months, e.date.slice(0, 7), e); add(years, e.date.slice(0, 4), e); if (e.type === 'income') income += e.amount; else expense += e.amount; }
  const arr = (o) => Object.values(o).sort((a, b) => b.key.localeCompare(a.key));
  return { income, expense, balance: income - expense, count: (db.ledger || []).length, days: arr(days), months: arr(months), years: arr(years) };
}
