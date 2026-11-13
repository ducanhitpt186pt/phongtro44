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

// ---- Lời nhắc điện thoại: tạo file .ics (Lịch của iPhone/Android/Google Calendar đều mở được) ----
const icsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const byteLen = (s) => new TextEncoder().encode(s).length;
function fold(line) { // gấp dòng tối đa 75 byte theo chuẩn iCalendar
  if (byteLen(line) <= 75) return line; const parts = []; let cur = '', limit = 75;
  for (const ch of line) { if (byteLen(cur + ch) > limit) { parts.push(cur); cur = ch; limit = 74; } else cur += ch; }
  parts.push(cur); return parts.join('\r\n ');
}
const stamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
// Mỗi lần diễn ra (trong `years` năm tới) là một sự kiện lúc `time` (mặc định 06:00), có chuông báo trước 3 ngày, 1 ngày và đúng ngày (mặc định).
export function buildIcs(events, { time = '06:00', alarms = [3, 1, 0], years = 3, today, now = new Date(), withNote = false } = {}) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time)); const hh = m ? Math.min(23, Number(m[1])) : 6, mm = m ? Math.min(59, Number(m[2])) : 0;
  const alarmDays = [...new Set(alarms.map(Number).filter((d) => [0, 1, 2, 3, 7].includes(d)))].sort((a, b) => b - a);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nha tro 44//VI', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Nhà trọ 44'];
  let count = 0; const to = addDays(today, 366 * years);
  for (const ev of events) {
    for (const o of occurrences([ev], today, to).slice(0, 12)) {
      const [y, mo, d] = o.date.split('-'); const start = `${y}${mo}${d}T${pad(hh)}${pad(mm)}00`; const endMin = hh * 60 + mm + 30; const end = `${y}${mo}${d}T${pad(Math.min(23, Math.floor(endMin / 60)))}${pad(endMin % 60 > 59 ? 59 : endMin % 60)}00`;
      const desc = [`Âm lịch: ${lunarLabel(o.date)}`, withNote && ev.note ? `Ghi chú: ${ev.note}` : ''].filter(Boolean).join('\n');
      lines.push('BEGIN:VEVENT', `UID:nt44-${String(ev.id || ev.name).replace(/[^A-Za-z0-9]/g, '')}-${o.date}@nhatro44`, `DTSTAMP:${stamp(now)}`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${icsEsc(ev.name)}`, `DESCRIPTION:${icsEsc(desc)}`);
      for (const k of alarmDays) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(`${ev.name} – ${k === 0 ? 'hôm nay' : k === 1 ? 'ngày mai' : `còn ${k} ngày`}`)}`, `TRIGGER:${k === 0 ? 'PT0S' : `-P${k}D`}`, 'END:VALARM');
      lines.push('END:VEVENT'); count++;
    }
  }
  lines.push('END:VCALENDAR'); return { count, ics: lines.map(fold).join('\r\n') + '\r\n' };
}
