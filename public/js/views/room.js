import { html, raw, vnd, num, dmy, monthLabel, todayLocal, issueField, ISSUE_PLACE, toInt, toDec, field, openModal, closeModal, toast, $, ROOM_STATUS, INV_STATUS, INV_COLOR, GENDER } from '../util.js';
import { S, D, DV, save, api, apiUrl, room, tenant, activeRental, latestInvOf, invD, today } from '../api.js';
import { acts, forms, live, changes, go, rerender } from '../ui.js';
import { idBox, resetImages, getBlob, uploadImage } from '../images.js';
import { icon, ROOM_ICON, ROOM_TONE } from '../icons.js';
import { ownerView } from './owner.js';
import { downloadCt01 } from '../ct01.js';
import { billArticle } from './bill.js';

let year = null;
// Chỉ xóa được hóa đơn MỚI NHẤT của khách đang thuê (không phải hóa đơn đầu tiên, không phải trả phòng/chuyển phòng)
const canDel = (i) => { const chain = D().invoices.filter((x) => x.chainId === i.chainId); const idx = chain.findIndex((x) => x.id === i.id); const active = D().rentals.some((r) => r.chainId === i.chainId && r.status === 'active'); return active ? chain.slice(idx).every((x) => x.kind === 'periodic') : true; }; // khách đang thuê: xóa từ tháng đó trở đi; khách đã trả phòng: xóa dòng bất kỳ
const zaloUrl = (n) => `https://zalo.me/${String(n || '').replace(/[^\d]/g, '').replace(/^0/, '0')}`;
export const zaloBtn = (name, num_, label = name) => (num_ ? html`<a class="zbtn" href="${zaloUrl(num_)}" target="_blank" rel="noopener" title="Mở Zalo của ${name}"><span class="zi" aria-hidden="true">Z</span><span>${label}</span></a>` : html`<span class="zbtn off" title="Chưa nhập số Zalo"><span class="zi" aria-hidden="true">Z</span><span>${label} (chưa có số)</span></span>`);
const telUrl = (n) => `tel:${String(n || '').replace(/[^\d+]/g, '')}`;
const phoneShow = (n) => String(n || '').replace(/^(\d{4})(\d{3})(\d{3,4})$/, '$1 $2 $3');
export const callBtn = (name, phone) => (phone ? html`<a class="cbtn" href="${telUrl(phone)}" title="Gọi điện cho ${name}"><span class="ci" aria-hidden="true">${icon('phone', '1.05em')}</span><span>Gọi ${phoneShow(phone)}</span></a>` : '');
// Mỗi người một hàng: tên + nút Zalo + nút Gọi (nếu không muốn nhắn Zalo)
export const contactRow = (t, occs = []) => html`<div class="zalo-row contacts">${[t, ...occs].map((p) => html`<div class="crow"><b class="cname">${p.fullName}</b>${zaloBtn(p.fullName, p.zalo || p.phone, 'Zalo')}${callBtn(p.fullName, p.phone)}</div>`)}</div>`;

// Phòng đang sửa chữa / chưa sẵn sàng: không mở được, báo lý do (ghi chú của phòng)
export function blockedDialog(rm) {
  openModal(rm.name, html`<p style="margin-top:0"><b>${rm.name}</b> đang sử dụng hoặc đang sửa chữa.</p>${rm.note ? html`<p>Ghi chú: <b>“${rm.note}”</b></p>` : ''}<p class="muted">Cần chuyển sang <b>Phòng trống</b> thì mới xem và thao tác được.</p><div class="row"><button class="btn primary sp" data-act="edit-room" data-id="${rm.id}">${icon('edit', '1.1em')} Sửa Tình Trạng Phòng</button><button class="btn" data-act="modal-close">Đóng</button></div>`);
}
export function roomView(id) {
  const rm = room(id); if (!rm) return html`<p>Không tìm thấy phòng. <a href="#/dashboard">Về tổng quan</a></p>`;
  if (rm.kind === 'owner') return ownerView();
  if (rm.status === 'repair' || rm.status === 'notready') { setTimeout(() => { go('#/dashboard'); setTimeout(() => blockedDialog(rm), 50); }, 0); return html`<p class="boot">Đang chuyển…</p>`; }
  year = year || Number(today().slice(0, 4));
  const r = activeRental(id); const t = r && tenant(r.tenantId); const rd = r && DV().rentals[r.id];
  const inv = r && latestInvOf(r.chainId); const d = inv && invD(inv.id);
  const occs = r ? D().occupants.filter((o) => o.tenantId === r.tenantId) : [];
  const tone = ROOM_TONE[rm.status]; const monthsAll = Object.values(DV().months).flat(); const byInv = new Map(monthsAll.map((x) => [x.invoiceId, x]));
  const counted = !!(inv && (inv.elec || (r && r.status !== 'active'))); const unpaid = r && counted ? (DV().months[r.chainId] || []).filter((x) => x.outstanding > 0) : [];
  const invs = D().invoices.filter((i) => i.roomId === id && i.dueDate.startsWith(String(year)));
  const rows = [];
  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${String(m).padStart(2, '0')}`; const list = invs.filter((i) => i.dueDate.slice(0, 7) === ym);
    const noteTxt = D().monthlyNotes.find((n) => n.roomId === id && n.ym === ym)?.text || '';
    const noteCell = html`<td data-l="Ghi chú" class="full"><input class="note-in" data-change="note" data-room="${id}" data-ym="${ym}" value="${noteTxt}" placeholder="Ghi chú…" aria-label="Ghi chú ${monthLabel(ym)}"></td>`;
    if (!list.length) rows.push(html`<tr class="empty"><td data-l="Tháng"><b>${m}</b></td><td data-l="Tiền phòng" class="r">—</td><td data-l="Tiền điện" class="r">—</td><td data-l="Tiền nước" class="r">—</td><td data-l="Nợ cũ" class="r">—</td><td data-l="Tổng tiền" class="r">—</td><td data-l="Đã thanh toán" class="r">—</td><td data-l="Còn nợ" class="r">—</td><td data-l="Trạng thái" class="muted">Chưa có hóa đơn</td>${noteCell}<td></td></tr>`);
    list.forEach((i, k) => {
      const ms = byInv.get(i.id); const x = invD(i.id); const own = i.total - i.oldDebt; const paid = ms ? ms.paid : x.paid; const left = ms ? ms.outstanding : x.remaining; const st = ms ? ms.status : x.status;
      rows.push(html`<tr class="click" data-act="open-invoice" data-id="${i.id}"><td data-l="Tháng"><b>${m}</b>${i.kind !== 'periodic' ? html` <span class="badge">${i.kind === 'checkout' ? 'Trả phòng' : 'Chuyển phòng'}</span>` : ''}</td>
      <td data-l="Tiền phòng" class="r">${vnd(i.rent)}</td><td data-l="Tiền điện" class="r">${i.elec ? vnd(i.elec.amount) : '—'}</td><td data-l="Tiền nước" class="r">${i.water ? vnd(i.water.amount) : '—'}</td>
      <td data-l="Nợ cũ" class="r">${vnd(i.oldDebt + (i.manualDebt || 0))}</td><td data-l="Tổng tiền" class="r"><b>${vnd(own)}</b></td><td data-l="Đã thanh toán" class="r">${vnd(paid)}</td><td data-l="Còn nợ" class="r ${left ? 'owe' : ''}">${vnd(left)}</td>
      <td data-l="Trạng thái"><span class="badge ${INV_COLOR[st] || ''}">${INV_STATUS[st] || st}</span></td>${k === 0 ? noteCell : html`<td></td>`}<td class="noprint">${canDel(i) ? html`<button class="btn sm danger" data-act="del-invoice" data-id="${i.id}" title="Xóa hóa đơn này (dữ liệu quan trọng)">${icon('trash', '1em')} Xóa</button>` : ''}</td></tr>`);
    });
  }
  const hist = D().rentals.filter((x) => x.roomId === id).slice().reverse();
  return html`<a class="back" href="#/dashboard">← Tổng quan</a>
    <div class="page-head"><span class="rbadge ${tone}">${icon(ROOM_ICON[rm.status], '1.5em')}</span><h2>${rm.name}${t ? ` – ${t.fullName}` : ''}</h2><span class="stx ${tone}">${ROOM_STATUS[rm.status]}</span><button class="btn sm" data-act="edit-room" data-id="${id}">${icon('edit', '1.1em')} Sửa Tình Trạng Phòng</button></div>
    ${r ? contactRow(t, occs) : ''}
    ${r ? html`<section class="card"><div class="row"><div class="sp"><b>${t.fullName}</b> · ${t.phone}<br><span class="muted small">Vào ở <b>${dmy(r.startDate)}</b> <button class="btn sm" data-act="edit-start" data-id="${r.id}" style="padding:2px 8px;min-height:28px">${icon('edit', '1em')} Sửa ngày</button> · <b>${1 + occs.length} người</b> · kỳ tiếp theo đến hạn ${dmy(rd.nextDue)}</span></div><a class="btn sm" href="#/tenant/${t.id}">${icon('card', '1.1em')} Hồ sơ khách</a><button class="btn sm primary" data-act="profile-img" data-room="${id}">${icon('photo', '1.1em')} Tải Ảnh Hồ Sơ Khách Theo Phòng</button><button class="btn sm primary" data-act="contract" data-id="${r.id}">${icon('sheet', '1.1em')} Xuất Hợp Đồng</button></div>
      <dl class="kv"><dt>Giá thuê / điện / nước</dt><dd>${vnd(rd.price.rent)} · ${num(rd.price.elecPrice)}đ/số · ${num(rd.price.waterPrice)}đ/khối</dd><dt>Tiền đặt cọc</dt><dd>${vnd(r.deposit || 0)}${r.deposit ? html` <span class="muted small">· hoàn lại khi trả phòng</span>` : ''}</dd><dt>Hình thức thanh toán</dt><dd>${{ month: 'Theo tháng', quarter: 'Theo quý', year: 'Theo năm' }[r.payCycle || 'month']}</dd><dt>Hóa đơn mới nhất</dt><dd>${inv.code} · ${vnd(inv.total)}</dd>${inv.elec || r.status !== 'active' ? html`<dt>Tổng còn nợ</dt><dd class="${d.remaining ? 'owe' : 'okc'}">${vnd(d.remaining)}</dd>` : d.remaining > 0 ? html`<dt>Tiền phòng đầu kỳ chưa nhận</dt><dd class="okc">${vnd(d.remaining)}</dd>` : html`<dt>Tiền phòng đầu kỳ đã nhận</dt><dd class="okc">${vnd(d.paid)}</dd>`}</dl>
      <div class="row" style="margin-top:12px"><button class="btn red" data-act="readings" data-id="${r.id}">${icon('bolt', '1.15em')} Tính tiền (ghi điện nước)</button>${d.remaining > 0 ? html`<button class="btn green" data-act="pay" data-id="${inv.id}">${icon('money', '1.15em')} Thanh toán</button>` : ''}<button class="btn" data-act="price" data-id="${r.id}">${icon('money', '1.1em')} Thay đổi giá phòng</button><button class="btn" data-act="transfer" data-id="${r.id}">${icon('swap', '1.1em')} Chuyển phòng</button><button class="btn danger" data-act="checkout" data-id="${r.id}">Trả phòng</button></div></section>
      ${!counted && d.remaining > 0 ? html`<section class="card" style="margin-top:12px"><h3>${icon('info', '1.2em')} Tiền phòng kỳ đầu chưa ghi nhận đã thu</h3><p class="muted" style="margin:6px 0 10px">Chưa tới kỳ ghi điện nước nên chưa tính là nợ. Nếu bạn đã nhận tiền phòng khi khách vào, hãy ghi nhận để hệ thống không tính là nợ cũ.</p><div class="row"><button class="btn" data-act="open-invoice" data-id="${inv.id}">Xem hóa đơn</button><button class="btn green" data-act="pay-month" data-id="${inv.id}">${icon('check', '1.1em')} Ghi nhận đã thu tiền phòng đầu kỳ (${vnd(d.remaining)})</button></div></section>` : html`<section class="card" style="margin-top:12px"><h3>${unpaid.length ? icon('alert', '1.2em') : icon('check', '1.2em')} ${unpaid.length ? 'Chưa thanh toán' : 'Đã thanh toán đủ các tháng'}</h3>
        ${unpaid.length ? html`<div class="month-pay">${unpaid.map((m) => html`<div class="mp"><b>${t.fullName} – Tháng ${Number(m.ym.slice(5))}/${m.ym.slice(0, 4)}</b><span class="sp muted">đến hạn ${dmy(m.dueDate)} · còn <b class="owe">${vnd(m.outstanding)}</b></span><button class="btn sm" data-act="open-invoice" data-id="${m.invoiceId}">Xem hóa đơn</button><button class="btn red sm" data-act="pay-month" data-id="${m.invoiceId}">Thanh toán tháng ${Number(m.ym.slice(5))}</button></div>`)}</div><p class="muted small" style="margin:8px 0 0">Bấm vào từng tháng để thu tiền đúng tháng đó. Sau khi bấm <b>ĐÃ NHẬN TIỀN</b>, thông báo của tháng đó sẽ ẩn.</p>` : ''}</section>`}`
    : html`<section class="card">${rm.status === 'empty' ? html`<p style="margin-top:0">Phòng đang trống.</p><button class="btn primary" data-act="movein" data-id="${id}">${icon('plus', '1.1em')} Thêm khách thuê</button>` : html`<p style="margin:0">${rm.note || ROOM_STATUS[rm.status]}</p>`}</section>`}
    ${r ? occupantsCard(t, occs, r.roomId) : ''}
    <div class="page-head" style="margin-top:22px"><h2 style="font-size:1.1rem">Hóa đơn theo tháng</h2><select data-change="year" style="width:auto;min-height:40px">${[...new Set([year, Number(today().slice(0, 4)), ...D().invoices.map((i) => Number(i.dueDate.slice(0, 4)))])].sort((a, b) => b - a).map((y) => html`<option ${y === year ? raw('selected') : ''}>${y}</option>`)}</select></div>
    <table class="tbl stack"><thead><tr><th>Tháng</th><th class="r">Tiền phòng</th><th class="r">Tiền điện</th><th class="r">Tiền nước</th><th class="r">Nợ cũ</th><th class="r">Tổng tiền tháng</th><th class="r">Đã thanh toán</th><th class="r">Còn nợ</th><th>Trạng thái</th><th>Ghi chú</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    <h2 class="sec">Lịch sử thuê của phòng</h2>
    <div class="list">${hist.length ? hist.map((x) => html`<div class="li"><span><b>${tenant(x.tenantId)?.fullName}</b> · ${dmy(x.startDate)} → ${x.endDate ? dmy(x.endDate) : 'nay'}</span><span class="badge ${x.status === 'active' ? 'blue' : ''}">${{ active: 'Đang thuê', ended: 'Đã trả phòng', transferred: 'Đã chuyển phòng' }[x.status]}</span></div>`) : html`<div class="empty-state">Chưa có lịch sử thuê.</div>`}</div>`;
}
function occupantsCard(t, occs, roomId) {
  return html`<section class="card" style="margin-top:12px"><div class="row"><h3 class="sp">${icon('users', '1.2em')} Người ở cùng (${occs.length})</h3><button class="btn red sm" data-act="add-occupant" data-tid="${t.id}">${icon('plus', '1.1em')} Thêm người ở cùng</button></div>
    <div class="row" style="margin-top:8px"><button class="btn sm" data-act="edit-tenant" data-id="${t.id}">${icon('edit', '1.1em')} Sửa thông tin người đăng ký</button><button class="btn amber sm" data-act="ct01" data-room="${roomId}">${icon('sheet', '1.1em')} Bản Khai CT01 - Lưu Trú</button></div>
    <p class="muted small" style="margin:6px 0 0">Thêm người ở cùng không tính thêm tiền. Số người trong phòng tự đếm = khách chính + người ở cùng.</p>
    <div class="list" style="margin-top:10px">${occs.length ? occs.map((o) => html`<div class="li"><span><b>${o.fullName}</b> · ${dmy(o.dob)} · ${GENDER[o.gender] || ''}<br><span class="muted small">${o.noId ? 'Chưa có CCCD (trẻ em)' : `CCCD ${o.cccd}`} · ${o.idImages?.front && o.idImages?.back ? 'đã có 2 mặt ảnh' : o.noId ? 'không cần ảnh' : 'chưa có ảnh CCCD (thêm sau được)'}</span></span><span class="row"><button class="btn sm" data-act="edit-occupant" data-id="${o.id}">${icon('edit', '1em')} Sửa</button><a class="btn sm" href="#/tenant/${t.id}">Hồ sơ & ảnh</a></span></div>`) : html`<div class="empty-state" style="padding:14px">Chưa có người ở cùng.</div>`}</div></section>`;
}
acts['open-invoice'] = (el) => go(`#/invoice/${el.dataset.id}`);
changes.year = (el) => { year = Number(el.value); rerender(); };
changes.note = async (el) => { await save('PUT', 'notes', { roomId: el.dataset.room, ym: el.dataset.ym, text: el.value }, 'Đã lưu ghi chú'); };

// ---- sửa tình trạng phòng / thêm phòng / xóa phòng ----
const roomForm = (r) => html`<form data-form="room" data-id="${r?.id || ''}">${field('Tên phòng', html`<input name="name" value="${r?.name || ''}" required maxlength="60">`)}
  ${r ? field('Tình trạng', html`<select name="status">${Object.entries(ROOM_STATUS).filter(([k]) => k !== 'occupied' || r.status === 'occupied').map(([k, v]) => html`<option value="${k}" ${k === r.status ? raw('selected') : ''}>${v}</option>`)}</select>`, 'Phòng đang có khách thì đổi bằng Trả phòng/Chuyển phòng.') : ''}
  ${field('Ghi chú (lý do sửa chữa / đang sử dụng…)', html`<textarea name="note" maxlength="300">${r?.note || ''}</textarea>`, 'Nội dung này hiện khi bấm vào phòng đang sửa chữa.')}<div class="err-inline"></div>
  <div class="row"><button class="btn primary sp" type="submit">LƯU</button>${r && !r.kind && r.status !== 'occupied' ? html`<button class="btn danger" type="button" data-act="del-room" data-id="${r.id}">${icon('trash', '1.1em')} Xóa phòng</button>` : ''}</div></form>`;
acts['add-room'] = () => openModal('Thêm phòng', roomForm(null));
acts['edit-room'] = (el) => openModal('Sửa Tình Trạng Phòng', roomForm(room(el.dataset.id)));
acts['del-room'] = async (el) => { const r = room(el.dataset.id); if (!confirm(`Xóa ${r.name}? Chỉ xóa được phòng chưa có lịch sử thuê/hóa đơn.`)) return; await save('DELETE', `rooms/${el.dataset.id}`, undefined, 'Đã xóa phòng'); closeModal(); go('#/dashboard'); };
forms.room = async (f, fd) => {
  const id = f.dataset.id; const body = { name: fd.get('name'), note: fd.get('note') }; if (id) body.status = fd.get('status');
  await save(id ? 'PUT' : 'POST', id ? `rooms/${id}` : 'rooms', body); closeModal(); rerender();
};

// ---- thêm khách ----
let occSeq = 0;
const occBlock = () => { const n = ++occSeq; return html`<div class="occ" data-slot="o${n}"><div class="row"><b class="sp">${icon('user', '1.1em')} Người ở cùng</b><button type="button" class="btn danger sm" data-act="del-occ">Xóa</button></div>${occFields({}, `o${n}`)}</div>`; };
export const occFields = (o = {}, slot) => html`
  <div class="two">${field('Họ tên *', html`<input name="o_name" required value="${o.fullName || ''}">`)}${field('Ngày sinh *', html`<input type="date" name="o_dob" max="${todayLocal()}" required value="${o.dob || ''}">`)}</div>
  <div class="radios" role="radiogroup"><span>Giới tính:</span>${['male', 'female', 'other'].map((g, i) => html`<label><input type="radio" name="o_gender_${slot || 'e'}" value="${g}" ${(o.gender ? o.gender === g : i === 0) ? raw('checked') : ''}>${GENDER[g]}</label>`)}</div>
  <div class="two">${field('Số điện thoại', html`<input name="o_phone" inputmode="tel" value="${o.phone || ''}">`)}${field('Số Zalo (trống = dùng SĐT)', html`<input name="o_zalo" inputmode="tel" value="${o.zalo || ''}">`)}</div>
  <div class="two">${field('Số CCCD *', html`<input name="o_cccd" inputmode="numeric" value="${o.cccd || ''}">`)}${field('Ngày cấp', html`<input type="date" name="o_issue_date" max="${todayLocal()}" value="${o.cccdIssueDate || ''}">`)}</div>
  ${issueField('o_issue_place', o.cccdIssuePlace, 'Nơi cấp', false)}${field('Địa chỉ thường trú *', html`<input name="o_address" value="${o.address || ''}">`)}
  <label class="radios"><input type="checkbox" name="o_noid" data-change="occ-noid" ${o.noId ? raw('checked') : ''}>Chưa có CCCD (trẻ em) – không cần CCCD, địa chỉ, ảnh</label>
  ${field('Quê quán', html`<input name="o_hometown" value="${o.hometown || ''}">`)}
  <div class="radios" role="radiogroup"><span>Thời gian ở:</span>${[['from', 'Kể từ ngày'], ['range', 'Từ ngày … đến ngày …']].map(([k, l]) => html`<label><input type="radio" name="o_stay_${slot || 'e'}" value="${k}" data-change="occ-stay" ${(o.stayMode || 'from') === k ? raw('checked') : ''}>${l}</label>`)}</div>
  <div class="two">${field('Ngày bắt đầu ở', html`<input type="date" name="o_from" value="${o.stayFrom || (o.fullName ? '' : todayLocal())}">`, 'Mặc định là ngày nhập liệu hôm nay, có thể đổi. Để trống = tính từ ngày khách chính vào ở')}<div class="occ-to" ${o.stayMode === 'range' ? '' : raw('hidden')}>${field('Đến ngày', html`<input type="date" name="o_to" value="${o.stayTo || ''}">`)}</div></div>
  ${field('Ghi chú', html`<input name="o_note" value="${o.note || ''}">`)}
  ${slot ? html`<div class="occ-img" ${o.noId ? raw('hidden') : ''}>${idBox(`${slot}-front`, { title: 'CCCD mặt trước (người ở cùng) – có thể thêm sau', required: false })}${idBox(`${slot}-back`, { title: 'CCCD mặt sau (người ở cùng) – có thể thêm sau', required: false })}</div>` : ''}`;
changes['occ-stay'] = (el) => { const b = el.closest('.occ, form'); const to = b && b.querySelector('.occ-to'); if (to) to.hidden = el.value !== 'range'; };
changes['occ-noid'] = (el) => { const box = el.closest('.occ, form')?.querySelector('.occ-img'); if (box) box.hidden = el.checked; };
acts['add-occ'] = () => { const c = $('#occs'); const d = document.createElement('div'); d.innerHTML = occBlock().s; c.append(d.firstElementChild); };
acts['del-occ'] = (el) => el.closest('.occ').remove();
export const personFields = (t = {}) => html`
  ${field('Họ và tên *', html`<input name="fullName" required value="${t.fullName || ''}" autocomplete="off">`)}
  <div class="two">${field('Ngày sinh (đầy đủ) *', html`<input type="date" name="dob" required max="${todayLocal()}" value="${t.dob || ''}">`)}${field('Số điện thoại *', html`<input name="phone" inputmode="tel" required value="${t.phone || ''}">`)}</div>
  ${field('Số Zalo (để trống = dùng số điện thoại)', html`<input name="zalo" inputmode="tel" value="${t.zalo && t.zalo !== t.phone ? t.zalo : ''}">`)}
  <div class="radios" role="radiogroup" aria-label="Giới tính"><b>Giới tính *</b>${['male', 'female', 'other'].map((g) => html`<label><input type="radio" name="gender" value="${g}" required ${t.gender === g ? raw('checked') : ''}>${GENDER[g]}</label>`)}</div>
  <div class="two">${field('Số CCCD *', html`<input name="cccd" inputmode="numeric" required value="${t.cccd || ''}">`)}${field('Ngày cấp *', html`<input type="date" name="cccdIssueDate" required max="${todayLocal()}" value="${t.cccdIssueDate || ''}">`)}</div>
  ${issueField('cccdIssuePlace', t.cccdIssuePlace)}${field('Địa chỉ thường trú *', html`<input name="address" required value="${t.address || ''}">`)}${field('Quê quán', html`<input name="hometown" value="${t.hometown || ''}" placeholder="Xã/phường, huyện/quận, tỉnh/thành phố">`)}`;
acts['fill-issue'] = (el) => { const i = el.closest('label').querySelector('input[name]'); i.value = ISSUE_PLACE; i.dispatchEvent(new Event('input', { bubbles: true })); };
export function collectPerson(fd) { return { fullName: fd.get('fullName'), dob: fd.get('dob'), gender: fd.get('gender'), phone: fd.get('phone'), zalo: fd.get('zalo'), cccd: fd.get('cccd'), cccdIssueDate: fd.get('cccdIssueDate'), cccdIssuePlace: fd.get('cccdIssuePlace'), address: fd.get('address'), hometown: fd.get('hometown') }; }
export function collectOccupant(b) { const g = (n) => b.querySelector(`[name=${n}]`).value; return { fullName: g('o_name'), dob: g('o_dob'), gender: b.querySelector('input[name^=o_gender_]:checked')?.value, phone: g('o_phone'), zalo: g('o_zalo'), cccd: g('o_cccd'), address: g('o_address'), hometown: g('o_hometown'), cccdIssueDate: g('o_issue_date'), cccdIssuePlace: g('o_issue_place'), note: g('o_note'), noId: b.querySelector('[name=o_noid]').checked, stayMode: b.querySelector('input[name^=o_stay_]:checked')?.value || 'from', stayFrom: g('o_from'), stayTo: g('o_to') }; }
export const collectOccupants = (f) => [...f.querySelectorAll('.occ')].map(collectOccupant);
acts.movein = (el) => {
  const rm = room(el.dataset.id); resetImages(); occSeq = 0;
  openModal(`Thêm khách thuê – ${rm.name}`, html`<form data-form="movein" data-room="${rm.id}" data-live="movein">
    <fieldset><legend>Thông tin khách thuê</legend>${personFields()}</fieldset>
    <fieldset><legend>Thuê phòng</legend>${field('Ngày bắt đầu vào ở *', html`<input type="date" name="startDate" required value="${todayLocal()}">`, 'Ngày thu tiền hằng tháng tính theo ngày này. Kỳ đầu thu đủ tiền phòng.')}
      <div class="warn-box" id="oldstart" hidden>Ngày vào ở đã quá 1 tháng: hệ thống tạo hóa đơn cho <b>kỳ đang chạy</b>. Hãy nhập chỉ số điện nước <b>hiện tại trên đồng hồ</b> và (nếu có) nợ cũ bên dưới.</div>
      <label class="radios paidbox"><input type="checkbox" name="paidAlready" checked> <b>Đã thu đủ tiền phòng kỳ đầu</b> (nhận khi khách vào). Bỏ tích nếu chưa nhận.</label>
      <div id="existbox" hidden>${field('Nợ cũ còn lại (đ)', html`<input name="openingDebt" inputmode="numeric" value="0">`)}</div>
      <div class="two">${field('Giá thuê phòng / tháng (đ) *', html`<input name="rent" inputmode="numeric" required>`)}${field('Giá điện (đ/số) *', html`<input name="elecPrice" inputmode="numeric" required>`)}</div>
      <div class="two">${field('Giá nước (đ/khối) *', html`<input name="waterPrice" inputmode="numeric" required>`)}${field('Số Tiền Đặt Cọc (đ)', html`<input name="deposit" inputmode="numeric" value="0">`, 'Mặc định 0. Có nhập thì hoàn lại khi khách trả phòng, sau khi thanh toán hết tiền phòng, điện nước.')}</div>
      <div class="radios" role="radiogroup"><b>Hình thức thanh toán tiền thuê</b>${[['month', 'Theo tháng'], ['quarter', 'Theo quý'], ['year', 'Theo năm']].map(([k, l]) => html`<label><input type="radio" name="payCycle" value="${k}" ${k === 'month' ? raw('checked') : ''}>${l}</label>`)}</div>
      <div class="two">${field('Chỉ số điện ban đầu *', html`<input name="initElec" inputmode="decimal" required>`)}${field('Chỉ số nước ban đầu *', html`<input name="initWater" inputmode="decimal" required>`)}</div>
      ${field('Ghi chú', html`<textarea name="note" maxlength="300"></textarea>`)}</fieldset>
    <fieldset><legend>Ảnh CCCD khách thuê (không bắt buộc – thêm sau được)</legend>${idBox('front', { required: false })}${idBox('back', { required: false })}</fieldset>
    <fieldset><legend>Người ở cùng (không tính thêm tiền)</legend><div id="occs"></div><button type="button" class="btn red" data-act="add-occ" style="margin-bottom:12px">${icon('plus', '1.1em')} Thêm người ở cùng</button></fieldset>
    <div class="err-inline"></div><button class="btn primary block" type="submit">LƯU KHÁCH THUÊ</button></form>`, { wide: true });
};
live.movein = (f) => {
  const sd = f.startDate.value; const now = todayLocal(); let old = false;
  if (sd && sd < now) { const [y, m, d] = sd.split('-').map(Number); const [ty, tm] = now.split('-').map(Number); let k = (ty * 12 + tm) - (y * 12 + m); const dim = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).getUTCDate(); const start = (kk) => { const t = y * 12 + (m - 1) + kk; const ny = Math.floor(t / 12), nm = (t % 12) + 1; return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, dim(ny, nm))).padStart(2, '0')}`; }; while (k > 0 && start(k) > now) k--; old = k > 0; }
  $('#existbox').hidden = !old; $('#oldstart').hidden = !old;
};
forms.movein = async (f, fd) => {
  const blocks = [...f.querySelectorAll('.occ')]; const occupants = blocks.map(collectOccupant);
  const body = { roomId: f.dataset.room, tenant: collectPerson(fd), occupants, startDate: fd.get('startDate'), openingDebt: toInt(fd.get('openingDebt')) || 0, paidAlready: fd.get('paidAlready') === 'on', rent: toInt(fd.get('rent')), deposit: toInt(fd.get('deposit')) || 0, payCycle: fd.get('payCycle') || 'month', elecPrice: toInt(fd.get('elecPrice')), waterPrice: toInt(fd.get('waterPrice')), initElec: toDec(fd.get('initElec')), initWater: toDec(fd.get('initWater')), note: fd.get('note') };
  const j = await save('POST', 'tenants', body, 'Đã lưu khách thuê'); const tid = j.result.tenant.id;
  const jobs = [[tid, 'front'], [tid, 'back'], ...blocks.flatMap((b, i) => (occupants[i].noId ? [] : [[j.result.occupantIds[i], `${b.dataset.slot}-front`, 'front'], [j.result.occupantIds[i], `${b.dataset.slot}-back`, 'back']]))].filter(([, slot]) => getBlob(slot));
  const pending = jobs.map(([owner, slot, side]) => ({ owner, slot, side, blob: getBlob(slot) })); closeModal(); go(`#/room/${body.roomId}`); rerender(); // đóng ngay, không bắt chờ tải ảnh
  if (pending.length) { toast(`Đã lưu khách. Đang tải ${pending.length} ảnh CCCD lên (chạy nền)…`); let fail = 0; await Promise.all(pending.map((p) => uploadImage(p.owner, p.slot, p.side || p.slot).catch(() => { fail++; }))); resetImages(); rerender(); toast(fail ? `Có ${fail} ảnh chưa tải được – vào Hồ sơ khách để thêm lại` : 'Đã tải xong ảnh CCCD', fail ? 'err' : 'ok'); } else { resetImages(); toast('Đã lưu khách (chưa có ảnh CCCD – thêm sau trong Hồ sơ khách)'); }
};
// ---- thêm người ở cùng vào phòng đã có khách ----
acts['add-occupant'] = (el) => { resetImages(); openModal('Thêm người ở cùng', html`<form data-form="occupant-add" data-tid="${el.dataset.tid}"><p class="warn-box">Không tính thêm tiền phòng. Ảnh CCCD không bắt buộc, có thể thêm sau khi người đó cung cấp.</p>${occFields({}, 'add')}<div class="err-inline"></div><button class="btn primary block" type="submit">LƯU NGƯỜI Ở CÙNG</button></form>`); };
forms['occupant-add'] = async (f) => {
  const o = collectOccupant(f); const j = await save('POST', 'occupants', { tenantId: f.dataset.tid, occupant: o }, null); const id = j.result.id; let fail = false;
  if (!o.noId) for (const side of ['front', 'back']) if (getBlob(`add-${side}`)) { try { await uploadImage(id, `add-${side}`, side); } catch (e) { fail = true; toast(`Chưa tải được ảnh: ${e.message}`, 'err'); } }
  resetImages(); closeModal(); if (!fail) toast('Đã thêm người ở cùng'); rerender();
};

// ---- Tính tiền: chọn tháng, ghi điện nước, nợ cũ, phí dịch vụ ----
acts.readings = (el) => {
  const r = D().rentals.find((x) => x.id === el.dataset.id), rd = DV().rentals[r.id], rm = room(r.roomId);
  if (!rd.canBill) { openModal('Chưa tới kỳ', html`<p>Kỳ tiếp theo (kỳ ${rd.nextPeriod + 1}) đến hạn <b>${dmy(rd.nextDue)}</b>. Chỉ tính tiền trước hạn tối đa 7 ngày.</p>`); return; }
  const un = (DV().months[r.chainId] || []).filter((x) => x.outstanding > 0);
  const unpaidInfo = un.length ? html`<div class="warn-box"><b>Nợ cũ tự động chuyển sang:</b> ${un.map((x) => `tháng ${Number(x.ym.slice(5))}/${x.ym.slice(0, 4)} còn nợ ${vnd(x.outstanding)}`).join('; ')}.</div>` : html`<div class="calc">Nợ cũ: <b>0 đ</b> (các tháng trước đã thanh toán đủ).</div>`;
  openModal(`Tính tiền – ${rm.name}`, html`<form data-form="readings" data-rental="${r.id}" data-live="readings" data-be="${rd.baseElec}" data-bw="${rd.baseWater}" data-pe="${rd.price.elecPrice}" data-pw="${rd.price.waterPrice}" data-rent="${rd.price.rent}" data-first="${rd.periods[0].index}">
    ${field('Chọn tháng cần tính *', html`<select name="periodIndex">${rd.periods.map((p) => html`<option value="${p.index}">Tháng ${Number(p.ym.slice(5))}/${p.ym.slice(0, 4)} (đến hạn ${dmy(p.due)})</option>`)}</select>`, 'Đi vắng không ghi tháng nào thì cứ chọn tháng sau: hệ thống lập tháng bị bỏ qua chỉ có tiền phòng, điện nước tính gộp từ số lần ghi gần nhất.')}
    <div class="warn-box" id="skipwarn" hidden></div>
    <div class="two keep">${field(`Chỉ số điện mới (số cũ: ${num(rd.baseElec)}) *`, html`<input name="elecNew" inputmode="decimal" required>`)}${field(`Chỉ số nước mới (số cũ: ${num(rd.baseWater)}) *`, html`<input name="waterNew" inputmode="decimal" required>`)}</div>
    ${field('Ngày chốt số (ngày đọc đồng hồ)', html`<input type="date" name="readDate" value="${todayLocal()}" max="${todayLocal()}" required>`, 'Mặc định hôm nay; chọn đúng ngày đọc nếu ghi muộn.')}
    <div class="calc" id="rcalc">Nhập chỉ số mới để xem số tiền.</div>
    ${unpaidInfo}
    <fieldset><legend>Nợ cũ & chi phí khác (nếu có – không có thì để trống)</legend>
      <div class="two keep">${field('Nợ cũ (đ)', html`<input name="manualDebt" inputmode="numeric" placeholder="0">`)}<div></div></div>
      <div class="two keep">${field('Chi phí khác (đ)', html`<input name="otherAmount" inputmode="numeric" placeholder="0">`)}${field('Nội dung (tùy chọn)', html`<input name="otherLabel" maxlength="100" placeholder="Sửa khóa, internet…">`)}</div>
      <p class="muted small" style="margin:0 0 10px">Khoản nào có nhập mới hiện trong hóa đơn của khách; để trống thì hóa đơn không hiện dòng đó.</p></fieldset>
    ${field('Ghi chú hóa đơn', html`<input name="note" maxlength="300">`)}<div class="err-inline"></div><button class="btn red block" type="submit">LƯU CHỈ SỐ & LẬP HÓA ĐƠN</button></form>`);
};
live.readings = (f) => {
  const d = f.dataset, e = toDec(f.elecNew.value), w = toDec(f.waterNew.value); const box = $('#rcalc');
  const sw = $('#skipwarn'); const skipped = Number(f.periodIndex.value) - Number(d.first); if (skipped > 0) { sw.hidden = false; sw.textContent = `Bỏ qua ${skipped} tháng: các tháng đó sẽ được lập hóa đơn chỉ có tiền phòng; điện nước tính gộp vào tháng bạn chọn (từ chỉ số cũ ${num(d.be)}).`; } else sw.hidden = true;
  if ((!Number.isNaN(e) && e < +d.be) || (!Number.isNaN(w) && w < +d.bw)) { box.className = 'warn-box'; box.textContent = 'Chỉ số mới nhỏ hơn chỉ số cũ. Hãy kiểm tra lại đồng hồ – hệ thống sẽ không chấp nhận.'; return; }
  if (Number.isNaN(e) || Number.isNaN(w)) { box.className = 'calc'; box.textContent = 'Nhập chỉ số mới để xem số tiền.'; return; }
  const ea = Math.round((e - d.be) * d.pe), wa = Math.round((w - d.bw) * d.pw); box.className = 'calc';
  box.innerHTML = html`Điện: <b>${num(e - d.be)}</b> số × ${num(d.pe)} = <b>${vnd(ea)}</b><br>Nước: <b>${num(w - d.bw)}</b> khối × ${num(d.pw)} = <b>${vnd(wa)}</b><br>Tiền phòng kỳ mới: ${vnd(d.rent)}<br><i class="muted small">Ước tính; nợ cũ và đơn giá chính xác được hệ thống chốt khi lưu.</i>`.s;
};
forms.readings = async (f, fd) => {
  const oa = toInt(fd.get('otherAmount')); const extras = oa ? [{ label: (fd.get('otherLabel') || '').trim() || 'Chi phí khác', amount: oa }] : [];
  const j = await save('POST', 'readings', { rentalId: f.dataset.rental, periodIndex: Number(fd.get('periodIndex')), elecNew: toDec(fd.get('elecNew')), waterNew: toDec(fd.get('waterNew')), readDate: fd.get('readDate'), manualDebt: toInt(fd.get('manualDebt')) || 0, extras, note: fd.get('note') }, 'Đã lập hóa đơn');
  closeModal(); go(`#/invoice/${j.result.id}`);
};

// ---- Thu tiền: đúng tháng được chọn, hoặc toàn bộ nợ ----
export function payDialog(invId, { month = false } = {}) {
  const inv = D().invoices.find((i) => i.id === invId); const x = invD(invId); const ms = Object.values(DV().months).flat().find((m) => m.invoiceId === invId);
  const latest = latestInvOf(inv.chainId).id === inv.id; const chainRem = latest ? x.remaining : (D().invoices.filter((i) => i.chainId === inv.chainId).slice(-1).map((l) => invD(l.id).remaining)[0] || 0);
  const monthLeft = ms ? ms.outstanding : x.remaining; const all = !month && latest; const n = Number(inv.dueDate.slice(5, 7));
  openModal(all ? `Thanh toán – ${inv.roomName}` : `Thanh toán tháng ${n}/${inv.dueDate.slice(0, 4)} – ${inv.roomName}`, html`<form data-form="pay" data-inv="${invId}" data-month="${monthLeft}" data-chain="${chainRem}" data-latest="${latest ? 1 : 0}" data-all="${all ? 1 : 0}" data-live="pay">
    <details class="paybill"><summary class="btn sm">${icon('photo', '1.1em')} Xem hóa đơn</summary>${billArticle(inv, invD(inv.id))}<div class="row" style="margin-top:8px"><button type="button" class="btn sm" data-act="open-invoice" data-id="${inv.id}">Mở trang hóa đơn (tải ảnh / gửi Zalo)</button></div></details>
    <dl class="kv" style="margin:0 0 12px"><dt>${all ? 'Tổng còn phải thu (mọi tháng)' : `Còn phải thu tháng ${n}`}</dt><dd class="big owe money" id="paydue">${vnd(all ? chainRem : monthLeft)}</dd>${!all && latest && chainRem > monthLeft ? html`<dt>Tổng nợ cả các tháng trước</dt><dd>${vnd(chainRem)}</dd>` : ''}</dl>
    ${!all && latest && chainRem > monthLeft ? html`<div class="radios"><label><input type="radio" name="scope" value="month" checked>Chỉ tháng ${n}</label><label><input type="radio" name="scope" value="all">Toàn bộ nợ</label></div>` : ''}
    <p class="muted small" style="margin:0 0 8px">Nhận <b>đủ</b> thì bấm "Trả đủ". Nhận <b>ít hơn</b> thì nhập số thực nhận: phần còn thiếu được giữ lại và chuyển thành <b>Nợ cũ</b> ở hóa đơn kỳ sau.</p>${field('Số tiền khách thực tế trả (đ) *', html`<input name="amount" inputmode="numeric" required value="${all ? chainRem : monthLeft}">`)}<div class="row" style="margin:-4px 0 12px"><button type="button" class="btn sm" data-act="pay-full">Trả đủ</button></div>
    <fieldset><legend>Phát sinh khi thu tiền (nếu có)</legend><div class="two keep">${field('Tiền phát sinh (đ)', html`<input name="extraAmount" inputmode="numeric" placeholder="0">`)}${field('Nội dung phát sinh', html`<input name="extraLabel" maxlength="100" placeholder="Sửa khóa, internet…">`)}</div><p class="muted small" style="margin:0 0 6px">Khoản này được cộng vào hóa đơn mới nhất của khách và hiện trên hóa đơn.</p></fieldset>
    ${field('Ngày nhận tiền', html`<input type="date" name="date" value="${todayLocal()}" max="${todayLocal()}" required>`)}${field('Ghi chú', html`<input name="note" maxlength="200">`)}<div class="err-inline"></div><button class="btn green block" type="submit">${icon('check', '1.2em')} ĐÃ NHẬN TIỀN</button></form>`);
}
acts.pay = (el) => payDialog(el.dataset.id);
acts['pay-month'] = (el) => payDialog(el.dataset.id, { month: true });
const extraOf = (f) => (f.dataset.latest === '1' ? toInt(f.extraAmount.value) || 0 : 0);
live.pay = (f) => { const all = f.dataset.all === '1' || f.scope?.value === 'all'; const base = Number(all ? f.dataset.chain : f.dataset.month) + extraOf(f); const el = $('#paydue'); if (el) el.textContent = vnd(base); };
acts['pay-full'] = () => { const f = $('form[data-form=pay]'); const all = f.dataset.all === '1' || f.scope?.value === 'all'; f.amount.value = Number(all ? f.dataset.chain : f.dataset.month) + extraOf(f); f.amount.dispatchEvent(new Event('input', { bubbles: true })); };
forms.pay = async (f, fd) => {
  const amount = toInt(fd.get('amount')); if (!(amount > 0)) throw new Error('Số tiền phải lớn hơn 0');
  const body = { invoiceId: f.dataset.inv, amount, date: fd.get('date'), note: fd.get('note') };
  const ex = toInt(fd.get('extraAmount')) || 0; if (ex > 0) { body.extraAmount = ex; body.extraLabel = fd.get('extraLabel'); }
  if (f.dataset.latest === '1') body.allMonths = f.dataset.all === '1' || fd.get('scope') === 'all'; // hóa đơn mới nhất: chọn "chỉ tháng này" hay "toàn bộ nợ"
  await save('POST', 'payments', body, 'Đã ghi nhận – thông báo tháng này sẽ ẩn khi đã thu đủ'); closeModal(); rerender();
};

// ---- đổi giá ----
acts.price = (el) => {
  const r = D().rentals.find((x) => x.id === el.dataset.id), p = DV().rentals[r.id].price;
  openModal(`Thay đổi giá phòng – ${room(r.roomId).name}`, html`<form data-form="price" data-rental="${r.id}"><div class="calc">Giá cũ: thuê <b>${vnd(p.rent)}</b> · điện <b>${num(p.elecPrice)}</b> · nước <b>${num(p.waterPrice)}</b></div>
    <div class="two">${field('Giá thuê mới (đ)', html`<input name="rent" inputmode="numeric" required value="${p.rent}">`)}${field('Ngày bắt đầu áp dụng', html`<input type="date" name="effectiveFrom" required value="${DV().rentals[r.id].nextDue}">`, 'Mặc định: kỳ tới. Hóa đơn đã lập không đổi.')}</div>
    <div class="two">${field('Giá điện mới (đ/số)', html`<input name="elecPrice" inputmode="numeric" required value="${p.elecPrice}">`)}${field('Giá nước mới (đ/khối)', html`<input name="waterPrice" inputmode="numeric" required value="${p.waterPrice}">`)}</div>
    ${field('Lý do thay đổi', html`<input name="reason" maxlength="200">`)}<div class="err-inline"></div><button class="btn primary block" type="submit">LƯU GIÁ MỚI</button></form>`);
};
forms.price = async (f, fd) => { await save('POST', `rentals/${f.dataset.rental}/price`, { rent: toInt(fd.get('rent')), elecPrice: toInt(fd.get('elecPrice')), waterPrice: toInt(fd.get('waterPrice')), effectiveFrom: fd.get('effectiveFrom'), reason: fd.get('reason') }, 'Đã lưu giá mới'); closeModal(); rerender(); };

// ---- trả phòng (xem tính toán → xác nhận) ----
acts.checkout = (el) => {
  const r = D().rentals.find((x) => x.id === el.dataset.id), rd = DV().rentals[r.id];
  const Linv = latestInvOf(r.chainId); const Ld = Linv && invD(Linv.id);
  openModal(`Quyết toán trả phòng – ${room(r.roomId).name}`, html`${Ld && Ld.remaining > 0 ? html`<div class="warn-box"><b>Chưa ghi nhận thu đủ tiền kỳ hiện tại: còn ${vnd(Ld.remaining)}.</b> Số này sẽ hiện là <b>Nợ cũ</b> trên hóa đơn trả phòng. Nếu khách đã đưa tiền phòng đầu tháng, hãy bấm <b>Đã nhận tiền</b> trước.<div style="margin-top:8px"><button type="button" class="btn green sm" data-act="pay" data-id="${Linv.id}">${icon('check', '1.1em')} Đã nhận tiền</button></div></div>` : ''}<form data-form="checkout" data-rental="${r.id}"><div class="two">${field('Ngày trả phòng *', html`<input type="date" name="date" required value="${todayLocal()}" max="${todayLocal()}">`)}<div></div></div>
    <div class="two">${field(`Chỉ số điện cuối (cũ: ${rd.baseElec}) *`, html`<input name="elecFinal" inputmode="decimal" required>`)}${field(`Chỉ số nước cuối (cũ: ${rd.baseWater}) *`, html`<input name="waterFinal" inputmode="decimal" required>`)}</div>
    <fieldset><legend>Khoản phát sinh chưa thanh toán (nếu có)</legend><div class="two">${field('Nội dung', html`<input name="x1l">`)}${field('Số tiền (đ)', html`<input name="x1a" inputmode="numeric">`)}</div></fieldset>${field('Ghi chú', html`<input name="note" maxlength="300">`)}
    <div class="err-inline"></div><button class="btn primary block" type="submit">XEM TÍNH TOÁN QUYẾT TOÁN</button></form>`);
};
forms.checkout = async (f, fd) => {
  const x = fd.get('x1l').trim(); const body = { rentalId: f.dataset.rental, date: fd.get('date'), elecFinal: toDec(fd.get('elecFinal')), waterFinal: toDec(fd.get('waterFinal')), extras: x || fd.get('x1a') ? [{ label: x, amount: toInt(fd.get('x1a')) }] : [], note: fd.get('note') };
  const { preview: p } = await api('POST', 'checkout/preview', body);
  const dir = p.direction === 'refund' ? html`<div class="stamp green">CHỦ NHÀ HOÀN LẠI KHÁCH: ${vnd(-p.total)}</div>` : p.direction === 'owe' ? html`<div class="stamp red">KHÁCH CÒN PHẢI TRẢ: ${vnd(p.total)}</div>` : html`<div class="stamp gray">ĐÃ QUYẾT TOÁN (0 đ)</div>`;
  openModal('Xác nhận quyết toán', html`<p style="margin-top:0"><b>${p.tenantName}</b> · ${p.roomName}<br>Vào ở ${dmy(p.startDate)} · trả phòng ${dmy(body.date)}</p>
    <dl class="kv"><dt>Giá thuê tháng</dt><dd>${vnd(p.monthRent)}</dd><dt>Giá thuê mỗi ngày (÷30)</dt><dd>${vnd(p.rentPerDay)}</dd><dt>Số ngày thực tế đã ở (từ ${dmy(p.periodStartDate)})</dt><dd><b>${p.days} ngày</b></dd><dt>Tiền phòng thực tế</dt><dd>${vnd(p.actualRent)}</dd>
    <dt>Điện (${num(p.elec.old)} → ${num(p.elec.new)})</dt><dd>${vnd(p.elec.amount)}</dd><dt>Nước (${num(p.water.old)} → ${num(p.water.new)})</dt><dd>${vnd(p.water.amount)}</dd>
    ${p.extras.map((e) => html`<dt>Chi phí khác: ${e.label || ''}</dt><dd>${vnd(e.amount)}</dd>`)}${(p.carry - (p.billed ? p.monthRent : 0)) > 0 ? html`<dt>Nợ cũ</dt><dd>${vnd(p.carry - (p.billed ? p.monthRent : 0))}</dd>` : ''}${(p.carry - (p.billed ? p.monthRent : 0)) < 0 ? html`<dt>Trừ: đã thu trước (tiền phòng đầu kỳ)</dt><dd>${vnd(p.carry - p.monthRent)}</dd>` : ''}${p.deposit > 0 ? html`<dt>Trừ: tiền đặt cọc đã nhận</dt><dd>${vnd(-p.deposit)}</dd>` : ''}</dl>
    ${p.deposit > 0 ? html`<div class="calc">Tiền đặt cọc ${vnd(p.deposit)} được trừ vào các khoản khách phải trả. Phần còn dư là số chủ nhà hoàn lại cho khách; nếu còn thiếu, khách trả thêm.</div>` : ''}<div class="calc">Tiền phòng tính theo số ngày thực tế ở (giá thuê ÷ 30 ngày × số ngày). ${p.billed ? 'Khách đã đóng tiền phòng đầu kỳ nên khoản đó được trừ vào, phần dư là số chủ nhà hoàn lại.' : 'Kỳ này chưa lập hóa đơn nên tính tiền phòng theo số ngày ở.'}</div>${dir}
    <p class="muted small">Kiểm tra kỹ số ngày và chỉ số. Sau khi xác nhận: phòng chuyển sang Trống, lưu hóa đơn quyết toán và lịch sử thuê.</p>
    <div class="err-inline"></div><button class="btn primary block" data-act="checkout-confirm" data-body='${JSON.stringify(body)}'>XÁC NHẬN QUYẾT TOÁN & TRẢ PHÒNG</button>`);
};
acts['checkout-confirm'] = async (el) => {
  el.disabled = true; try { const j = await save('POST', 'checkout', JSON.parse(el.dataset.body), 'Đã quyết toán và trả phòng'); closeModal(); go(`#/invoice/${j.result.invoice.id}`); } finally { el.disabled = false; }
};
acts.refunded = async (el) => { await save('POST', `checkout/${el.dataset.id}/refunded`, {}, 'Đã ghi nhận hoàn tiền'); rerender(); };

// ---- chuyển phòng ----
acts.transfer = (el) => {
  const r = D().rentals.find((x) => x.id === el.dataset.id), rd = DV().rentals[r.id]; const empties = D().rooms.filter((x) => !x.kind && x.status === 'empty' && x.id !== r.roomId);
  if (!empties.length) { openModal('Chuyển phòng', html`<p>Không có phòng nào ở trạng thái Trống để chuyển tới.</p>`); return; }
  openModal(`Chuyển phòng từ ${room(r.roomId).name}`, html`<form data-form="transfer" data-rental="${r.id}"><div class="warn-box">Phòng cũ được chốt hóa đơn riêng (điện nước đến ngày chuyển + nợ còn lại). Tiền phòng kỳ hiện tại giữ nguyên cho phòng mới; chu kỳ thu tiền không đổi.</div>
    <div class="two">${field('Ngày chuyển *', html`<input type="date" name="date" required value="${todayLocal()}" max="${todayLocal()}">`)}${field('Phòng mới * (chỉ chọn được phòng đang TRỐNG)', html`<select name="newRoomId" required>${empties.map((x) => html`<option value="${x.id}">${x.name} – trống</option>`)}</select>`)}</div>
    <fieldset><legend>Phòng cũ – chỉ số cuối</legend><div class="two">${field(`Điện cuối (cũ: ${rd.baseElec})`, html`<input name="elecFinal" inputmode="decimal" required>`)}${field(`Nước cuối (cũ: ${rd.baseWater})`, html`<input name="waterFinal" inputmode="decimal" required>`)}</div></fieldset>
    <fieldset><legend>Phòng mới – chỉ số ban đầu</legend><div class="two">${field('Điện ban đầu', html`<input name="newInitElec" inputmode="decimal" required>`)}${field('Nước ban đầu', html`<input name="newInitWater" inputmode="decimal" required>`)}</div>
    <div class="two">${field('Giá thuê mới (đ) – từ kỳ sau', html`<input name="newRent" inputmode="numeric" value="${rd.price.rent}">`)}<div></div></div><div class="two">${field('Giá điện', html`<input name="newElecPrice" inputmode="numeric" value="${rd.price.elecPrice}">`)}${field('Giá nước', html`<input name="newWaterPrice" inputmode="numeric" value="${rd.price.waterPrice}">`)}</div></fieldset>
    <div class="err-inline"></div><button class="btn primary block" type="submit">XÁC NHẬN CHUYỂN PHÒNG</button></form>`);
};
forms.transfer = async (f, fd) => {
  const j = await save('POST', 'transfer', { rentalId: f.dataset.rental, date: fd.get('date'), newRoomId: fd.get('newRoomId'), elecFinal: toDec(fd.get('elecFinal')), waterFinal: toDec(fd.get('waterFinal')), newInitElec: toDec(fd.get('newInitElec')), newInitWater: toDec(fd.get('newInitWater')), newRent: toInt(fd.get('newRent')), newElecPrice: toInt(fd.get('newElecPrice')), newWaterPrice: toInt(fd.get('newWaterPrice')) }, 'Đã chuyển phòng');
  closeModal(); go(`#/room/${fd.get('newRoomId')}`);
};

// ---- Xóa hóa đơn: cảnh báo mạnh trước khi xóa ----
acts['del-invoice'] = (el) => {
  const i = D().invoices.find((x) => x.id === el.dataset.id); const chain = D().invoices.filter((x) => x.chainId === i.chainId); const idx = chain.findIndex((x) => x.id === i.id);
  const m = (x) => `${Number(x.dueDate.slice(5, 7))}/${x.dueDate.slice(0, 4)}`; const act = D().rentals.find((r) => r.chainId === i.chainId && r.status === 'active');
  const head = html`<div class="warn-box" style="background:var(--red-bg);color:var(--red-t)"><b>${icon('alert', '1.2em')} CHÚ Ý: đây là dữ liệu tiền bạc quan trọng. Xóa xong KHÔNG khôi phục lại được.</b></div>`;
  const ask = (go_, id) => html`<p class="muted small">Nên bấm tab <b>Sao lưu</b> → <b>Tải database.json</b> trước khi xóa.</p><label class="radios"><input type="checkbox" id="delok"> Tôi đã hiểu và muốn xóa vĩnh viễn</label><div class="row"><button class="btn danger sp" data-act="${go_}" data-id="${id}">${icon('trash', '1.1em')} XÓA VĨNH VIỄN</button><button class="btn" data-act="modal-close">Hủy</button></div>`;
  const label = (x) => (x.kind === 'checkout' ? 'trả phòng' : x.kind === 'transfer' ? 'chuyển phòng' : `tháng ${m(x)}`);
  const sums = (list) => { const ids = new Set(list.map((x) => x.id)); const pays = D().payments.filter((p) => ids.has(p.invoiceId) && !p.voided); return { n: pays.length, sum: pays.reduce((s, p) => s + p.amount, 0) }; };
  if (act && idx === 0 && chain.length > 1) { openModal('Chưa xóa được hóa đơn đầu tiên', html`<p style="margin-top:0">Đây là hóa đơn lập khi <b>${i.tenantName}</b> vào ở. Muốn xóa nó, hãy xóa các hóa đơn tháng sau trước (bấm <b>Xóa</b> ở tháng ${m(chain[1])} sẽ xóa từ tháng đó trở đi).</p><button class="btn block" data-act="modal-close">Đã hiểu</button>`); return; }
  if (act && idx === 0) {
    const p = sums([i]);
    openModal('Cảnh báo: xóa khách nhập nhầm', html`${head}<p>Bạn sắp <b>xóa khách ${i.tenantName} khỏi ${i.roomName}</b> (dùng khi nhập nhầm khách):</p><ul style="line-height:1.6;padding-left:20px"><li>Xóa hồ sơ khách, người ở cùng và <b>ảnh CCCD</b>.</li><li>Xóa hóa đơn đầu tiên (${vnd(i.total)}) và <b>${p.n}</b> lần thu tiền (${vnd(p.sum)}).</li><li>${i.roomName} trở về trạng thái <b>${ROOM_STATUS.empty}</b>.</li></ul>${ask('del-movein-go', act.id)}`); return;
  }
  const gone = idx === 0 ? chain : chain.slice(idx); const p = sums(gone); const whole = !act && idx === 0; const hasCo = gone.some((x) => x.kind === 'checkout');
  openModal('Cảnh báo: xóa dữ liệu quan trọng', html`${head}<p>${whole ? html`Bạn sắp xóa <b>toàn bộ lịch sử thuê</b> của <b>${i.tenantName}</b> tại <b>${i.roomName}</b> (từ hóa đơn đầu tiên).` : html`Bạn sắp xóa hóa đơn <b>${label(i)}</b>${gone.length > 1 ? html` <b>và các dòng sau nó (${gone.slice(1).map(label).join(', ')})</b>` : ''} của <b>${i.roomName} – ${i.tenantName}</b>${act ? '' : ' (khách đã trả phòng)'}.`}</p>
    <ul style="line-height:1.6;padding-left:20px"><li>Xóa <b>${gone.length}</b> hóa đơn (kể cả dòng đã thanh toán / thanh toán 1 phần).</li><li>Xóa <b>${p.n}</b> lần thu tiền đã ghi (tổng <b>${vnd(p.sum)}</b>).</li><li>Xóa chỉ số điện nước đã nhập cho các kỳ này.</li>${hasCo ? html`<li>Xóa luôn <b>kết quả trả phòng / hoàn tiền</b> của hóa đơn trả phòng.</li>` : ''}${whole ? html`<li>Xóa hồ sơ khách và <b>ảnh CCCD</b> (nếu khách không còn lượt thuê nào khác).</li>` : html`<li>Nợ của các tháng trước trở lại như trước khi lập.</li>`}</ul>
    <p class="muted small">Xóa xong, tháng đó trong bảng quay về dòng trống "Chưa có hóa đơn" để nhập mới, không mất tháng nào trong năm.</p>${ask('del-invoice-go', i.id)}`);
};
acts['del-invoice-go'] = async (el) => { if (!$('#delok')?.checked) { toast('Hãy tích vào ô "Tôi đã hiểu…" để xác nhận xóa', 'err'); return; } await save('DELETE', `invoices/${el.dataset.id}`, undefined, 'Đã xóa hóa đơn'); closeModal(); rerender(); };
acts['del-movein-go'] = async (el) => { if (!$('#delok')?.checked) { toast('Hãy tích vào ô "Tôi đã hiểu…" để xác nhận xóa', 'err'); return; } await save('DELETE', `rentals/${el.dataset.id}`, undefined, 'Đã xóa khách nhập nhầm – phòng đã trở về Trống'); closeModal(); go('#/dashboard'); };
// ---- Sửa ngày nhận phòng ----
acts['edit-start'] = (el) => { const r = D().rentals.find((x) => x.id === el.dataset.id); openModal('Sửa ngày nhận phòng', html`<form data-form="start" data-id="${r.id}">${field('Ngày nhận phòng *', html`<input type="date" name="startDate" value="${r.startDate}" max="${todayLocal()}" required>`, 'Ngày thu tiền hằng tháng tính theo ngày này. Chỉ sửa được khi khách mới có hóa đơn đầu tiên; đã có tháng sau thì xóa các hóa đơn tháng sau trước.')}<div class="err-inline"></div><button class="btn primary block" type="submit">LƯU NGÀY NHẬN PHÒNG</button></form>`); };
forms.start = async (f, fd) => { await save('PUT', `rentals/${f.dataset.id}`, { startDate: fd.get('startDate') }, 'Đã sửa ngày nhận phòng'); closeModal(); rerender(); };

// ---- Xuất hợp đồng (Word / in-PDF) ----
acts.contract = (el) => {
  const r = D().rentals.find((x) => x.id === el.dataset.id); const L = S.snap.settings?.landlord; const ow = D().rooms.find((x) => x.kind === 'owner');
  openModal('Xuất hợp đồng thuê phòng trọ', html`<form data-form="noop" data-rental="${r.id}">
    ${L && L.fullName ? '' : html`<p class="warn-box">Chưa nhập thông tin Bên A (chủ nhà) nên hợp đồng sẽ để trống phần này. Vào <a href="#/room/${ow ? ow.id : ''}" data-act="close-modal">phòng Chủ Nhà</a> → "Thông tin Bên A" để nhập một lần.</p>`}
    <p class="muted small" style="margin-top:0">Hợp đồng tự điền từ dữ liệu của phòng, khách thuê, người ở cùng và thông tin Bên A. Kiểm tra các ô dưới đây rồi chọn kiểu xuất.</p>
    <div class="two">${field('Ngày ký hợp đồng', html`<input type="date" name="signDate" value="${todayLocal()}">`)}${field('Số hợp đồng', html`<input name="contractNo" maxlength="40" value="${r.contractNo || ''}" placeholder="Ví dụ: 01">`)}</div>
    <div class="radios" role="radiogroup"><b>Thời hạn thuê (áp dụng thống nhất trong hợp đồng)</b>
      <label><input type="radio" name="termMode" value="from" ${r.termMode !== 'range' ? raw('checked') : ''}>Kể từ ngày <input type="date" name="termFrom1" data-pickmode="from" value="${r.termFrom || r.startDate}" style="width:auto"></label>
      <label><input type="radio" name="termMode" value="range" ${r.termMode === 'range' ? raw('checked') : ''}>Từ ngày <input type="date" name="termFrom2" data-pickmode="range" value="${r.termFrom || r.startDate}" style="width:auto"> đến ngày <input type="date" name="termTo" data-pickmode="range" value="${r.termTo || ''}" style="width:auto"></label></div>
    <div class="two">${field('Số Tiền Đặt Cọc (đ)', html`<input name="deposit" inputmode="numeric" value="${r.deposit || 0}">`)}${field('Phí dịch vụ khác (nếu có)', html`<input name="serviceFee" maxlength="200" value="${r.serviceFee || ''}" placeholder="Ví dụ: Rác 30.000đ/tháng">`)}</div>
    <div class="radios" role="radiogroup"><b>Hình thức thanh toán tiền thuê</b>${[['month', 'Theo tháng'], ['quarter', 'Theo quý'], ['year', 'Theo năm']].map(([k, l]) => html`<label><input type="radio" name="payCycle" value="${k}" ${(r.payCycle || 'month') === k ? raw('checked') : ''}>${l}</label>`)}</div>
    <div class="row" style="margin-top:14px"><button type="button" class="btn primary" data-act="contract-docx">${icon('sheet', '1.1em')} Tải file Word (.docx)</button><button type="button" class="btn" data-act="contract-pdf">${icon('photo', '1.1em')} In / Lưu PDF</button></div>
    <p class="muted small">Muốn có PDF: bấm "In / Lưu PDF" rồi chọn máy in "Lưu dưới dạng PDF" (hoặc mở file Word rồi Lưu thành PDF).</p></form>`, { wide: true });
};
acts['close-modal'] = () => closeModal();
// chọn ngày ở dòng nào thì tự tích dòng đó
document.addEventListener('change', (e) => { const el = e.target; if (el instanceof HTMLInputElement && el.dataset.pickmode) { const r = el.form?.querySelector(`input[name=termMode][value=${el.dataset.pickmode}]`); if (r) r.checked = true; } });
acts.ct01 = async (el) => {
  const L = S.snap.settings?.landlord || {};
  if (!L.police && !confirm('Chưa nhập "Công An Quản Lý" ở phòng Chủ Nhà nên mục "Kính gửi" và nơi ký sẽ để trống. Vẫn tải bản khai?')) return;
  el.disabled = true; const old = el.innerHTML; el.textContent = 'Đang tạo PDF…';
  try { const r = await downloadCt01(el.dataset.room); toast(r.pages > 1 ? `Đã tải bản khai CT01 (${r.pages} trang)` : 'Đã tải bản khai CT01 - Lưu Trú (PDF)'); }
  catch (e) { toast(e.message, 'err'); } finally { el.disabled = false; el.innerHTML = old; }
};
async function contractSave(el) {
  const f = el.closest('form'); const fd = new FormData(f); const id = f.dataset.rental;
  await save('PUT', `rentals/${id}/contract`, { deposit: toInt(fd.get('deposit')) || 0, payCycle: fd.get('payCycle'), termMode: fd.get('termMode'), termFrom: fd.get(fd.get('termMode') === 'range' ? 'termFrom2' : 'termFrom1') || '', termTo: fd.get('termMode') === 'range' ? fd.get('termTo') || '' : '', contractNo: fd.get('contractNo'), serviceFee: fd.get('serviceFee') }, null);
  return { id, date: fd.get('signDate') || today() };
}
acts['contract-docx'] = async (el) => {
  el.disabled = true;
  try { const { id, date } = await contractSave(el); const a = document.createElement('a'); a.href = apiUrl(`contract/${id}?format=docx&date=${date}`); a.download = ''; document.body.append(a); a.click(); a.remove(); toast('Đã tạo file hợp đồng Word (.docx)'); }
  catch (e) { toast(e.message, 'err'); } finally { el.disabled = false; }
};
acts['contract-pdf'] = async (el) => {
  el.disabled = true;
  try {
    const { id, date } = await contractSave(el); const res = await fetch(apiUrl(`contract/${id}?format=html&date=${date}`), { credentials: 'same-origin' }); if (!res.ok) throw new Error('Không tạo được hợp đồng');
    const fr = document.createElement('iframe'); fr.setAttribute('aria-hidden', 'true'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; fr.srcdoc = await res.text();
    fr.onload = () => setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { toast('Trình duyệt không mở được hộp thoại in. Hãy dùng "Tải file Word".', 'err'); } }, 400);
    document.body.append(fr); setTimeout(() => fr.remove(), 300000);
  } catch (e) { toast(e.message, 'err'); } finally { el.disabled = false; }
};
