import { html, vnd, dmy, ROOM_STATUS, INV_STATUS, INV_COLOR } from '../util.js';
import { D, DV, S, today, activeRental, latestInvOf, tenant, invD } from '../api.js';
import { noticeCard } from './public.js';

export function roomMoney(roomId) {
  const r = activeRental(roomId); if (!r) return null;
  const inv = latestInvOf(r.chainId); if (!inv) return null;
  return { r, inv, d: invD(inv.id) };
}
export function dashboardView() {
  const rooms = D().rooms, rem = DV().reminders;
  const count = (s) => rooms.filter((x) => x.status === s).length;
  let need = 0, got = 0, debt = 0;
  for (const c of new Set(D().rentals.map((r) => r.chainId))) {
    const inv = latestInvOf(c); const d = invD(inv.id); const rent = D().rentals.filter((r) => r.chainId === c).slice(-1)[0];
    debt += d.remaining;
    if (rent.status === 'active') { need += Math.max(inv.total, 0); got += Math.min(d.paid, Math.max(inv.total, 0)); }
  }
  const stat = (n, l, cls = '') => html`<div class="stat ${cls}"><b>${n}</b><span>${l}</span></div>`;
  return html`
    <h2 class="sec" style="margin-top:4px">Thông báo cần xử lý (${rem.length})</h2>
    <div class="notices" style="margin-top:0">${rem.length ? rem.map((i) => noticeCard({ ...i, period: i.periodLabel }, { link: true, tenantName: i.tenantId ? tenant(i.tenantId)?.fullName : '' })) : html`<div class="empty-state ok"><b>Không có việc cần xử lý.</b></div>`}</div>
    <h2 class="sec">Tổng quan</h2>
    <div class="cards7">${stat(rooms.length, 'Tổng số phòng')}${stat(count('occupied'), 'Phòng đang thuê')}${stat(count('empty'), 'Phòng trống')}${stat(count('repair'), `Phòng sửa chữa${count('notready') ? ` (+${count('notready')} chưa sẵn sàng)` : ''}`)}
      ${stat(vnd(need), 'Tổng tiền cần thu (kỳ hiện hành)')}${stat(vnd(got), 'Tổng tiền đã thu (kỳ hiện hành)')}${stat(vnd(debt), 'Tổng công nợ', debt ? 'red' : '')}</div>
    <h2 class="sec">Các phòng</h2>
    <div class="grid">${rooms.map((r) => roomCard(r))}</div>
    <div class="row" style="margin-top:14px"><button class="btn" data-act="add-room">+ Thêm phòng</button></div>`;
}
function roomCard(r) {
  const m = roomMoney(r.id); const color = { occupied: 'blue', empty: 'green', repair: 'orange', notready: 'gray' }[r.status];
  const t = m ? tenant(m.r.tenantId) : null;
  return html`<article class="card click room-card" data-act="open-room" data-id="${r.id}">
    <h3>${r.name}<span class="badge ${color}">${ROOM_STATUS[r.status]}</span></h3>
    ${m ? html`<dl class="kv"><dt>Khách thuê</dt><dd class="big">${t?.fullName}</dd><dt>Bắt đầu thuê</dt><dd>${dmy(m.r.startDate)}</dd>
      <dt>Giá thuê</dt><dd>${vnd(DV().rentals[m.r.id]?.price.rent)}</dd>
      <dt>Tiền điện</dt><dd>${m.inv.elec ? vnd(m.inv.elec.amount) : '—'}</dd><dt>Tiền nước</dt><dd>${m.inv.water ? vnd(m.inv.water.amount) : '—'}</dd>
      <dt>Tổng cần thu</dt><dd class="big">${vnd(m.inv.total)}</dd><dt>Đã thanh toán</dt><dd>${vnd(m.d.paid)}</dd>
      <dt>Còn nợ</dt><dd class="${m.d.remaining ? 'owe' : 'okc'}">${vnd(m.d.remaining)}</dd></dl>`
      : html`<p class="muted" style="margin:10px 0 0">${r.status === 'empty' ? 'Phòng đang trống.' : r.note || ROOM_STATUS[r.status]}</p>`}
  </article>`;
}
