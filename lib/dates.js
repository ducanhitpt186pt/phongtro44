// Xử lý ngày theo múi giờ Việt Nam (UTC+7). Mọi ngày lưu dạng chuỗi "YYYY-MM-DD".
const pad = (n) => String(n).padStart(2, '0');
export const fmtISO = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export function parseISO(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return { y, m, d };
}
export function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
export function isValidISO(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parseISO(s);
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
}
export function nowVN(now = new Date()) { return new Date(now.getTime() + 7 * 3600 * 1000); }
export function todayVN(now = new Date()) { return nowVN(now).toISOString().slice(0, 10); }
export function nowISO(now = new Date()) { return nowVN(now).toISOString().slice(0, 19) + '+07:00'; }
const toUTC = (iso) => { const { y, m, d } = parseISO(iso); return Date.UTC(y, m - 1, d); };
export function diffDays(a, b) { return Math.round((toUTC(b) - toUTC(a)) / 86400000); }
export function addDays(iso, n) {
  const t = new Date(toUTC(iso) + n * 86400000);
  return fmtISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
// Cộng n tháng từ NGÀY GỐC (không cộng dồn); tháng đích thiếu ngày thì lấy ngày cuối tháng.
export function addMonthsClamp(iso, n) {
  const { y, m, d } = parseISO(iso);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12), nm = (total % 12) + 1;
  return fmtISO(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}
export const periodStart = (anchor, k) => addMonthsClamp(anchor, k);
export const periodEnd = (anchor, k) => addDays(periodStart(anchor, k + 1), -1);
// Kỳ hiện tại của một ngày (-1 nếu chưa tới ngày bắt đầu)
export function periodIndexOf(anchor, date) {
  if (date < anchor) return -1;
  const a = parseISO(anchor), t = parseISO(date);
  let k = (t.y * 12 + t.m) - (a.y * 12 + a.m);
  while (k > 0 && periodStart(anchor, k) > date) k--;
  while (periodStart(anchor, k + 1) <= date) k++;
  return Math.max(k, 0);
}
export const ymOf = (iso) => iso.slice(0, 7);
