// Phân tích tiêu thụ điện/nước: so với tháng trước, trung bình năm, cảnh báo tăng > 20% (nghi rò rỉ); phòng Chủ Nhà = đồng hồ tổng − tổng các phòng.
import { addMonthsClamp, diffDays, periodStart, ymOf } from './dates.js';
import { nextPeriodToBill } from './billing.js';
export const LEAK_THRESHOLD = 0.20; // cảnh báo khi mức dùng mới nhất tăng quá 20% so với mức bình thường
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
// ---- Phòng Chủ Nhà (tính theo THÁNG) ----
// Nhà nước thu điện nước mỗi tháng một lần, nên mỗi tháng chỉ cần 1 số đồng hồ tổng MỚI (ghi ngày nào trong tháng cũng được).
// Điện/nước cả dãy + nhà tháng đó = số tổng mới − số tổng cũ. Trừ đi điện/nước các phòng đã ghi trong tháng đó = Chủ Nhà dùng.
// Tháng được CHỐT khi mọi phòng đang thuê đã ghi chỉ số trong tháng; ngày chốt = ngày của phòng ghi/thanh toán cuối cùng (hoặc ngày ghi số tổng nếu muộn hơn).
const sortedMaster = (db) => db.masterReadings.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt).localeCompare(String(b.createdAt)));
function roomsInMonth(db, ym) {
  let e = 0, w = 0; const dates = new Map(); // roomId -> ngày ghi gần nhất trong tháng
  for (const r of db.readings) {
    if (ymOf(r.date) !== ym) continue;
    const inv = db.invoices.find((i) => i.rentalId === r.rentalId && (r.final ? i.kind !== 'periodic' : i.kind === 'periodic' && i.periodIndex === r.periodIndex));
    if (!inv || !inv.elec || !inv.water) continue;
    e += inv.elec.usage; w += inv.water.usage; const cur = dates.get(r.roomId); if (!cur || r.date > cur) dates.set(r.roomId, r.date);
  }
  return { elec: e, water: w, dates };
}
// Phòng đang thuê (từ trước tháng đó) mà CHƯA ghi chỉ số trong tháng
function waitingRooms(db, ym, month) {
  const waiting = [];
  for (const rm of db.rooms.filter((r) => !r.kind)) {
    for (const rental of db.rentals.filter((x) => x.roomId === rm.id && x.status === 'active')) {
      if (!(rental.startDate < `${ym}-01`)) continue; // mới vào trong tháng: lần ghi đầu ở tháng sau
      if (month.dates.has(rm.id)) continue;
      let expected = null; try { expected = periodStart(rental.anchorDate, nextPeriodToBill(db, rental)); } catch { /* bỏ qua */ }
      waiting.push({ room: rm.name, expected });
    }
  }
  return waiting;
}
export function ownerSeries(db) {
  const ms = sortedMaster(db); if (ms.length < 2) return [];
  const groups = new Map(); for (const m of ms) { const k = ymOf(m.date); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); }
  const yms = [...groups.keys()].sort(); const out = []; let prevLast = null; const lastYm = yms[yms.length - 1];
  for (const ym of yms) {
    const g = groups.get(ym); const a = prevLast || (g.length > 1 ? g[0] : null); const b = g[g.length - 1]; prevLast = b; if (!a || a === b) continue;
    const total = { elec: b.elec - a.elec, water: b.water - a.water }; const mon = roomsInMonth(db, ym); const waiting = waitingRooms(db, ym, mon);
    const owner = { elec: total.elec - mon.elec, water: total.water - mon.water };
    const latest = ym === lastYm; const complete = latest ? waiting.length === 0 : true; // các tháng cũ coi như đã chốt (phòng thiếu số được liệt kê ở "missing")
    const last = [...mon.dates.values()].sort().pop(); const completedOn = complete ? (last && last > b.date ? last : b.date) : null;
    out.push({ id: b.id, from: a.date, to: b.date, ym, days: diffDays(a.date, b.date), readFrom: { elec: a.elec, water: a.water }, readTo: { elec: b.elec, water: b.water }, total, rooms: { elec: mon.elec, water: mon.water }, owner, estimated: false, complete, completedOn, waiting: latest ? waiting : [], missing: latest ? [] : waiting.map((x) => x.room) });
  }
  return out;
}
export function analyzeOwner(db, today) {
  const all = ownerSeries(db); const done = all.filter((x) => x.complete); const fmt = (x) => ({ ...x, total: { elec: r1(x.total.elec), water: r1(x.total.water) }, rooms: { elec: r1(x.rooms.elec), water: r1(x.rooms.water) }, owner: { elec: r1(x.owner.elec), water: r1(x.owner.water) } });
  const lastAll = all[all.length - 1]; const pending = lastAll && !lastAll.complete ? { from: lastAll.from, to: lastAll.to, ym: lastAll.ym, waiting: lastAll.waiting } : null;
  if (!done.length) return { series: all.map(fmt), summary: null, pending };
  const a = analyze(done.map((x) => ({ ym: x.ym, elec: x.owner.elec, water: x.owner.water })), today); const last = done[done.length - 1];
  return { series: all.map(fmt), summary: { ...a, from: last.from, to: last.to, days: last.days, estimated: false, completedOn: last.completedOn }, pending };
}
export function usageOverview(db, today) {
  const rooms = []; const alerts = [];
  for (const r of db.rooms.filter((x) => !x.kind)) { const a = analyze(roomSeries(db, r.id), today); if (!a) continue; rooms.push({ roomName: r.name, ...a }); for (const [k, nm] of [['elec', 'điện'], ['water', 'nước']]) if (a[k].alert) alerts.push({ roomName: r.name, kind: k, text: `${r.name}: ${nm} tăng ${Math.round(a[k].alertPct * 100)}% so với mức bình thường – cần kiểm tra có bị rò rỉ không`, pct: a[k].alertPct }); }
  const ow = analyzeOwner(db, today); const own = ow.summary;
  if (own) for (const [k, nm] of [['elec', 'điện'], ['water', 'nước']]) if (own[k].alert) alerts.push({ roomName: 'Chủ Nhà', kind: k, text: `Chủ Nhà: ${nm} tăng ${Math.round(own[k].alertPct * 100)}% so với mức bình thường (chốt ngày ${own.completedOn.split('-').reverse().join('/')}, khi phòng ghi chỉ số trễ nhất đã xong) – cần kiểm tra có bị rò rỉ không`, pct: own[k].alertPct, date: own.completedOn });
  return { threshold: Math.round(LEAK_THRESHOLD * 100), rooms, owner: own, ownerPending: ow.pending, alerts };
}
