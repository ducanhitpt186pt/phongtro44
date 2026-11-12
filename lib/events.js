import { bad } from './errors.js';
const PALETTE = ['#ff3b30', '#ff9500', '#34c759', '#007aff', '#af52de', '#ff2d92', '#5ac8fa', '#8e8e93'];
const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export function cleanEvent(b) {
  const name = String(b.name || '').trim().slice(0, 100); if (!name) throw bad('Chưa nhập tên sự kiện');
  const calendar = b.calendar === 'lunar' ? 'lunar' : b.calendar === 'solar' ? 'solar' : null; if (!calendar) throw bad('Chọn lịch dương hoặc lịch âm');
  const day = Number(b.day), month = Number(b.month); const repeat = b.repeat !== false;
  if (!Number.isInteger(day) || !Number.isInteger(month) || month < 1 || month > 12 || day < 1) throw bad('Ngày/tháng của sự kiện không hợp lệ');
  let year = b.year === undefined || b.year === null || b.year === '' ? null : Number(b.year);
  if (year !== null && (!Number.isInteger(year) || year < 2000 || year > 2100)) throw bad('Năm của sự kiện không hợp lệ (2000–2100)');
  if (!repeat && year === null) throw bad('Sự kiện chỉ diễn ra 1 lần phải có năm');
  if (calendar === 'solar') { if (day > dim(year || 2024, month)) throw bad(`Tháng ${month}${year ? ` năm ${year}` : ''} không có ngày ${day}`); }
  else if (day > 30) throw bad('Ngày âm lịch tối đa là 30');
  const color = PALETTE.includes(b.color) ? b.color : '#007aff';
  return { name, calendar, day, month, year, leap: calendar === 'lunar' && !!b.leap, repeat, note: String(b.note || '').trim().slice(0, 300), color };
}
