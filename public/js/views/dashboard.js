import { html, raw, vnd, dmy, ROOM_STATUS } from '../util.js';
import { D, DV, S, today, activeRental, latestInvOf, tenant, invD } from '../api.js';
import { noticeCard } from './public.js';
import { usagePanel } from './usage.js';
import { calendarPanel, eventsAheadList } from './calendar.js';
import { icon, ROOM_ICON, ROOM_TONE } from '../icons.js';

export function roomMoney(roomId) {
  const r = activeRental(roomId); if (!r) return null;
  const inv = latestInvOf(r.chainId); if (!inv) return null;
  return { r, inv, d: invD(inv.id) };
}
export function dashboardView() {
  const rooms = D().rooms.filter((r) => !r.kind), rem = DV().reminders; const ownerRoom = D().rooms.find((r) => r.kind === 'owner');
  let need = 0, debt = 0, toCollect = 0;
  for (const c of new Set(D().rentals.map((r) => r.chainId))) {
    const inv = latestInvOf(c); const d = invD(inv.id); const rent = D().rentals.filter((r) => r.chainId === c).slice(-1)[0]; debt += d.remaining;
    if (rent.status === 'active') { need += Math.max(inv.total, 0); }
    if (d.remaining > 0) toCollect++;
  }
  const stat = (n, l, cls = '') => html`<div class="stat ${cls}"><b>${n}</b><span>${l}</span></div>`;
  return html`
    <h2 class="sec" style="margin-top:4px">Thông báo cần xử lý (${rem.length})</h2>
    <div class="notices" style="margin-top:0">${rem.length ? rem.map((i) => noticeCard({ ...i, period: i.periodLabel }, { link: true, tenantName: i.tenantId ? tenant(i.tenantId)?.fullName : '' })) : html`<div class="empty-state ok"><b>Không có việc cần xử lý.</b></div>`}</div>
    ${eventsAheadList(S.snap.db.events, today())}
    <h2 class="sec">Tổng quan</h2>
    <div class="cards7">${stat(rooms.length, 'Tổng số phòng')}${stat(toCollect, 'Phòng cần thu tiền', toCollect ? 'orange' : '')}${stat(vnd(need), 'Tổng tiền cần thu (kỳ hiện hành)')}${stat(vnd(debt), 'Tổng công nợ', debt ? 'red' : '')}</div>
    ${usagePanel(DV().usage)}
    <div class="section-head"><h2 class="sec">Các phòng</h2><span class="sp"></span><button class="btn primary sm" data-act="add-room">${icon('plus', '1.1em')} Thêm phòng</button></div>
    <div class="grid">${rooms.map((r) => roomCard(r))}${ownerRoom ? ownerCard(ownerRoom) : ''}</div>
    <div class="dash-cal">${calendarPanel({ editable: true })}</div>`;
}
function roomCard(r) {
  const m = roomMoney(r.id); const tone = ROOM_TONE[r.status];
  const t = m ? tenant(m.r.tenantId) : null; const people = m ? 1 + D().occupants.filter((o) => o.tenantId === m.r.tenantId).length : 0;
  const months = m ? (DV().months[m.r.chainId] || []).filter((x) => x.outstanding > 0) : [];
  const lbl = { empty: ['Phòng trống', 'Sẵn sàng cho thuê'], repair: ['Đang sửa chữa', r.note || 'Tạm ngưng cho thuê'], notready: ['Đang sửa chữa hoặc đang sử dụng', r.note || ''] }[r.status];
  return html`<article class="card click room-card st-${tone}" data-act="open-room" data-id="${r.id}">
    <div class="rhead"><span class="rbadge ${tone}">${icon(ROOM_ICON[r.status], '1.6em')}</span><div class="sp"><h3>${r.name}</h3>${m ? html`<span class="room-sub">Vào ${dmy(m.r.startDate)}</span>` : html`<span class="badge ${tone}">${ROOM_STATUS[r.status]}</span>`}</div>${m ? html`<button class="btn red sm rbtn" data-act="readings" data-id="${m.r.id}">${icon('bolt', '1.1em')} Tính tiền</button>` : ''}</div>
    ${m ? html`<dl class="kv"><dt>Khách thuê</dt><dd class="big">${t?.fullName}</dd><dt>Số người</dt><dd>${people}</dd>
      <dt>Tổng cần thu</dt><dd class="big">${vnd(m.inv.total)}</dd><dt>Đã thanh toán</dt><dd>${vnd(m.d.paid)}</dd>
      <dt>Còn nợ</dt><dd class="${m.d.remaining ? 'owe' : 'okc'}">${vnd(m.d.remaining)}</dd></dl>
      ${months.length ? html`<div class="mchips">${months.map((x) => html`<span class="mchip ${x.status}">Chưa thanh toán T${Number(x.ym.slice(5))}/${x.ym.slice(0, 4)}</span>`)}</div>` : ''}`
      : html`<div class="rempty ${tone}"><b>${lbl[0]}</b>${lbl[1] ? html`<span>${lbl[1]}</span>` : ''}</div>`}
  </article>`;
}
function ownerCard(r) {
  const o = DV().usage.owner;
  return html`<article class="card click room-card st-orange owner-card" data-act="open-room" data-id="${r.id}"><div class="rhead"><span class="rbadge orange">${icon('home', '1.6em')}</span><div class="sp"><h3>${r.name}</h3><span class="badge orange">Đồng hồ tổng</span></div></div>
    ${o ? html`<dl class="kv"><dt>Điện Chủ Nhà dùng</dt><dd class="big ${o.elec.alert ? 'owe' : ''}">${o.elec.cur} số</dd><dt>Nước Chủ Nhà dùng</dt><dd class="big ${o.water.alert ? 'owe' : ''}">${o.water.cur} khối</dd></dl>` : html`<div class="rempty orange"><b>Nhập chỉ số đồng hồ tổng</b><span>Điện nước Chủ Nhà = tổng − các phòng</span></div>`}</article>`;
}
