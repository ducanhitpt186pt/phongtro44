// Âm lịch Việt Nam (múi giờ UTC+7) - thuật toán Hồ Ngọc Đức.
const TZ = 7;
function jdFromDate(dd, mm, yy) {
  const a = Math.floor((14 - mm) / 12), y = yy + 4800 - a, m = mm + 12 * a - 3;
  let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  if (jd < 2299161) jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  return jd;
}
function newMoonDay(k) {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr) - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr)) - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr)) + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const dt = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3 : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Math.floor(Jd1 + C1 - dt + 0.5 + TZ / 24);
}
function sunLongitude(jdn) {
  const T = (jdn - 2451545.5 - TZ / 24) / 36525, T2 = T * T, dr = Math.PI / 180;
  const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M) + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr; L -= Math.PI * 2 * Math.floor(L / (Math.PI * 2));
  return Math.floor((L / Math.PI) * 6);
}
function lunarMonth11(yy) {
  const off = jdFromDate(31, 12, yy) - 2415021, k = Math.floor(off / 29.530588853);
  let nm = newMoonDay(k); if (sunLongitude(nm) >= 9) nm = newMoonDay(k - 1); return nm;
}
function leapOffset(a11) {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let i = 1, arc = sunLongitude(newMoonDay(k + i)), last;
  do { last = arc; i++; arc = sunLongitude(newMoonDay(k + i)); } while (arc !== last && i < 14);
  return i - 1;
}
export function solarToLunar(dd, mm, yy) {
  const day = jdFromDate(dd, mm, yy), k = Math.floor((day - 2415021.076998695) / 29.530588853);
  let ms = newMoonDay(k + 1); if (ms > day) ms = newMoonDay(k);
  let a11 = lunarMonth11(yy), b11 = a11, ly;
  if (a11 >= ms) { ly = yy; a11 = lunarMonth11(yy - 1); } else { ly = yy + 1; b11 = lunarMonth11(yy + 1); }
  const ld = day - ms + 1, diff = Math.floor((ms - a11) / 29);
  let leap = 0, lm = diff + 11;
  if (b11 - a11 > 365) { const lo = leapOffset(a11); if (diff >= lo) { lm = diff + 10; if (diff === lo) leap = 1; } }
  if (lm > 12) lm -= 12;
  if (lm >= 11 && diff < 4) ly -= 1;
  return { day: ld, month: lm, year: ly, leap: !!leap };
}
const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
export const canChi = (y) => `${CAN[(y + 6) % 10]} ${CHI[(y + 8) % 12]}`;
export function lunarText(iso) {
  const [y, m, d] = iso.split('-').map(Number); const l = solarToLunar(d, m, y);
  return `${l.day}/${l.month}${l.leap ? ' (nhuận)' : ''} năm ${canChi(l.year)}`;
}

// ---- Đổi âm lịch → dương lịch (cùng thuật toán) ----
function jdToDate(jd) {
  let a, b, c;
  if (jd > 2299160) { a = jd + 32044; b = Math.floor((4 * a + 3) / 146097); c = a - Math.floor((b * 146097) / 4); } else { b = 0; c = jd + 32082; }
  const d = Math.floor((4 * c + 3) / 1461), e = c - Math.floor((1461 * d) / 4), m = Math.floor((5 * e + 2) / 153);
  return [e - Math.floor((153 * m + 2) / 5) + 1, m + 3 - 12 * Math.floor(m / 10), b * 100 + d - 4800 + Math.floor(m / 10)];
}
// trả về [ngày, tháng, năm] dương lịch, hoặc null nếu ngày âm không tồn tại
export function lunarToSolar(ld, lm, ly, leap = false) {
  let a11, b11;
  if (lm < 11) { a11 = lunarMonth11(ly - 1); b11 = lunarMonth11(ly); } else { a11 = lunarMonth11(ly); b11 = lunarMonth11(ly + 1); }
  const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lm - 11; if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const lo = leapOffset(a11); let leapMonth = lo - 2; if (leapMonth < 0) leapMonth += 12;
    if (leap && lm !== leapMonth) return null;
    if (leap || off >= lo) off += 1;
  } else if (leap) return null;
  const s = jdToDate(newMoonDay(k + off) + ld - 1);
  const back = solarToLunar(s[0], s[1], s[2]);
  if (back.day !== ld || back.month !== lm || back.leap !== !!leap) return null; // ngày âm không có thật (vd: 30 của tháng thiếu)
  return s;
}
