// Phân tích tiêu thụ điện/nước: so với tháng trước, trung bình năm, cảnh báo tăng > 30% (nghi rò rỉ); phòng Chủ Nhà = đồng hồ tổng − tổng các phòng.
import { addMonthsClamp, diffDays, periodStart, ymOf } from './dates.js';
import { nextPeriodToBill } from './billing.js';
export const LEAK_THRESHOLD = 0.30;
const r1 = (n) => Math.round(n * 10) / 10;
const pctOf = (cur, base) => (base > 0 ? (cur - base) / base : null);

// Chuỗi tiêu thụ theo kỳ của 1 phòng, lấy từ các hóa đơn định kỳ có chỉ số điện nước. Nhãn tháng = tháng bắt đầu của kỳ đã tiêu thụ.
export function roomSeries(db, roomId) {
  const out = [];
  for (const i of db.invoices) {
    if (i.roomId !== roomId || i.kind !== 'periodic' || !i.elec || !i.water) continue;
    const from = addMonthsClamp(i.periodStart, -1);
    out.push({ ym: ymOf(from), from, to: i.periodStart, elec: i.elec.usage, water: i.water.usage, days: Math.max(1, diffDays(from, i.periodStart)) });
  }
  return out.sort((a, b) => a.to.localeCompare(b.to));
}
// Phân tích: mới nhất vs tháng trước vs trung bình các tháng trước trong năm hiện tại (nếu chưa có thì lấy tối đa 12 tháng gần nhất)
export function analyze(series, today, key = (x) => x) {
  if (!series.length) return null;
  const year = today.slice(0, 4); const last = series[series.length - 1]; const prev = series[series.length - 2] || null;
  let pool = series.slice(0, -1).filter((x) => x.ym.startsWith(year)); if (!pool.length) pool = series.slice(-13, -1);
  const res = { label: last.ym, prevLabel: prev?.ym || null, monthsInAvg: pool.length };
  for (const k of ['elec', 'water']) {
    const cur = key(last)[k], pv = prev ? key(prev)[k] : null;
    const av = pool.length ? pool.reduce((s, x) => s + key(x)[k], 0) / pool.length : null;
    const base = av != null && av > 0 ? av : pv; const pct = base > 0 ? (cur - base) / base : null;
    res[k] = { cur: r1(cur), prev: pv == null ? null : r1(pv), avg: av == null ? null : r1(av), pctPrev: pctOf(cur, pv), pctAvg: pctOf(cur, av), trend: pv == null ? null : cur > pv ? 'up' : cur < pv ? 'down' : 'same', alert: pct != null && pct > LEAK_THRESHOLD, alertPct: pct };
  }
  return res;
}
// ---- Phòng Chủ Nhà ----
function roomPoints(db, roomId) {
  const out = []; // mỗi lượt thuê: các điểm (ngày, chỉ số điện, chỉ số nước), đã sắp xếp
  for (const r of db.rentals.filter((x) => x.roomId === roomId).sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    const pts = [{ d: r.startDate, e: r.initElec, w: r.initWater }];
    for (const x of db.readings.filter((y) => y.rentalId === r.id).sort((a, b) => a.date.localeCompare(b.date) || a.periodIndex - b.periodIndex)) pts.push({ d: x.date, e: x.elecNew, w: x.waterNew });
    out.push({ pts, active: r.status === 'active', rental: r });
  }
  return out;
}
// Lượng điện/nước 1 phòng dùng trong [t1, t2], nội suy tuyến tính giữa các lần ghi chỉ số; phần sau lần ghi cuối của khách đang thuê được ước tính theo tốc độ kỳ gần nhất.
export function roomUsageBetween(db, roomId, t1, t2) {
  let e = 0, w = 0, estimated = false;
  const ov = (a, b) => Math.max(0, diffDays(a > t1 ? a : t1, b < t2 ? b : t2));
  for (const { pts, active } of roomPoints(db, roomId)) {
    let rate = null;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i]; const span = diffDays(a.d, b.d); if (span <= 0) continue;
      const o = ov(a.d, b.d); rate = { e: (b.e - a.e) / span, w: (b.w - a.w) / span };
      if (o > 0) { e += rate.e * o; w += rate.w * o; }
    }
    if (active && rate && pts.length > 1) { const last = pts[pts.length - 1]; if (t2 > last.d) { const o = ov(last.d, t2); if (o > 0) { e += rate.e * o; w += rate.w * o; estimated = true; } } }
  }
  return { elec: e, water: w, estimated };
}
// Kỳ [a,b] của đồng hồ tổng chỉ CHÍNH XÁC khi mọi phòng đang thuê đã ghi chỉ số tới ngày b trở đi.
// Ngày chốt = ngày của phòng tính tiền TRỄ NHẤT (ví dụ các phòng chốt ngày 1, 5, 10, 15, 20 thì chốt vào ngày 20).
function coverage(db, a, b) {
  let completedOn = b; const waiting = [];
  for (const rm of db.rooms.filter((r) => !r.kind)) {
    for (const { pts, rental } of roomPoints(db, rm.id)) {
      if (!(rental.startDate < b && (!rental.endDate || rental.endDate > a))) continue; // không thuê trong kỳ này
      const need = rental.endDate && rental.endDate < b ? rental.endDate : b; const hit = pts.find((p) => p.d >= need);
      if (!hit) { let expected = null; if (rental.status === 'active') { try { expected = periodStart(rental.anchorDate, nextPeriodToBill(db, rental)); } catch { /* bỏ qua */ } } waiting.push({ room: rm.name, expected }); }
      else if (hit.d > completedOn) completedOn = hit.d;
    }
  }
  return { complete: waiting.length === 0, completedOn: waiting.length ? null : completedOn, waiting };
}
export function ownerSeries(db) {
  const ms = db.masterReadings.slice().sort((a, b) => a.date.localeCompare(b.date)); const out = [];
  const rooms = db.rooms.filter((r) => !r.kind);
  for (let i = 1; i < ms.length; i++) {
    const a = ms[i - 1], b = ms[i]; const days = diffDays(a.date, b.date); if (days <= 0) continue;
    const total = { elec: b.elec - a.elec, water: b.water - a.water }; let re = 0, rw = 0, est = false;
    for (const rm of rooms) { const u = roomUsageBetween(db, rm.id, a.date, b.date); re += u.elec; rw += u.water; est = est || u.estimated; }
    const owner = { elec: total.elec - re, water: total.water - rw }; const cov = coverage(db, a.date, b.date);
    out.push({ id: b.id, from: a.date, to: b.date, ym: ymOf(a.date), days, readFrom: { elec: a.elec, water: a.water }, readTo: { elec: b.elec, water: b.water }, total, rooms: { elec: re, water: rw }, owner, estimated: est, complete: cov.complete, completedOn: cov.completedOn, waiting: cov.waiting, perDay: { elec: owner.elec / days, water: owner.water / days } });
  }
  return out;
}
export function analyzeOwner(db, today) {
  const all = ownerSeries(db); const done = all.filter((x) => x.complete); const fmt = (x) => ({ ...x, total: { elec: r1(x.total.elec), water: r1(x.total.water) }, rooms: { elec: r1(x.rooms.elec), water: r1(x.rooms.water) }, owner: { elec: r1(x.owner.elec), water: r1(x.owner.water) } });
  const lastAll = all[all.length - 1]; const pending = lastAll && !lastAll.complete ? { from: lastAll.from, to: lastAll.to, waiting: lastAll.waiting } : null;
  if (!done.length) return { series: all.map(fmt), summary: null, pending };
  const a = analyze(done.map((x) => ({ ym: x.ym, elec: x.perDay.elec, water: x.perDay.water })), today); const last = done[done.length - 1]; const prev = done[done.length - 2];
  const sc = (o) => o && { ...o, cur: r1(o.cur * last.days), prev: o.prev == null ? null : r1(o.prev * (prev?.days || last.days)), avg: o.avg == null ? null : r1(o.avg * last.days) };
  return { series: all.map(fmt), summary: { ...a, elec: sc(a.elec), water: sc(a.water), from: last.from, to: last.to, days: last.days, estimated: false, completedOn: last.completedOn }, pending };
}
export function usageOverview(db, today) {
  const rooms = []; const alerts = [];
  for (const r of db.rooms.filter((x) => !x.kind)) { const a = analyze(roomSeries(db, r.id), today); if (!a) continue; rooms.push({ roomName: r.name, ...a }); for (const [k, nm] of [['elec', 'điện'], ['water', 'nước']]) if (a[k].alert) alerts.push({ roomName: r.name, kind: k, text: `${r.name}: ${nm} tăng ${Math.round(a[k].alertPct * 100)}% so với mức bình thường – cần kiểm tra có bị rò rỉ không`, pct: a[k].alertPct }); }
  const ow = analyzeOwner(db, today); const own = ow.summary;
  if (own) for (const [k, nm] of [['elec', 'điện'], ['water', 'nước']]) if (own[k].alert) alerts.push({ roomName: 'Chủ Nhà', kind: k, text: `Chủ Nhà: ${nm} tăng ${Math.round(own[k].alertPct * 100)}% so với mức bình thường (chốt ngày ${own.completedOn.split('-').reverse().join('/')}, khi phòng ghi chỉ số trễ nhất đã xong) – cần kiểm tra có bị rò rỉ không`, pct: own[k].alertPct, date: own.completedOn });
  return { threshold: Math.round(LEAK_THRESHOLD * 100), rooms, owner: own, ownerPending: ow.pending, alerts };
}
