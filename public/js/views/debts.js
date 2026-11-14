// Nhắc Nợ: sổ nợ riêng, danh sách đơn vị nợ, trả nợ (một phần/hết), thống kê tháng – năm.
import { html, raw, vnd, dmy, field, toInt, openModal, closeModal, toast, todayLocal, $ } from '../util.js';
import { D, DV, save } from '../api.js';
import { acts, forms, rerender } from '../ui.js';
import { icon } from '../icons.js';

const paidOf = (d) => (d.payments || []).reduce((s, p) => s + p.amount, 0);
const remOf = (d) => Math.max(0, d.amount - paidOf(d));
const DAYS = (d, t) => Math.max(0, Math.round((Date.parse(`${t}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86400000));
const KL = { receivable: 'Cần Thu', payable: 'Cần Trả' }; const kindOf = (d) => (d.kind === 'payable' ? 'payable' : 'receivable');
const ym = (s) => `Tháng ${Number(s.slice(5))}/${s.slice(0, 4)}`;

// Thẻ thông báo nợ – dùng ở Tổng quan (có nút Trả nợ) và trang chủ công khai (chỉ xem)
export function debtNotices(items, { actions = false } = {}) {
  if (!items?.length) return html``;
  return html`<h2 class="sec">Nhắc nợ (${items.length})</h2><div class="notices" style="margin-top:0">${items.map((d) => html`<article class="note ${d.kind === 'payable' ? 'red' : 'orange'}"><h3>${String(d.name).toUpperCase()} <span class="badge ${d.kind === 'payable' ? 'red' : 'orange'}">${KL[d.kind || 'receivable']}</span></h3>
    <dl><dt>Ngày nợ</dt><dd>${dmy(d.date)} <span class="muted small">(${d.days} ngày)</span></dd><dt>Còn nợ</dt><dd><span class="money">${vnd(d.remaining)}</span></dd></dl>
    ${actions ? html`<div class="nact"><button class="btn green sm" data-act="debt-pay" data-id="${d.id}">${icon('check', '1.1em')} ${d.kind === 'payable' ? 'Trả nợ' : 'Thu nợ'}</button></div>` : ''}</article>`)}</div>`;
}
export function openDebtItems(today) {
  return D().debts.filter((d) => remOf(d) > 0).sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ id: d.id, kind: kindOf(d), name: d.name, date: d.date, remaining: remOf(d), days: DAYS(d.date, today) }));
}

let statTab = 'month'; let kindTab = 'receivable';
export function debtsView() {
  const st = kindTab === 'payable' ? DV().debts.payable : DV().debts; const t = todayLocal(); const mine = D().debts.filter((d) => kindOf(d) === kindTab); const open = mine.filter((d) => remOf(d) > 0).sort((a, b) => a.date.localeCompare(b.date)); const closed = mine.filter((d) => remOf(d) <= 0).sort((a, b) => b.date.localeCompare(a.date));
  const card = (d) => html`<section class="card"><div class="row"><b class="sp">${d.name}</b>${remOf(d) > 0 ? html`<span class="badge orange">Còn nợ ${vnd(remOf(d))}</span>` : html`<span class="badge green">Đã trả hết</span>`}</div>
    <dl class="kv"><dt>Ngày nợ</dt><dd>${dmy(d.date)}${remOf(d) > 0 ? html` <span class="muted small">(${DAYS(d.date, t)} ngày)</span>` : ''}</dd><dt>Số tiền nợ</dt><dd>${vnd(d.amount)}</dd><dt>Đã trả</dt><dd>${vnd(paidOf(d))}</dd><dt>Còn nợ</dt><dd class="${remOf(d) ? 'owe' : 'okc'}">${vnd(remOf(d))}</dd>${d.note ? html`<dt>Ghi chú</dt><dd class="pre">${d.note}</dd>` : ''}</dl>
    ${(d.payments || []).length ? html`<div class="muted small" style="margin:6px 0">${d.payments.map((p) => html`<div>• ${dmy(p.date)}: đã trả <b>${vnd(p.amount)}</b>${p.note ? html` · <span class="pre">${p.note}</span>` : ''} <button class="btn sm" data-act="debt-undo" data-id="${d.id}" data-pid="${p.id}">Hủy lần này</button></div>`)}</div>` : ''}
    <div class="row">${remOf(d) > 0 ? html`<button class="btn green sm" data-act="debt-pay" data-id="${d.id}">${icon('check', '1.1em')} Trả nợ</button>` : ''}<button class="btn sm" data-act="debt-edit" data-id="${d.id}">${icon('edit', '1em')} Sửa</button><button class="btn danger sm" data-act="debt-del" data-id="${d.id}">${icon('trash', '1em')} Xóa</button></div></section>`;
  const rows = statTab === 'year' ? st.years.map((y) => [`Năm ${y.year}`, y.lent, y.paid]) : st.months.map((m) => [ym(m.ym), m.lent, m.paid]);
  return html`<main class="wrap"><div class="page-head"><h2>Nhắc Nợ (Riêng)</h2><span class="sp"></span><button class="btn red sm" data-act="debt-add">${icon('plus', '1.1em')} Thêm khoản nợ</button><button class="btn sm" data-act="unit-list">${icon('users', '1.1em')} Danh sách đơn vị nợ (${D().debtUnits.length})</button></div>
    <div class="kindtiles">${['receivable', 'payable'].map((k) => { const s = k === 'payable' ? DV().debts.payable : DV().debts; return html`<button class="ktile ${k === 'payable' ? 'red' : 'green'} ${kindTab === k ? 'sel' : ''}" data-act="debt-kind" data-kind="${k}"><span>${KL[k]} (${s.openCount} khoản)</span><b>${vnd(s.remaining)}</b></button>`; })}</div>
    <h2 class="sec">${KL[kindTab]} – đang còn (${open.length})</h2><div class="list">${open.length ? open.map(card) : html`<div class="empty-state">Không có khoản nào đang chờ.</div>`}</div>
    <h2 class="sec">Thống kê theo đơn vị</h2><div class="list">${st.units.filter((u) => u.remaining > 0).length ? st.units.filter((u) => u.remaining > 0).map((u) => html`<div class="li"><span><b>${u.name}</b><br><span class="muted small">Tổng nợ ${vnd(u.lent)} · đã trả ${vnd(u.paid)}</span></span><b class="${u.remaining ? 'owe' : 'okc'}">Còn ${vnd(u.remaining)}</b></div>`) : html`<div class="empty-state">Chưa có dữ liệu.</div>`}</div>
    <h2 class="sec">Thống kê theo thời gian <span class="row" style="display:inline-flex;gap:6px"><button class="btn sm ${statTab === 'month' ? 'primary' : ''}" data-act="debt-tab" data-tab="month">Theo tháng</button><button class="btn sm ${statTab === 'year' ? 'primary' : ''}" data-act="debt-tab" data-tab="year">Theo năm</button></span></h2>
    <div class="list">${rows.length ? html`<div class="li" style="font-weight:700"><span style="flex:1">${statTab === 'year' ? 'Năm' : 'Tháng'}</span><span style="flex:1;text-align:right">Phát sinh</span><span style="flex:1;text-align:right">${kindTab === 'payable' ? 'Đã trả' : 'Đã thu'}</span></div>${rows.map(([l, a, p]) => html`<div class="li"><span style="flex:1">${l}</span><span style="flex:1;text-align:right">${vnd(a)}</span><span style="flex:1;text-align:right" class="okc">${vnd(p)}</span></div>`)}` : html`<div class="empty-state">Chưa có dữ liệu.</div>`}</div>
    <p class="muted small">"Phát sinh" tính theo ngày nợ; số đã thu/đã trả tính theo ngày ghi nhận.</p></main>`;
}
acts['debt-kind'] = (el) => { kindTab = el.dataset.kind; rerender(); };
acts['debt-tab'] = (el) => { statTab = el.dataset.tab; rerender(); };

const debtForm = (d) => {
  const units = D().debtUnits;
  const k = d ? kindOf(d) : kindTab;
  return html`<form data-form="debt" data-id="${d?.id || ''}"><div class="radios" role="radiogroup"><b>Loại</b>${['receivable', 'payable'].map((x) => html`<label><input type="radio" name="kind" value="${x}" ${k === x ? raw('checked') : ''}>${KL[x]} ${x === 'receivable' ? '(người khác nợ mình)' : '(mình nợ người khác)'}</label>`)}</div>
    ${units.length ? field('Chọn từ danh sách đơn vị nợ', html`<select name="unitId" data-pick="debt"><option value="">— Nhập tên tay —</option>${units.map((u) => html`<option value="${u.id}" ${d?.unitId === u.id ? raw('selected') : ''}>${u.name}${u.phone ? ` · ${u.phone}` : ''}</option>`)}</select>`) : ''}
    ${field('Tên người / đơn vị nợ *', html`<input name="name" required maxlength="100" value="${d?.name || ''}">`)}
    <div class="two">${field('Ngày nợ *', html`<input type="date" name="date" value="${d?.date || todayLocal()}" required>`)}${field('Số tiền nợ (đ) *', html`<input name="amount" inputmode="numeric" required value="${d?.amount || ''}">`)}</div>
    ${field('Ghi chú (có thể viết nhiều dòng)', html`<textarea name="note" rows="5" maxlength="2000">${d?.note || ''}</textarea>`)}<div class="err-inline"></div><button class="btn primary block" type="submit">${d ? 'LƯU KHOẢN NỢ' : 'THÊM KHOẢN NỢ'}</button></form>`;
};
acts['debt-add'] = () => openModal('Thêm khoản nợ', debtForm());
acts['debt-edit'] = (el) => openModal('Sửa khoản nợ', debtForm(D().debts.find((x) => x.id === el.dataset.id)));
// chọn đơn vị trong danh sách → điền tên
document.addEventListener('change', (e) => { const s = e.target; if (!(s instanceof HTMLSelectElement) || s.dataset.pick !== "debt") return; const u = D().debtUnits.find((x) => x.id === s.value); if (u) s.form.name.value = u.name; });
forms.debt = async (f, fd) => {
  const id = f.dataset.id; const body = { kind: fd.get('kind'), name: fd.get('name'), unitId: fd.get('unitId') || '', date: fd.get('date'), amount: toInt(fd.get('amount')), note: fd.get('note') };
  const u = D().debtUnits.find((x) => x.id === body.unitId); if (u && u.name !== body.name) body.unitId = ''; // đổi tên tay thì không gắn với đơn vị cũ
  if (id) await save('PUT', `debts/${id}`, body, 'Đã lưu khoản nợ'); else await save('POST', 'debts', body, 'Đã thêm khoản nợ');
  closeModal(); rerender();
};
acts['debt-del'] = async (el) => { if (!confirm('Xóa khoản nợ này (kể cả lịch sử đã trả)?')) return; await save('DELETE', `debts/${el.dataset.id}`, undefined, 'Đã xóa khoản nợ'); rerender(); };
acts['debt-undo'] = async (el) => { if (!confirm('Hủy lần trả nợ này? Số còn nợ sẽ tăng lại.')) return; await save('DELETE', `debts/${el.dataset.id}/pay/${el.dataset.pid}`, undefined, 'Đã hủy lần trả nợ'); rerender(); };

// ---- Trả nợ: trả hết hoặc nhập số tiền, phần còn lại tiếp tục được nhắc ----
acts['debt-pay'] = (el) => {
  const d = D().debts.find((x) => x.id === el.dataset.id); if (!d) return;
  const pay = kindOf(d) === 'payable'; openModal(pay ? 'Trả nợ (Cần Trả)' : 'Thu nợ (Cần Thu)', html`<div class="calc"><b>${d.name}</b> · nợ từ ${dmy(d.date)}<br>Số nợ ${vnd(d.amount)} · đã trả ${vnd(paidOf(d))} · <b>còn ${vnd(remOf(d))}</b></div>
    <form data-form="debt-pay" data-id="${d.id}" data-rem="${remOf(d)}"><div class="radios" role="radiogroup"><label><input type="radio" name="mode" value="all" checked>${pay ? 'Trả' : 'Thu'} hết ${vnd(remOf(d))}</label><label><input type="radio" name="mode" value="part">${pay ? 'Trả' : 'Thu'} một phần</label></div>
      <div class="two"><div class="pay-part" hidden>${field(pay ? 'Số tiền trả (đ)' : 'Số tiền thu (đ)', html`<input name="amount" inputmode="numeric">`, 'Phần còn lại vẫn được nhắc nợ tiếp')}</div>${field('Ngày ghi nhận', html`<input type="date" name="date" value="${todayLocal()}">`)}</div>
      ${field('Ghi chú', html`<textarea name="note" rows="3" maxlength="1000" placeholder="Ví dụ: còn lại hẹn trả cuối tháng"></textarea>`)}<div class="err-inline"></div><button class="btn green block" type="submit">XÁC NHẬN</button></form>`);
  $('#modal').querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => { $('#modal .pay-part').hidden = $('#modal input[name=mode]:checked').value !== 'part'; }));
};
forms['debt-pay'] = async (f, fd) => {
  const all = fd.get('mode') === 'all'; const amount = toInt(fd.get('amount'));
  if (!all && (!Number.isInteger(amount) || amount <= 0)) throw new Error('Hãy nhập số tiền trả');
  await save('POST', `debts/${f.dataset.id}/pay`, { all, amount: all ? undefined : amount, date: fd.get('date'), note: fd.get('note') }, all ? 'Đã trả hết khoản nợ' : 'Đã ghi nhận trả một phần – phần còn lại vẫn được nhắc'); closeModal(); rerender();
};

// ---- Danh sách đơn vị nợ ----
const unitsBody = (edit) => {
  const us = D().debtUnits; const e = edit && us.find((x) => x.id === edit);
  return html`<div class="list">${us.length ? us.map((u) => html`<div class="li"><span><b>${u.name}</b>${u.phone ? ` · ${u.phone}` : ''}${u.note ? html`<br><span class="muted small">${u.note}</span>` : ''}</span><span class="row"><button class="btn sm" data-act="unit-edit" data-id="${u.id}">Sửa</button><button class="btn danger sm" data-act="unit-del" data-id="${u.id}">Xóa</button></span></div>`) : html`<div class="empty-state" style="padding:14px">Chưa có đơn vị nào.</div>`}</div>
    <h3 style="margin:14px 0 6px">${e ? 'Sửa đơn vị' : 'Thêm đơn vị nợ'}</h3><form data-form="unit" data-id="${e?.id || ''}">${field('Tên *', html`<input name="name" required maxlength="100" value="${e?.name || ''}">`)}<div class="two">${field('Số điện thoại', html`<input name="phone" inputmode="tel" value="${e?.phone || ''}">`)}${field('Ghi chú', html`<input name="note" maxlength="300" value="${e?.note || ''}">`)}</div><div class="err-inline"></div><button class="btn primary block" type="submit">${e ? 'LƯU ĐƠN VỊ' : 'THÊM ĐƠN VỊ'}</button></form>`;
};
const showUnits = (edit) => openModal('Danh sách đơn vị nợ', unitsBody(edit), { wide: true });
acts['unit-list'] = () => showUnits();
acts['unit-edit'] = (el) => showUnits(el.dataset.id);
forms.unit = async (f, fd) => { const id = f.dataset.id; const b = { name: fd.get('name'), phone: fd.get('phone'), note: fd.get('note') }; if (id) await save('PUT', `debt-units/${id}`, b, 'Đã lưu đơn vị'); else await save('POST', 'debt-units', b, 'Đã thêm đơn vị'); showUnits(); rerender(); };
acts['unit-del'] = async (el) => { if (!confirm('Xóa đơn vị khỏi danh sách? Các khoản nợ cũ vẫn giữ nguyên tên.')) return; await save('DELETE', `debt-units/${el.dataset.id}`, undefined, 'Đã xóa đơn vị'); showUnits(); rerender(); };
