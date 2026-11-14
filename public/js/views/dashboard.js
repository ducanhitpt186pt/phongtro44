import { html, raw, vnd, dmy, ROOM_STATUS } from '../util.js';
import { D, DV, S, today, activeRental, latestInvOf, tenant, invD } from '../api.js';
import { noticeCard, readingsBanner } from './public.js';
import { debtNotices, openDebtItems } from './debts.js';
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
  let debt = 0, toCollect = 0;
  for (const c of new Set(D().rentals.map((r) => r.chainId))) {
    const inv = latestInvOf(c); const d = invD(inv.id); const rent = D().rentals.filter((r) => r.chainId === c).slice(-1)[0]; debt += d.remaining;
    const counted = rent.status !== 'active' || !!inv.elec; // chỉ tính khi kỳ đã nhập điện nước
    if (!counted) { debt -= d.remaining; continue; }
    if (d.remaining > 0) toCollect++;
  }
  const stat = (n, l, cls = '') => html`<div class="stat ${cls}"><b>${n}</b><span>${l}</span></div>`;
  return html`
    <h2 class="sec sumrow" style="margin-top:4px"><span>Thông báo cần xử lý (${rem.length})</span>${rem.length ? '' : html`<span class="okpill">${icon('check', '1.1em')} Không có việc cần xử lý</span>`}</h2>
    ${rem.length ? html`<div class="notices" style="margin-top:0">${rem.map((i) => noticeCard({ ...i, period: i.periodLabel }, { link: true, actions: true, tenantName: i.tenantId ? tenant(i.tenantId)?.fullName : '' }))}</div>` : ''}
    ${debtNotices(openDebtItems(today()), { actions: true })}
    ${eventsAheadList(S.snap.db.events, today())}
    <h2 class="sec">Tổng quan</h2>
    <div class="cards7"><div class="stat roomstat"><b>${rooms.length}</b><span>Tổng số phòng</span><span class="sub blk">Phòng đang khóa: <b class="inl">${rooms.filter((r) => r.status === 'notready').length}</b></span></div>${stat(toCollect, 'Phòng cần thu tiền', 'redtxt')}${stat(vnd(debt), 'Tổng công nợ', 'debt')}</div>
    ${readingsBanner(DV().readings)}
    <div class="section-head"><h2 class="sec">Các phòng</h2><span class="sp"></span><button class="btn primary sm" data-act="add-room">${icon('plus', '1.1em')} Thêm phòng</button></div>
    <div class="grid">${rooms.map((r) => roomCard(r))}${ownerRoom ? ownerCard(ownerRoom) : ''}</div>
    <div class="dash-cal">${calendarPanel({ editable: true })}</div>
    ${usagePanel(DV().usage)}`;
}
function roomCard(r) {
  const m = roomMoney(r.id); const tone = ROOM_TONE[r.status];
  const t = m ? tenant(m.r.tenantId) : null; const people = m ? 1 + D().occupants.filter((o) => o.tenantId === m.r.tenantId).length : 0;
  const counted = !!m && !!m.inv.elec; const months = counted ? (DV().months[m.r.chainId] || []).filter((x) => x.outstanding > 0) : [];
  return html`<article class="card click room-card st-${tone}" data-act="open-room" data-id="${r.id}">${r.status === 'notready' ? html`<span class="lockmark">${icon('lock', '100%')}</span>` : ''}
    <div class="rhead"><span class="rbadge ${tone}">${icon(ROOM_ICON[r.status], '1.6em')}</span><div class="sp"><h3>${r.name}</h3><span class="stx ${tone}">${ROOM_STATUS[r.status]}${m ? html` <span class="room-sub">· Vào ${dmy(m.r.startDate)}</span>` : ''}</span></div>${m ? html`<button class="btn red sm rbtn" data-act="readings" data-id="${m.r.id}">${icon('bolt', '1.1em')} Tính tiền</button>` : ''}</div>
    ${m ? html`<dl class="kv"><dt>Khách thuê</dt><dd class="big">${t?.fullName}</dd><dt>Số người</dt><dd>${people}</dd>
      ${counted ? html`${m.d.remaining > 0 ? html`<dt>Tổng cần thu</dt><dd class="big money">${vnd(m.inv.total)}</dd><dt>Đã thanh toán</dt><dd>${vnd(m.d.paid)}</dd>` : ''}<dt>Còn nợ</dt><dd class="${m.d.remaining ? 'owe' : 'okc'}">${vnd(m.d.remaining)}</dd>`
        : m.d.remaining > 0 ? html`<dt>Tiền phòng đầu kỳ chưa nhận</dt><dd class="big money">${vnd(m.d.remaining)}</dd>` : html`<dt>Tiền phòng đầu kỳ đã nhận</dt><dd class="big money okc">${vnd(m.d.paid)}</dd>`}</dl>
      ${months.length ? html`<div class="mchips">${months.map((x) => html`<span class="mchip ${x.status}">Chưa thanh toán T${Number(x.ym.slice(5))}/${x.ym.slice(0, 4)}</span>`)}</div>` : ''}`
      : (r.note ? html`<div class="rnote ${tone}">${r.note}</div>` : '')}
  </article>`;
}
function ownerCard(r) {
  const o = DV().usage.owner;
  return html`<article class="card click room-card st-orange owner-card" data-act="open-room" data-id="${r.id}"><div class="rhead"><span class="rbadge orange">${icon('home', '1.6em')}</span><div class="sp"><h3>${r.name}</h3><span class="stx orange">Đồng hồ tổng</span></div><button class="btn primary sm ownbtn" data-act="master-add">${icon('bolt', '1.1em')} Ghi đồng hồ tổng</button></div>
    ${o ? html`<dl class="kv"><dt>Điện Chủ Nhà dùng</dt><dd class="big ${o.elec.alert ? 'owe' : ''}">${o.elec.cur} số</dd><dt>Nước Chủ Nhà dùng</dt><dd class="big ${o.water.alert ? 'owe' : ''}">${o.water.cur} khối</dd></dl>` : ''}</article>`;
}
