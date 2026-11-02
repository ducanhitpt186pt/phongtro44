import { html, raw, vnd, num, dmy, monthLabel, todayLocal, toInt, toDec, field, openModal, closeModal, toast, $, ROOM_STATUS, INV_STATUS, INV_COLOR, GENDER } from '../util.js';
import { S, D, DV, save, api, room, tenant, activeRental, latestInvOf, invD, today } from '../api.js';
import { acts, forms, live, changes, go, rerender } from '../ui.js';
import { idBox, resetImages, getBlob, uploadImage } from '../images.js';

let year = null;
export function roomView(id) {
  const rm = room(id); if (!rm) return html`<p>Không tìm thấy phòng. <a href="#/dashboard">Về tổng quan</a></p>`;
  year = year || Number(today().slice(0, 4));
  const r = activeRental(id); const t = r && tenant(r.tenantId); const rd = r && DV().rentals[r.id];
  const inv = r && latestInvOf(r.chainId); const d = inv && invD(inv.id);
  const color = { occupied: 'blue', empty: 'green', repair: 'orange', notready: 'gray' }[rm.status];
  const invs = D().invoices.filter((i) => i.roomId === id && i.dueDate.startsWith(String(year)));
  const rows = [];
  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${String(m).padStart(2, '0')}`; const list = invs.filter((i) => i.dueDate.slice(0, 7) === ym);
    const noteTxt = D().monthlyNotes.find((n) => n.roomId === id && n.ym === ym)?.text || '';
    const noteCell = html`<td data-l="Ghi chú" class="full"><input class="note-in" data-change="note" data-room="${id}" data-ym="${ym}" value="${noteTxt}" placeholder="Ghi chú…" aria-label="Ghi chú ${monthLabel(ym)}"></td>`;
    if (!list.length) rows.push(html`<tr class="empty"><td data-l="Tháng"><b>${m}</b></td><td data-l="Tiền phòng" class="r">—</td><td data-l="Tiền điện" class="r">—</td><td data-l="Tiền nước" class="r">—</td><td data-l="Nợ cũ" class="r">—</td><td data-l="Tổng tiền" class="r">—</td><td data-l="Đã thanh toán" class="r">—</td><td data-l="Còn nợ" class="r">—</td><td data-l="Trạng thái" class="muted">Chưa có hóa đơn</td>${noteCell}</tr>`);
    list.forEach((i, k) => { const x = invD(i.id); rows.push(html`<tr class="click" data-act="open-invoice" data-id="${i.id}"><td data-l="Tháng"><b>${m}</b>${i.kind !== 'periodic' ? html` <span class="badge">${i.kind === 'checkout' ? 'Trả phòng' : 'Chuyển phòng'}</span>` : ''}</td>
      <td data-l="Tiền phòng" class="r">${vnd(i.rent)}</td><td data-l="Tiền điện" class="r">${i.elec ? vnd(i.elec.amount) : '—'}</td><td data-l="Tiền nước" class="r">${i.water ? vnd(i.water.amount) : '—'}</td>
      <td data-l="Nợ cũ" class="r">${vnd(i.oldDebt)}</td><td data-l="Tổng tiền" class="r"><b>${vnd(i.total)}</b></td><td data-l="Đã thanh toán" class="r">${vnd(x.paid)}</td><td data-l="Còn nợ" class="r ${x.remaining ? 'owe' : ''}">${vnd(x.remaining)}</td>
      <td data-l="Trạng thái"><span class="badge ${INV_COLOR[x.status]}">${INV_STATUS[x.status]}</span></td>${k === 0 ? noteCell : html`<td></td>`}</tr>`); });
  }
  const hist = D().rentals.filter((x) => x.roomId === id).slice().reverse();
  return html`<a class="back" href="#/dashboard">← Tổng quan</a>
    <div class="page-head"><h2>${rm.name}</h2><span class="badge ${color}">${ROOM_STATUS[rm.status]}</span><button class="btn sm" data-act="edit-room" data-id="${id}">Sửa phòng</button></div>
    ${r ? html`<section class="card"><div class="row"><div class="sp"><b>${t.fullName}</b> · ${t.phone}<br><span class="muted small">Vào ở ${dmy(r.startDate)} · ${r.headcount} người · kỳ tiếp theo đến hạn ${dmy(rd.nextDue)}</span></div><a class="btn sm" href="#/tenant/${t.id}">Hồ sơ khách</a></div>
      <dl class="kv"><dt>Giá thuê / điện / nước</dt><dd>${vnd(rd.price.rent)} · ${num(rd.price.elecPrice)}đ/số · ${num(rd.price.waterPrice)}đ/khối</dd><dt>Hóa đơn mới nhất</dt><dd>${inv.code} · ${vnd(inv.total)}</dd><dt>Đã thanh toán</dt><dd>${vnd(d.paid)}</dd><dt>Còn nợ</dt><dd class="${d.remaining ? 'owe' : 'okc'}">${vnd(d.remaining)}</dd></dl>
      <div class="row" style="margin-top:12px"><button class="btn primary" data-act="readings" data-id="${r.id}">⚡ Ghi điện nước & lập hóa đơn</button>
      ${d.remaining > 0 ? html`<button class="btn warn" data-act="pay" data-id="${inv.id}">Thanh toán</button>` : ''}<button class="btn" data-act="price" data-id="${r.id}">Đổi giá</button><button class="btn" data-act="transfer" data-id="${r.id}">Chuyển phòng</button><button class="btn danger" data-act="checkout" data-id="${r.id}">Trả phòng</button></div></section>`
    : html`<section class="card">${rm.status === 'empty' ? html`<p style="margin-top:0">Phòng đang trống.</p><button class="btn primary" data-act="movein" data-id="${id}">+ Thêm khách thuê</button>` : html`<p style="margin:0">${rm.note || ROOM_STATUS[rm.status]}. Đổi trạng thái sang "Trống" để nhận khách.</p>`}</section>`}
    <div class="page-head" style="margin-top:22px"><h2 style="font-size:1.1rem">Hóa đơn theo tháng</h2><select data-change="year" style="width:auto;min-height:40px">${[...new Set([year, Number(today().slice(0, 4)), ...D().invoices.map((i) => Number(i.dueDate.slice(0, 4)))])].sort((a, b) => b - a).map((y) => html`<option ${y === year ? raw('selected') : ''}>${y}</option>`)}</select></div>
    <table class="tbl stack"><thead><tr><th>Tháng</th><th class="r">Tiền phòng</th><th class="r">Tiền điện</th><th class="r">Tiền nước</th><th class="r">Nợ cũ</th><th class="r">Tổng tiền</th><th class="r">Đã thanh toán</th><th class="r">Còn nợ</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>${rows}</tbody></table>
    <h2 class="sec">Lịch sử thuê của phòng</h2>
    <div class="list">${hist.length ? hist.map((x) => html`<div class="li"><span><b>${tenant(x.tenantId)?.fullName}</b> · ${dmy(x.startDate)} → ${x.endDate ? dmy(x.endDate) : 'nay'}</span><span class="badge ${x.status === 'active' ? 'blue' : ''}">${{ active: 'Đang thuê', ended: 'Đã trả phòng', transferred: 'Đã chuyển phòng' }[x.status]}</span></div>`) : html`<div class="empty-state">Chưa có lịch sử thuê.</div>`}</div>`;
}
acts['open-invoice'] = (el) => go(`#/invoice/${el.dataset.id}`);
changes.year = (el) => { year = Number(el.value); rerender(); };
changes.note = async (el) => { await save('PUT', 'notes', { roomId: el.dataset.room, ym: el.dataset.ym, text: el.value }, 'Đã lưu ghi chú'); };

// ---- phòng ----
const roomForm = (r) => html`<form data-form="room" data-id="${r?.id || ''}">${field('Tên phòng', html`<input name="name" value="${r?.name || ''}" required maxlength="60">`)}
  ${r ? field('Trạng thái', html`<select name="status">${Object.entries(ROOM_STATUS).filter(([k]) => k !== 'occupied' || r.status === 'occupied').map(([k, v]) => html`<option value="${k}" ${k === r.status ? raw('selected') : ''}>${v}</option>`)}</select>`, 'Phòng đang có khách thì đổi trạng thái bằng Trả phòng/Chuyển phòng.') : ''}
  ${field('Ghi chú', html`<textarea name="note" maxlength="300">${r?.note || ''}</textarea>`)}<div class="err-inline"></div><button class="btn primary block" type="submit">Lưu</button></form>`;
acts['add-room'] = () => openModal('Thêm phòng', roomForm(null));
acts['edit-room'] = (el) => openModal('Sửa thông tin phòng', roomForm(room(el.dataset.id)));
forms.room = async (f, fd) => {
  const id = f.dataset.id; const body = { name: fd.get('name'), note: fd.get('note') }; if (id) body.status = fd.get('status');
  await save(id ? 'PUT' : 'POST', id ? `rooms/${id}` : 'rooms', body); closeModal(); rerender();
};

// ---- thêm khách ----
const occBlock = () => html`<div class="occ"><div class="row"><b class="sp">Người ở cùng</b><button type="button" class="btn sm danger" data-act="del-occ">Xóa</button></div>
  <div class="two">${field('Họ tên *', html`<input name="o_name" required>`)}${field('Ngày sinh *', html`<input type="date" name="o_dob" max="${todayLocal()}" required>`)}</div>
  <div class="radios" role="radiogroup"><span>Giới tính:</span>${['male', 'female', 'other'].map((g, i) => html`<label><input type="radio" name="o_gender_${Math.random().toString(36).slice(2, 7)}" value="${g}" ${i === 0 ? raw('checked') : ''}>${GENDER[g]}</label>`)}</div>
  <div class="two">${field('Số điện thoại', html`<input name="o_phone" inputmode="tel">`)}${field('Số CCCD', html`<input name="o_cccd" inputmode="numeric">`)}</div>${field('Ghi chú', html`<input name="o_note">`)}</div>`;
acts['add-occ'] = () => { const c = $('#occs'); const d = document.createElement('div'); d.innerHTML = occBlock().s; c.append(d.firstElementChild); };
acts['del-occ'] = (el) => el.closest('.occ').remove();
export const personFields = (t = {}) => html`
  ${field('Họ và tên *', html`<input name="fullName" required value="${t.fullName || ''}" autocomplete="off">`)}
  <div class="two">${field('Ngày sinh (đầy đủ) *', html`<input type="date" name="dob" required max="${todayLocal()}" value="${t.dob || ''}">`)}${field('Số điện thoại *', html`<input name="phone" inputmode="tel" required value="${t.phone || ''}">`)}</div>
  <div class="radios" role="radiogroup" aria-label="Giới tính"><b>Giới tính *</b>${['male', 'female', 'other'].map((g) => html`<label><input type="radio" name="gender" value="${g}" required ${t.gender === g ? raw('checked') : ''}>${GENDER[g]}</label>`)}</div>
  <div class="two">${field('Số CCCD *', html`<input name="cccd" inputmode="numeric" required value="${t.cccd || ''}">`)}${field('Ngày cấp *', html`<input type="date" name="cccdIssueDate" required max="${todayLocal()}" value="${t.cccdIssueDate || ''}">`)}</div>
  ${field('Nơi cấp *', html`<input name="cccdIssuePlace" required value="${t.cccdIssuePlace || ''}">`)}${field('Địa chỉ thường trú *', html`<input name="address" required value="${t.address || ''}">`)}`;
export function collectPerson(fd) { return { fullName: fd.get('fullName'), dob: fd.get('dob'), gender: fd.get('gender'), phone: fd.get('phone'), cccd: fd.get('cccd'), cccdIssueDate: fd.get('cccdIssueDate'), cccdIssuePlace: fd.get('cccdIssuePlace'), address: fd.get('address') }; }
export function collectOccupants(f) {
  return [...f.querySelectorAll('.occ')].map((b) => ({ fullName: b.querySelector('[name=o_name]').value, dob: b.querySelector('[name=o_dob]').value, gender: b.querySelector('input[type=radio]:checked')?.value, phone: b.querySelector('[name=o_phone]').value, cccd: b.querySelector('[name=o_cccd]').value, note: b.querySelector('[name=o_note]').value }));
}
acts.movein = (el) => {
  const rm = room(el.dataset.id); resetImages();
  openModal(`Thêm khách thuê – ${rm.name}`, html`<form data-form="movein" data-room="${rm.id}" data-live="movein">
    <fieldset><legend>Thông tin khách thuê</legend>${personFields()}</fieldset>
    <fieldset><legend>Thuê phòng</legend>${field('Ngày bắt đầu vào ở *', html`<input type="date" name="startDate" required value="${todayLocal()}">`, 'Ngày thu tiền hằng tháng tính theo ngày này.')}
      <div class="radios" role="radiogroup"><label><input type="radio" name="mode" value="new" checked>Khách mới vào</label><label><input type="radio" name="mode" value="existing">Khách đã ở sẵn (nhập vào hệ thống)</label></div>
      <div class="warn-box" id="modehelp">Khách mới: thu đủ tiền phòng kỳ đầu. Nếu khách trả phòng trước hết kỳ, tiền chưa dùng sẽ được hoàn lại khi quyết toán.</div>
      <div id="existbox" hidden>${field('Nợ cũ còn lại (đ)', html`<input name="openingDebt" inputmode="numeric" value="0">`)}<label class="radios"><input type="checkbox" name="paidAlready">Kỳ hiện tại khách đã đóng đủ</label></div>
      <div class="two">${field('Giá thuê phòng / tháng (đ) *', html`<input name="rent" inputmode="numeric" required>`)}${field('Số người ở', html`<input name="headcount" inputmode="numeric" value="1">`)}</div>
      <div class="two">${field('Giá điện (đ/số) *', html`<input name="elecPrice" inputmode="numeric" required>`)}${field('Giá nước (đ/khối) *', html`<input name="waterPrice" inputmode="numeric" required>`)}</div>
      <div class="two">${field('Chỉ số điện ban đầu *', html`<input name="initElec" inputmode="decimal" required>`)}${field('Chỉ số nước ban đầu *', html`<input name="initWater" inputmode="decimal" required>`)}</div>
      ${field('Ghi chú', html`<textarea name="note" maxlength="300"></textarea>`)}</fieldset>
    <fieldset><legend>Người ở cùng (không tính thêm tiền)</legend><div id="occs"></div><button type="button" class="btn sm" data-act="add-occ" style="margin-bottom:12px">+ Thêm người ở cùng</button></fieldset>
    <fieldset><legend>Ảnh CCCD (bắt buộc 2 mặt)</legend>${idBox('front')}${idBox('back')}</fieldset>
    <div class="err-inline"></div><button class="btn primary block" type="submit">LƯU KHÁCH THUÊ</button></form>`, { wide: true });
};
live.movein = (f) => { const ex = f.mode.value === 'existing'; $('#existbox').hidden = !ex; $('#modehelp').textContent = ex ? 'Khách đã ở sẵn: hệ thống tạo hóa đơn mở đầu cho KỲ ĐANG CHẠY. Nhập chỉ số điện nước hiện tại trên đồng hồ tại đầu kỳ đó (từ lần ghi gần nhất). Các kỳ cũ không nhập lại.' : 'Khách mới: thu đủ tiền phòng kỳ đầu. Nếu khách trả phòng trước hết kỳ, tiền chưa dùng sẽ được hoàn lại khi quyết toán.'; };
forms.movein = async (f, fd) => {
  if (!getBlob('front') || !getBlob('back')) throw new Error('Phải chụp hoặc chọn đủ ảnh CCCD mặt trước và mặt sau.');
  const body = { roomId: f.dataset.room, tenant: collectPerson(fd), occupants: collectOccupants(f), startDate: fd.get('startDate'), mode: fd.get('mode'), openingDebt: toInt(fd.get('openingDebt')) || 0, paidAlready: fd.get('paidAlready') === 'on', rent: toInt(fd.get('rent')), elecPrice: toInt(fd.get('elecPrice')), waterPrice: toInt(fd.get('waterPrice')), initElec: toDec(fd.get('initElec')), initWater: toDec(fd.get('initWater')), headcount: toInt(fd.get('headcount')) || 1, note: fd.get('note') };
  const j = await save('POST', 'tenants', body, 'Đã lưu khách thuê. Đang tải ảnh CCCD…');
  const tid = j.result.tenant.id; let fail = false;
  for (const side of ['front', 'back']) { try { await uploadImage(tid, side); } catch (e) { fail = true; toast(`Chưa tải được ảnh ${side === 'front' ? 'mặt trước' : 'mặt sau'}: ${e.message}`, 'err'); } }
  resetImages(); closeModal(); if (!fail) toast('Đã lưu khách và ảnh CCCD'); go(`#/room/${body.roomId}`); rerender();
};

// ---- ghi điện nước & lập hóa đơn ----
acts.readings = (el) => {
  const r = D().rentals.find((x) => x.id === el.dataset.id), rd = DV().rentals[r.id], rm = room(r.roomId);
  if (!rd.canBill) { openModal('Chưa tới kỳ', html`<p>Kỳ tiếp theo (kỳ ${rd.nextPeriod + 1}) đến hạn <b>${dmy(rd.nextDue)}</b>. Chỉ ghi điện nước và lập hóa đơn trước hạn tối đa 7 ngày.</p>`); return; }
  openModal(`Ghi điện nước – ${rm.name} – kỳ ${rd.nextPeriod + 1}`, html`<form data-form="readings" data-rental="${r.id}" data-period="${rd.nextPeriod}" data-live="readings" data-be="${rd.baseElec}" data-bw="${rd.baseWater}" data-pe="${rd.price.elecPrice}" data-pw="${rd.price.waterPrice}" data-rent="${rd.price.rent}">
    <p class="muted" style="margin-top:0">Đến hạn <b>${dmy(rd.nextDue)}</b>. Tiền phòng kỳ mới thu trước; điện nước là số tiêu thụ của kỳ trước.</p>
    <div class="two keep">${field(`Chỉ số điện mới (cũ: ${rd.baseElec})`, html`<input name="elecNew" inputmode="decimal" required>`)}${field(`Chỉ số nước mới (cũ: ${rd.baseWater})`, html`<input name="waterNew" inputmode="decimal" required>`)}</div>
    <div class="calc" id="rcalc">Nhập chỉ số mới để xem số tiền.</div>
    <fieldset><legend>Khoản phát sinh (nếu có)</legend><div class="two">${field('Nội dung', html`<input name="x1l" maxlength="100">`)}${field('Số tiền (đ, âm = giảm trừ)', html`<input name="x1a" inputmode="numeric">`)}</div></fieldset>
    ${field('Ghi chú hóa đơn', html`<input name="note" maxlength="300">`)}<div class="err-inline"></div><button class="btn primary block" type="submit">LƯU CHỈ SỐ & LẬP HÓA ĐƠN</button></form>`);
};
live.readings = (f) => {
  const d = f.dataset, e = toDec(f.elecNew.value), w = toDec(f.waterNew.value); const box = $('#rcalc');
  if ((!Number.isNaN(e) && e < +d.be) || (!Number.isNaN(w) && w < +d.bw)) { box.className = 'warn-box'; box.textContent = '⚠ Chỉ số mới nhỏ hơn chỉ số cũ. Hãy kiểm tra lại đồng hồ – hệ thống sẽ không chấp nhận.'; return; }
  if (Number.isNaN(e) || Number.isNaN(w)) { box.className = 'calc'; box.textContent = 'Nhập chỉ số mới để xem số tiền.'; return; }
  const ea = Math.round((e - d.be) * d.pe), wa = Math.round((w - d.bw) * d.pw); box.className = 'calc';
  box.innerHTML = html`Điện: <b>${num(e - d.be)}</b> số × ${num(d.pe)} = <b>${vnd(ea)}</b><br>Nước: <b>${num(w - d.bw)}</b> khối × ${num(d.pw)} = <b>${vnd(wa)}</b><br>Tiền phòng kỳ mới: ${vnd(d.rent)}<br><i class="muted small">Ước tính; nợ cũ và đơn giá chính xác được hệ thống chốt khi lưu.</i>`.s;
};
forms.readings = async (f, fd) => {
  const x = fd.get('x1l').trim(); const extras = x || fd.get('x1a') ? [{ label: x, amount: toInt(fd.get('x1a')) }] : [];
  const j = await save('POST', 'readings', { rentalId: f.dataset.rental, periodIndex: Number(f.dataset.period), elecNew: toDec(fd.get('elecNew')), waterNew: toDec(fd.get('waterNew')), extras, note: fd.get('note') }, 'Đã lập hóa đơn');
  closeModal(); go(`#/invoice/${j.result.id}`);
};

// ---- thanh toán ----
export function payDialog(invId) {
  const inv = D().invoices.find((i) => i.id === invId), x = invD(invId);
  openModal(`Thanh toán – ${inv.roomName}`, html`<form data-form="pay" data-inv="${invId}" data-rem="${x.remaining}"><dl class="kv" style="margin:0 0 12px"><dt>Tổng tiền phải thu</dt><dd class="big">${vnd(inv.total)}</dd><dt>Đã thanh toán trước đó</dt><dd>${vnd(x.paid)}</dd><dt>Còn phải thanh toán</dt><dd class="owe">${vnd(x.remaining)}</dd></dl>
    ${field('Số tiền khách thực tế trả (đ) *', html`<input name="amount" inputmode="numeric" required value="${x.remaining}">`)}<div class="row" style="margin:-4px 0 12px"><button type="button" class="btn sm" data-act="pay-full">Trả đủ</button></div>
    ${field('Ngày thanh toán', html`<input type="date" name="date" value="${todayLocal()}" max="${todayLocal()}" required>`)}${field('Ghi chú', html`<input name="note" maxlength="200">`)}<div class="err-inline"></div><button class="btn primary block" type="submit">XÁC NHẬN ĐÃ THU TIỀN</button></form>`);
}
acts.pay = (el) => payDialog(el.dataset.id);
acts['pay-full'] = () => { const f = $('form[data-form=pay]'); f.amount.value = f.dataset.rem; };
forms.pay = async (f, fd) => {
  const amount = toInt(fd.get('amount')); if (!(amount > 0)) throw new Error('Số tiền phải lớn hơn 0');
  if (amount > Number(f.dataset.rem)) throw new Error(`Số tiền vượt quá khoản còn phải thu (${vnd(f.dataset.rem)})`);
  await save('POST', 'payments', { invoiceId: f.dataset.inv, amount, date: fd.get('date'), note: fd.get('note') }, 'Đã ghi nhận thanh toán'); closeModal(); rerender();
};

// ---- đổi giá ----
acts.price = (el) => {
  const r = D().rentals.find((x) => x.id === el.dataset.id), p = DV().rentals[r.id].price;
  openModal(`Đổi giá – ${room(r.roomId).name}`, html`<form data-form="price" data-rental="${r.id}"><div class="calc">Giá cũ: thuê <b>${vnd(p.rent)}</b> · điện <b>${num(p.elecPrice)}</b> · nước <b>${num(p.waterPrice)}</b></div>
    <div class="two">${field('Giá thuê mới (đ)', html`<input name="rent" inputmode="numeric" required value="${p.rent}">`)}${field('Ngày bắt đầu áp dụng', html`<input type="date" name="effectiveFrom" required value="${DV().rentals[r.id].nextDue}">`, 'Mặc định: kỳ tới. Hóa đơn đã lập không đổi.')}</div>
    <div class="two">${field('Giá điện mới (đ/số)', html`<input name="elecPrice" inputmode="numeric" required value="${p.elecPrice}">`)}${field('Giá nước mới (đ/khối)', html`<input name="waterPrice" inputmode="numeric" required value="${p.waterPrice}">`)}</div>
    ${field('Lý do thay đổi', html`<input name="reason" maxlength="200">`)}<div class="err-inline"></div><button class="btn primary block" type="submit">LƯU GIÁ MỚI</button></form>`);
};
forms.price = async (f, fd) => { await save('POST', `rentals/${f.dataset.rental}/price`, { rent: toInt(fd.get('rent')), elecPrice: toInt(fd.get('elecPrice')), waterPrice: toInt(fd.get('waterPrice')), effectiveFrom: fd.get('effectiveFrom'), reason: fd.get('reason') }, 'Đã lưu giá mới'); closeModal(); rerender(); };

// ---- trả phòng (xem tính toán → xác nhận) ----
acts.checkout = (el) => {
  const r = D().rentals.find((x) => x.id === el.dataset.id), rd = DV().rentals[r.id];
  openModal(`Quyết toán trả phòng – ${room(r.roomId).name}`, html`<form data-form="checkout" data-rental="${r.id}"><div class="two">${field('Ngày trả phòng *', html`<input type="date" name="date" required value="${todayLocal()}" max="${todayLocal()}">`)}<div></div></div>
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
    <dt>Nợ còn lại của hóa đơn ${p.latestInvoiceCode}</dt><dd>${vnd(p.carry)}</dd>${p.adjustLines.map((l) => html`<dt>${l.label}</dt><dd>${vnd(l.amount)}</dd>`)}${p.extras.map((e) => html`<dt>${e.label}</dt><dd>${vnd(e.amount)}</dd>`)}</dl>
    <div class="calc">${p.billed ? 'Kỳ hiện tại ĐÃ lập hóa đơn: phần tiền phòng chưa sử dụng được trừ vào quyết toán (chỉ phần khách đã thanh toán mới được hoàn).' : 'Kỳ hiện tại CHƯA lập hóa đơn: tính tiền phòng theo số ngày ở.'}</div>${dir}
    <p class="muted small">Kiểm tra kỹ số ngày và chỉ số. Sau khi xác nhận: phòng chuyển sang Trống, lưu hóa đơn quyết toán và lịch sử thuê.</p>
    <div class="err-inline"></div><button class="btn primary block" data-act="checkout-confirm" data-body='${JSON.stringify(body)}'>XÁC NHẬN QUYẾT TOÁN & TRẢ PHÒNG</button>`);
};
acts['checkout-confirm'] = async (el) => {
  el.disabled = true; try { const j = await save('POST', 'checkout', JSON.parse(el.dataset.body), 'Đã quyết toán và trả phòng'); closeModal(); go(`#/invoice/${j.result.invoice.id}`); } finally { el.disabled = false; }
};
acts.refunded = async (el) => { await save('POST', `checkout/${el.dataset.id}/refunded`, {}, 'Đã ghi nhận hoàn tiền'); rerender(); };

// ---- chuyển phòng ----
acts.transfer = (el) => {
  const r = D().rentals.find((x) => x.id === el.dataset.id), rd = DV().rentals[r.id]; const empties = D().rooms.filter((x) => x.status === 'empty');
  if (!empties.length) { openModal('Chuyển phòng', html`<p>Không có phòng nào ở trạng thái Trống để chuyển tới.</p>`); return; }
  openModal(`Chuyển phòng từ ${room(r.roomId).name}`, html`<form data-form="transfer" data-rental="${r.id}"><div class="warn-box">Phòng cũ được chốt hóa đơn riêng (điện nước đến ngày chuyển + nợ còn lại). Tiền phòng kỳ hiện tại giữ nguyên cho phòng mới; chu kỳ thu tiền không đổi.</div>
    <div class="two">${field('Ngày chuyển *', html`<input type="date" name="date" required value="${todayLocal()}" max="${todayLocal()}">`)}${field('Phòng mới *', html`<select name="newRoomId" required>${empties.map((x) => html`<option value="${x.id}">${x.name}</option>`)}</select>`)}</div>
    <fieldset><legend>Phòng cũ – chỉ số cuối</legend><div class="two">${field(`Điện cuối (cũ: ${rd.baseElec})`, html`<input name="elecFinal" inputmode="decimal" required>`)}${field(`Nước cuối (cũ: ${rd.baseWater})`, html`<input name="waterFinal" inputmode="decimal" required>`)}</div></fieldset>
    <fieldset><legend>Phòng mới – chỉ số ban đầu</legend><div class="two">${field('Điện ban đầu', html`<input name="newInitElec" inputmode="decimal" required>`)}${field('Nước ban đầu', html`<input name="newInitWater" inputmode="decimal" required>`)}</div>
    <div class="two">${field('Giá thuê mới (đ) – từ kỳ sau', html`<input name="newRent" inputmode="numeric" value="${rd.price.rent}">`)}<div></div></div><div class="two">${field('Giá điện', html`<input name="newElecPrice" inputmode="numeric" value="${rd.price.elecPrice}">`)}${field('Giá nước', html`<input name="newWaterPrice" inputmode="numeric" value="${rd.price.waterPrice}">`)}</div></fieldset>
    <div class="err-inline"></div><button class="btn primary block" type="submit">XÁC NHẬN CHUYỂN PHÒNG</button></form>`);
};
forms.transfer = async (f, fd) => {
  const j = await save('POST', 'transfer', { rentalId: f.dataset.rental, date: fd.get('date'), newRoomId: fd.get('newRoomId'), elecFinal: toDec(fd.get('elecFinal')), waterFinal: toDec(fd.get('waterFinal')), newInitElec: toDec(fd.get('newInitElec')), newInitWater: toDec(fd.get('newInitWater')), newRent: toInt(fd.get('newRent')), newElecPrice: toInt(fd.get('newElecPrice')), newWaterPrice: toInt(fd.get('newWaterPrice')) }, 'Đã chuyển phòng');
  closeModal(); go(`#/room/${fd.get('newRoomId')}`);
};
