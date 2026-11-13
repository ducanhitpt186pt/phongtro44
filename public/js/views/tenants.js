import { html, raw, vnd, dmy, field, openModal, closeModal, toast, $, GENDER, INV_STATUS, INV_COLOR } from '../util.js';
import { D, DV, save, api, apiUrl, room, tenant, invD, latestInvOf } from '../api.js';
import { acts, forms, live, rerender, go } from '../ui.js';
import { idBox, resetImages, getBlob, uploadImage } from '../images.js';
import { personFields, collectPerson, occFields, collectOccupant, contactRow } from './room.js';
import { icon } from '../icons.js';

function statusOf(t) {
  const rs = D().rentals.filter((r) => r.tenantId === t.id); const act = rs.find((r) => r.status === 'active');
  const last = rs[rs.length - 1]; const inv = last && latestInvOf(last.chainId);
  return { act, last, debt: inv ? invD(inv.id).remaining : 0 };
}
forms.noop = () => {};
export function tenantsView() {
  const list = D().tenants.filter((t) => !t.purgedAt).sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
  const v = html`<div class="page-head"><h2>Khách thuê</h2></div>
    <form data-form="noop" data-live="tsearch"><input name="q" type="search" placeholder="Tìm theo tên, số điện thoại, CCCD…" aria-label="Tìm khách" autocomplete="off"></form>
    <div class="list" id="tlist" style="margin-top:12px">${list.map(tenantRow)}${list.length ? '' : html`<div class="empty-state">Chưa có khách. Vào một phòng trống để thêm khách thuê.</div>`}</div>`;
  return v;
}
const tenantRow = (t) => { const s = statusOf(t); return html`<div class="li" data-search="${(t.fullName + ' ' + t.phone + ' ' + t.cccd).toLowerCase()}"><a href="#/tenant/${t.id}"><b>${t.fullName}</b></a><span class="muted small">${t.phone}</span>
  <span>${s.act ? html`<span class="badge blue">${room(s.act.roomId).name}</span>` : html`<span class="badge">Đã trả phòng</span>`} ${s.debt ? html`<span class="badge red">Nợ ${vnd(s.debt)}</span>` : ''} ${!s.act ? html`<button class="btn sm danger" data-act="del-tenant" data-id="${t.id}">${icon('trash', '1em')} Xóa</button>` : ''}</span></div>`; };
live.tsearch = (f) => { const q = f.q.value.trim().toLowerCase(); document.querySelectorAll('#tlist [data-search]').forEach((el) => (el.hidden = q && !el.dataset.search.includes(q))); };

export function tenantView(id) {
  const t = tenant(id); if (!t) return html`<p>Không tìm thấy khách. <a href="#/tenants">Quay lại</a></p>`;
  const s = statusOf(t); const occ = D().occupants.filter((o) => o.tenantId === id);
  const rentals = D().rentals.filter((r) => r.tenantId === id).slice().reverse();
  const chainIds = new Set(rentals.map((r) => r.chainId));
  const pays = D().payments.filter((p) => chainIds.has(p.chainId)).slice().reverse();
  const img = (side, label) => idCard(t, 'tenant', side, label);
  return html`<a class="back" href="#/tenants">← Khách thuê</a>
    <div class="page-head"><h2>${t.fullName}</h2>${s.act ? html`<span class="badge blue">${room(s.act.roomId).name}</span>` : html`<span class="badge">Đã trả phòng</span>`}${t.purgedAt ? html`<span class="badge">Hồ sơ đã xóa ${dmy(t.purgedAt)}</span>` : html`<button class="btn sm" data-act="edit-tenant" data-id="${id}">Sửa thông tin</button>${!s.act ? html`<button class="btn sm danger" data-act="del-tenant" data-id="${id}">${icon('trash', '1em')} Xóa hồ sơ</button>` : ''}`}</div>
    <section class="card">${contactRow(t, occ)}<dl class="kv"><dt>Ngày sinh</dt><dd>${dmy(t.dob)}</dd><dt>Giới tính</dt><dd>${GENDER[t.gender]}</dd><dt>Điện thoại</dt><dd>${t.phone}</dd><dt>Số CCCD</dt><dd>${t.cccd}</dd><dt>Ngày cấp / Nơi cấp</dt><dd>${dmy(t.cccdIssueDate)} · ${t.cccdIssuePlace}</dd><dt>Địa chỉ thường trú</dt><dd>${t.address}</dd><dt>Công nợ hiện tại</dt><dd class="${s.debt ? 'owe' : 'okc'}">${vnd(s.debt)}</dd></dl></section>
    <h2 class="sec">Ảnh CCCD</h2><div class="idgrid">${img('front', 'mặt trước')}${img('back', 'mặt sau')}</div>
    <div class="row" style="margin:22px 0 10px"><h2 class="sec" style="margin:0" >Người ở cùng (${occ.length})</h2><span class="sp"></span>${s.act && !t.purgedAt ? html`<button class="btn red sm" data-act="add-occupant" data-tid="${id}">${raw(icon('plus', '1.1em'))} Thêm người ở cùng</button>` : ''}</div>
    <div class="list">${occ.length ? occ.map((o) => html`<section class="card"><div class="row"><div class="sp"><b>${o.fullName}</b> · ${dmy(o.dob)} · ${GENDER[o.gender] || ''}<br><span class="muted small">${[o.phone, o.noId ? 'Chưa có CCCD (trẻ em)' : `CCCD ${o.cccd}`, o.address, o.note].filter(Boolean).join(' · ')}</span></div>
      <button class="btn sm" data-act="edit-occupant" data-id="${o.id}">Sửa</button><button class="btn danger sm" data-act="del-occupant" data-id="${o.id}">Xóa</button></div>
      ${o.noId ? '' : html`<div class="idgrid" style="margin-top:10px">${idCard(o, 'occ', 'front', 'mặt trước')}${idCard(o, 'occ', 'back', 'mặt sau')}</div>`}</section>`) : html`<div class="empty-state">Không có.</div>`}</div>
    <h2 class="sec">Lịch sử thuê</h2><div class="list">${rentals.map((r) => html`<div class="li"><span><a href="#/room/${r.roomId}">${room(r.roomId).name}</a> · ${dmy(r.startDate)} → ${r.endDate ? dmy(r.endDate) : 'nay'}</span><span class="badge ${r.status === 'active' ? 'blue' : ''}">${{ active: 'Đang thuê', ended: 'Đã trả phòng', transferred: 'Đã chuyển phòng' }[r.status]}</span></div>`)}</div>
    <h2 class="sec">Hóa đơn</h2><div class="list">${D().invoices.filter((i) => chainIds.has(i.chainId)).slice().reverse().map((i) => { const x = invD(i.id); return html`<div class="li click" data-act="open-invoice" data-id="${i.id}" style="cursor:pointer"><span><b>${i.code}</b> · ${i.roomName} · ${dmy(i.dueDate)}</span><span>${vnd(i.total)} <span class="badge ${INV_COLOR[x.status]}">${INV_STATUS[x.status]}</span></span></div>`; })}</div>
    <h2 class="sec">Lịch sử thanh toán</h2><div class="list">${pays.length ? pays.map((p) => html`<div class="li"><span>${dmy(p.date)} · <b>${vnd(p.amount)}</b> ${p.voided ? html`<span class="badge red">Đã hủy: ${p.voidReason}</span>` : ''}</span><span class="muted small">${p.note}</span></div>`) : html`<div class="empty-state">Chưa có giao dịch.</div>`}</div>`;
}
function idCard(owner, kind, side, label) {
  const m = owner.idImages?.[side];
  return html`<div class="card"><b>CCCD ${label}</b>
    <div class="idprev" id="show-${owner.id}-${side}" style="margin:8px 0">${m ? html`<img class="idimg" alt="Ảnh CCCD ${label}" loading="lazy" data-act="zoom-id" data-id="${m.id}" src="${apiUrl(`storage/${m.id}`)}"><div class="idfail small" hidden>Không tải được ảnh. Kiểm tra kết nối kho ảnh (BLOB_READ_WRITE_TOKEN), hoặc bấm "Tải về".</div>` : html`<span class="muted">Chưa có ảnh</span>`}</div>
    <div class="row">${m ? html`<a class="btn sm" href="${apiUrl(`storage/${m.id}?download=1`)}" download>Tải về</a>` : ''}<button class="btn sm" data-act="id-replace" data-owner="${owner.id}" data-side="${side}">${m ? 'Thay ảnh' : 'Thêm ảnh'}</button>${m ? html`<button class="btn sm danger" data-act="id-delete" data-id="${m.id}">Xóa ảnh</button>` : ''}</div>${m ? html`<div class="muted small" style="margin-top:6px">Tải lên ${dmy(m.uploadedAt.slice(0, 10))}</div>` : ''}</div>`;
}
acts['zoom-id'] = (el) => openModal('Ảnh CCCD', html`<img alt="CCCD" class="idzoom" src="${apiUrl(`storage/${el.dataset.id}`)}">`);
acts['id-replace'] = (el) => { resetImages(); const side = el.dataset.side; openModal(`Ảnh CCCD ${side === 'front' ? 'mặt trước' : 'mặt sau'}`, html`<form data-form="id-upload" data-owner="${el.dataset.owner}" data-side="${side}">${idBox(`rep-${side}`)}<div class="err-inline"></div><button class="btn primary block" type="submit">LƯU ẢNH</button></form>`); };
forms['id-upload'] = async (f) => { const side = f.dataset.side; if (!getBlob(`rep-${side}`)) throw new Error('Chưa có ảnh. Hãy chụp hoặc chọn ảnh.'); try { await uploadImage(f.dataset.owner, `rep-${side}`, side); } catch (e) { toast(e.message, 'err'); throw e; } resetImages(); closeModal(); toast('Đã lưu ảnh (ảnh cũ đã được xóa khỏi kho)'); rerender(); };
acts['id-delete'] = async (el) => { if (!confirm('Xóa ảnh CCCD này khỏi kho lưu trữ? Không thể hoàn tác.')) return; await save('DELETE', `storage/${el.dataset.id}`, undefined, 'Đã xóa ảnh'); rerender(); };

acts['edit-tenant'] = (el) => {
  const t = tenant(el.dataset.id); const r = D().rentals.filter((x) => x.tenantId === t.id).slice(-1)[0];
  openModal('Sửa thông tin khách', html`<form data-form="tenant-edit" data-id="${t.id}" data-rental="${r?.id || ''}"><fieldset><legend>Khách thuê</legend>${personFields(t)}</fieldset><div class="err-inline"></div><button class="btn primary block" type="submit">LƯU</button></form>`, { wide: true });
};
forms['tenant-edit'] = async (f, fd) => { await save('PUT', `tenants/${f.dataset.id}`, { tenant: collectPerson(fd) }, 'Đã lưu'); closeModal(); rerender(); };
acts['edit-occupant'] = (el) => {
  const o = D().occupants.find((x) => x.id === el.dataset.id);
  openModal('Sửa người ở cùng', html`<form data-form="occupant-edit" data-id="${o.id}">${occFields(o, '')}<div class="err-inline"></div><button class="btn primary block" type="submit">LƯU</button></form>`);
};
forms['occupant-edit'] = async (f) => { await save('PUT', `occupants/${f.dataset.id}`, { occupant: collectOccupant(f) }, 'Đã lưu'); closeModal(); rerender(); };
acts['del-occupant'] = async (el) => { if (!confirm('Xóa người ở cùng này (khi họ đã dọn đi)? Ảnh CCCD của họ cũng bị xóa khỏi kho. Không thể hoàn tác.')) return; await save('DELETE', `occupants/${el.dataset.id}`, undefined, 'Đã xóa người ở cùng'); rerender(); };

acts['del-tenant'] = async (el) => {
  const t = tenant(el.dataset.id); if (!confirm(`Xóa hồ sơ khách "${t.fullName}"?\n\nSẽ xóa họ tên, số điện thoại, CCCD, địa chỉ và ảnh. Số tiền trên các hóa đơn cũ vẫn được giữ để báo cáo không bị sai. Không hoàn tác được.`)) return;
  const j = await save('DELETE', `tenants/${el.dataset.id}`, undefined, 'Đã xóa hồ sơ khách'); go('#/tenants'); rerender();
};
