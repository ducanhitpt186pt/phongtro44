// Logic sự kiện + ngày lễ (dùng chung cho giao diện và kiểm thử). Không phụ thuộc trình duyệt.
import { solarToLunar, lunarToSolar } from './lunar.js';
const pad = (n) => String(n).padStart(2, '0');
export const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const toUTC = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
export const addDays = (s, n) => { const t = new Date(toUTC(s) + n * 86400000); return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); };
export const palette = ['#ff3b30', '#ff9500', '#34c759', '#007aff', '#af52de', '#ff2d92', '#5ac8fa', '#8e8e93'];
export const lunarOf = (s) => { const [y, m, d] = s.split('-').map(Number); return solarToLunar(d, m, y); };
export const lunarLabel = (s) => { const l = lunarOf(s); return `${l.day}/${l.month}${l.leap ? ' nhuận' : ''}`; };

// Ngày âm → ISO dương. Nếu ngày 30 không tồn tại trong tháng thiếu thì lấy ngày 29.
export function lunarIso(ld, lm, ly, leap = false) {
  let r = lunarToSolar(ld, lm, ly, leap); if (!r && ld === 30) r = lunarToSolar(29, lm, ly, leap);
  if (!r && leap) r = lunarToSolar(ld, lm, ly, false); return r ? iso(r[2], r[1], r[0]) : null;
}
// Các ngày dương lịch (ISO) mà sự kiện rơi vào trong năm dương Y
export function eventDatesInYear(ev, Y) {
  if (ev.calendar === 'solar') {
    if (!ev.repeat) return ev.year === Y ? [iso(Y, ev.month, Math.min(ev.day, dim(Y, ev.month)))] : [];
    return [iso(Y, ev.month, Math.min(ev.day, dim(Y, ev.month)))];
  }
  const years = ev.repeat ? [Y - 1, Y] : [ev.year]; const out = [];
  for (const ly of years) { const s = lunarIso(ev.day, ev.month, ly, !ev.repeat && !!ev.leap); if (s && Number(s.slice(0, 4)) === Y && !out.includes(s)) out.push(s); }
  return out;
}
// Các lần xảy ra trong khoảng [from, to] (ISO, gồm cả hai đầu)
export function occurrences(events, from, to) {
  const y1 = Number(from.slice(0, 4)), y2 = Number(to.slice(0, 4)); const out = [];
  for (const ev of events) for (let y = y1; y <= y2; y++) for (const d of eventDatesInYear(ev, y)) if (d >= from && d <= to) out.push({ ev, date: d });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.ev.name.localeCompare(b.ev.name, 'vi'));
}
// Thông báo: sự kiện còn ≤ daysAhead ngày; vẫn hiện trong chính ngày diễn ra, qua ngày thì hết
export function upcoming(events, today, daysAhead = 3) { return occurrences(events, today, addDays(today, daysAhead)).map((o) => ({ ...o, left: diffDays(today, o.date) })); }
export function nextOccurrence(ev, today) { for (let y = Number(today.slice(0, 4)); y <= Number(today.slice(0, 4)) + 2; y++) for (const d of eventDatesInYear(ev, y)) if (d >= today) return d; return null; }

// ---- Ngày lễ Việt Nam ----
const SOLAR = [[1, 1, 'Tết Dương lịch', 'official'], [14, 2, 'Valentine', 'trad'], [8, 3, 'Quốc tế Phụ nữ', 'trad'], [30, 4, 'Giải phóng miền Nam', 'official'], [1, 5, 'Quốc tế Lao động', 'official'], [1, 6, 'Quốc tế Thiếu nhi', 'trad'], [27, 7, 'Thương binh Liệt sĩ', 'trad'], [2, 9, 'Quốc khánh', 'official'], [20, 10, 'Phụ nữ Việt Nam', 'trad'], [20, 11, 'Nhà giáo Việt Nam', 'trad'], [22, 12, 'Quân đội Nhân dân', 'trad'], [25, 12, 'Giáng sinh', 'trad']];
const LUNAR = [[1, 1, 'Mùng 1 Tết Nguyên Đán', 'official'], [2, 1, 'Mùng 2 Tết', 'official'], [3, 1, 'Mùng 3 Tết', 'official'], [15, 1, 'Rằm tháng Giêng', 'trad'], [10, 3, 'Giỗ Tổ Hùng Vương', 'official'], [15, 4, 'Lễ Phật Đản', 'trad'], [5, 5, 'Tết Đoan Ngọ', 'trad'], [15, 7, 'Vu Lan', 'trad'], [15, 8, 'Tết Trung Thu', 'trad'], [23, 12, 'Ông Táo chầu trời', 'trad']];
export function holidaysInYear(Y) {
  const out = SOLAR.map(([d, m, name, kind]) => ({ date: iso(Y, m, d), name, kind, cal: 'solar' }));
  for (const [d, m, name, kind] of LUNAR) { const s = lunarIso(d, m, Y); if (s) out.push({ date: s, name, kind, cal: 'lunar', lunar: `${d}/${m}` }); }
  const tet = lunarIso(1, 1, Y); if (tet) out.push({ date: addDays(tet, -1), name: 'Giao thừa (30/29 Tết)', kind: 'official', cal: 'lunar' });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
export const holidaysInMonth = (Y, M) => holidaysInYear(Y).filter((h) => h.date.startsWith(`${Y}-${pad(M)}`));
// Lưới tháng: tuần bắt đầu từ Thứ Hai
export function monthGrid(Y, M) {
  const first = new Date(Date.UTC(Y, M - 1, 1)).getUTCDay(); const lead = (first + 6) % 7; const days = dim(Y, M); const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null); for (let d = 1; d <= days; d++) cells.push(iso(Y, M, d)); while (cells.length % 7) cells.push(null); return cells;
}
