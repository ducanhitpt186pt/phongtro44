// Cảnh báo số điện thoại "lạ" (6 chữ số giống nhau liên tiếp) + danh sách Tiền Nợ Cũ của khách đang thuê.
import { html, vnd, dmy, todayLocal, field, toInt, openModal, closeModal } from '../util.js';
import { D, save } from '../api.js';
import { acts, forms, rerender } from '../ui.js';
import { icon } from '../icons.js';

export const suspiciousPhone = (ph) => /(\d)\1{5}/.test(String(ph || ''));
const roomName = (id) => D().rooms.find((r) => r.id === id)?.name || '';
// Người đang ở (khách chính + người ở cùng của các phòng đang thuê) có số điện thoại lạ và chưa bấm "Số đúng"
export function phoneIssues() {
  const out = [];
  for (const r of D().rentals.filter((x) => x.status === 'active')) {
    const t = D().tenants.find((x) => x.id === r.tenantId); if (!t) continue;
    if (suspiciousPhone(t.phone) && t.phoneOk !== t.phone) out.push({ kind: 'tenant', id: t.id, name: t.fullName, phone: t.phone, room: roomName(r.roomId), roomId: r.roomId, main: true });
    for (const o of D().occupants.filter((x) => x.tenantId === t.id)) if (suspiciousPhone(o.phone) && o.phoneOk !== o.phone) out.push({ kind: 'occupant', id: o.id, name: o.fullName, phone: o.phone, room: roomName(r.roomId), roomId: r.roomId });
  }
  return out;
}
// Khách đang thuê có Tiền Nợ Cũ > 0
export function oldDebtItems() {
  return D().rentals.filter((x) => x.status === 'active').map((r) => ({ r, t: D().tenants.find((x) => x.id === r.tenantId) })).filter(({ t }) => t?.oldDebt?.amount > 0)
    .map(({ r, t }) => ({ tenantId: t.id, name: t.fullName, room: roomName(r.roomId), roomId: r.roomId, ...t.oldDebt }));
}
export const extraCount = () => phoneIssues().length + oldDebtItems().length;

export function phoneNotices(list = phoneIssues()) {
  if (!list.length) return '';
  return html`<h2 class="sec sumrow"><span>${icon('phone', '1.1em')} Cần cập nhật số điện thoại (${list.length})</span></h2>
    <div class="notices">${list.map((p) => html`<article class="note orange"><h3>${p.room} · ${p.name}</h3><dl><dt>Số đang lưu</dt><dd class="owe">${p.phone}</dd><dt>Lý do</dt><dd>Có 6 số giống nhau liên tiếp – có thể là số nhập tạm</dd></dl>
      <div class="row" style="margin-top:8px"><button class="btn sm primary" data-act="${p.main ? 'edit-tenant' : 'edit-occupant'}" data-id="${p.id}">${icon('edit', '1em')} Cập nhật số</button><button class="btn sm green" data-act="phone-ok" data-kind="${p.kind}" data-id="${p.id}" data-name="${p.name}" data-phone="${p.phone}">${icon('check', '1em')} Số đúng</button></div></article>`)}</div>`;
}
acts['phone-ok'] = async (el) => {
  if (!confirm(`Xác nhận số ${el.dataset.phone} của ${el.dataset.name} là SỐ ĐÚNG?\nSau khi xác nhận sẽ không báo nữa (nếu sau này đổi sang số khác cũng có 6 số giống nhau thì sẽ báo lại).`)) return;
  await save('POST', 'phone-ok', { kind: el.dataset.kind, id: el.dataset.id }, 'Đã xác nhận số điện thoại đúng – không báo nữa'); rerender();
};

export function oldDebtNotices(list = oldDebtItems()) {
  if (!list.length) return '';
  return html`<h2 class="sec sumrow"><span>${icon('money', '1.1em')} Tiền nợ cũ của khách (${list.length})</span><span class="sumtotal">Tổng: <b class="owe">${vnd(list.reduce((s, x) => s + x.amount, 0))}</b></span></h2>
    <div class="notices">${list.map((d) => html`<article class="note red link" data-act="open-room" data-id="${d.roomId}"><h3>${d.room} · ${d.name}</h3><dl><dt>Tiền nợ cũ</dt><dd class="owe">${vnd(d.amount)}</dd><dt>Ngày nợ</dt><dd>${dmy(d.date)}</dd>${d.reason ? html`<dt>Lý do</dt><dd class="pre">${d.reason}</dd>` : ''}</dl>
      <div class="row" style="margin-top:8px"><button class="btn sm" data-act="old-debt-edit" data-id="${d.tenantId}">${icon('edit', '1em')} Sửa / đã thu</button></div></article>`)}</div>`;
}
// Ô nhập "Tiền Nợ Cũ" dùng chung cho Thêm khách và Sửa khách
export const oldDebtFields = (d = {}) => html`<fieldset><legend>Tiền Nợ Cũ</legend><p class="muted small" style="margin:0 0 8px">Khoản khách còn nợ từ trước (ghi riêng, không tự cộng vào hóa đơn). Không nợ thì để 0. Thu xong thì sửa về 0.</p>
  <div class="two">${field('Số tiền nợ cũ (đ)', html`<input name="od_amount" inputmode="numeric" value="${d.amount || 0}">`)}${field('Ngày nợ', html`<input type="date" name="od_date" max="${todayLocal()}" value="${d.date || todayLocal()}">`, 'Mặc định là ngày nhập, có thể đổi.')}</div>
  ${field('Lý do nợ', html`<textarea name="od_reason" maxlength="300" placeholder="Ví dụ: còn thiếu tiền điện tháng trước…">${d.reason || ''}</textarea>`)}</fieldset>`;
export const collectOldDebt = (fd) => ({ amount: toInt(fd.get('od_amount')) || 0, date: fd.get('od_date') || todayLocal(), reason: fd.get('od_reason') || '' });
export const oldDebtLine = (t) => (t?.oldDebt?.amount > 0 ? html`<dt>Tiền nợ cũ</dt><dd class="owe">${vnd(t.oldDebt.amount)} <span class="muted small">(${dmy(t.oldDebt.date)}${t.oldDebt.reason ? ` · ${t.oldDebt.reason}` : ''})</span></dd>` : '');
acts['old-debt-edit'] = (el) => {
  const t = D().tenants.find((x) => x.id === el.dataset.id);
  openModal(`Tiền nợ cũ – ${t.fullName}`, html`<form data-form="old-debt" data-id="${t.id}">${oldDebtFields(t.oldDebt)}<div class="err-inline"></div><div class="row"><button class="btn primary sp" type="submit">LƯU</button>${t.oldDebt?.amount > 0 ? html`<button class="btn green" type="button" data-act="old-debt-clear" data-id="${t.id}">${icon('check', '1em')} Đã thu hết (về 0)</button>` : ''}</div></form>`);
};
forms['old-debt'] = async (f, fd) => { await save('PUT', `tenants/${f.dataset.id}`, { oldDebt: collectOldDebt(fd) }, 'Đã lưu tiền nợ cũ'); closeModal(); rerender(); };
acts['old-debt-clear'] = async (el) => { const t = D().tenants.find((x) => x.id === el.dataset.id); if (!confirm(`Ghi nhận đã thu hết tiền nợ cũ ${vnd(t.oldDebt.amount)} của ${t.fullName}? (Số tiền về 0)`)) return; await save('PUT', `tenants/${t.id}`, { oldDebt: { amount: 0, date: t.oldDebt.date, reason: `${t.oldDebt.reason ? `${t.oldDebt.reason} – ` : ''}Đã thu ${vnd(t.oldDebt.amount)} ngày ${dmy(todayLocal())}` } }, 'Đã ghi nhận thu hết nợ cũ'); closeModal(); rerender(); };
