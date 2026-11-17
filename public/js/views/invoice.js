import { html, raw, vnd, num, dmy, field, openModal, closeModal, toInt, toDec, todayLocal, INV_STATUS, INV_COLOR, $ } from '../util.js';
import { D, DV, S, save, invD, latestInvOf, room } from '../api.js';
import { acts, forms, rerender, go } from '../ui.js';
import { payDialog } from './room.js';
import { billArticle } from './bill.js';
import { billModel, saveBill } from '../invoice-img.js';
import { icon } from '../icons.js';
import { toast } from '../util.js';

export function invoiceView(id) {
  const i = D().invoices.find((x) => x.id === id); if (!i) return html`<p>Không tìm thấy hóa đơn. <a href="#/dashboard">Về tổng quan</a></p>`;
  const x = invD(i.id); const isLatest = latestInvOf(i.chainId).id === i.id && !i.rolledOver;
  const pays = D().payments.filter((p) => p.invoiceId === i.id);
  const co = D().checkoutRecords.find((c) => c.invoiceId === i.id);
  const m = billModel(i, x, S.snap.settings?.bank, S.snap.settings?.bankQr);
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare;
  return html`<div class="row noprint" style="margin-bottom:12px"><a class="back" href="#/room/${i.roomId}">${icon('arrow-left', '1.15em')} ${i.roomName}</a><span class="sp"></span></div>
  ${billArticle(i, x, 'bill')}
  ${isLatest && x.remaining > 0 ? html`<div class="row noprint" style="justify-content:center;margin:14px 0 0"><button class="btn green big" data-act="pay" data-id="${i.id}">${icon('check', '1.2em')} Đã nhận tiền (còn ${vnd(x.remaining)})</button></div>` : ''}<div class="row noprint" style="justify-content:center;margin:14px 0"><button class="btn primary" data-act="bill-jpg">${raw(icon('photo', '1.15em'))} Tải hóa đơn (ảnh JPG)</button>${canShare ? html`<button class="btn" data-act="bill-share">Gửi Zalo / Chia sẻ</button>` : ''}<button class="btn" data-act="print">In</button>${isLatest && i.kind === 'periodic' ? html`<button class="btn" data-act="adjust" data-id="${i.id}">${icon('edit', '1.1em')} Sửa hóa đơn (nợ cũ, thu thêm…)</button>` : ''}</div>
  <p class="muted small noprint" style="text-align:center;margin:0 0 16px">Bấm "Tải hóa đơn" để lưu ảnh JPG vào điện thoại rồi gửi Zalo cho khách. Trên điện thoại, "Gửi Zalo / Chia sẻ" mở sẵn danh sách ứng dụng để chọn Zalo.</p>
  <section class="card noprint" style="max-width:640px;margin:0 auto">
    ${pays.length ? html`<h3>Lịch sử thanh toán</h3><div class="list" style="margin:8px 0 12px">${pays.map((p) => html`<div class="li"><span>${dmy(p.date)} ${p.note ? `· ${p.note}` : ''}${p.voided ? html` <span class="badge red">Đã hủy: ${p.voidReason}</span>` : ''}</span><span style="${p.voided ? 'text-decoration:line-through' : ''}">${vnd(p.amount)} ${isLatest && !p.voided ? html`<button class="btn sm" data-act="void-pay" data-id="${p.id}">Hủy</button>` : ''}</span></div>`)}</div>` : html`<p class="muted small" style="margin:0 0 8px">Chưa có giao dịch thanh toán.</p>`}
    ${adjustHistory(i)}
    <p class="small muted" style="margin:0">Mã hóa đơn: ${i.code} · lập ngày ${dmy(i.issuedDate)} · khách: ${i.tenantName}</p>
    ${co ? html`<p class="small muted">Quyết toán: ${co.days} ngày thực tế × ${vnd(co.rentPerDay)}/ngày = ${vnd(co.actualRent)}. ${co.refund ? `Hoàn tiền: ${co.refund.status === 'done' ? 'đã hoàn ' + dmy(co.refund.date) : 'CHƯA hoàn'}.` : ''}</p>` : ''}
    ${co?.refund?.status === 'pending' ? html`<button class="btn primary block" data-act="refunded" data-id="${co.id}">Xác nhận ĐÃ HOÀN ${vnd(co.refund.amount)} cho khách</button>` : ''}</section>`;
}
acts['bill-jpg'] = async (el) => { const i = currentInvoice(); el.disabled = true; try { const r = await saveBill(billModel(i, invD(i.id), S.snap.settings?.bank, S.snap.settings?.bankQr)); if (r === 'downloaded') toast('Đã tải ảnh hóa đơn (xem trong mục Tải xuống / Ảnh)'); } finally { el.disabled = false; } };
acts['bill-share'] = async (el) => { const i = currentInvoice(); el.disabled = true; try { await saveBill(billModel(i, invD(i.id), S.snap.settings?.bank, S.snap.settings?.bankQr), { share: true }); } finally { el.disabled = false; } };
const currentInvoice = () => D().invoices.find((x) => x.id === location.hash.split('/')[2]);
acts.print = () => window.print();
acts['void-pay'] = (el) => openModal('Hủy giao dịch thanh toán', html`<form data-form="void-pay" data-id="${el.dataset.id}"><p class="warn-box">Giao dịch không bị xóa, chỉ đánh dấu "Đã hủy" kèm lý do.</p>${field('Lý do hủy *', html`<input name="reason" required maxlength="200">`)}<div class="err-inline"></div><button class="btn danger block" type="submit">HỦY GIAO DỊCH</button></form>`);
forms['void-pay'] = async (f, fd) => { await save('POST', `payments/${f.dataset.id}/void`, { reason: fd.get('reason') }, 'Đã hủy giao dịch'); closeModal(); rerender(); };
// ---- SỬA HÓA ĐƠN: Nợ cũ (số tiền + ghi chú), Tiền thu thêm (mọi khoản + ghi chú), chỉ số điện nước, ghi chú hóa đơn. Mỗi lần sửa lưu lịch sử chi tiết. ----
const exRow = (e = {}) => html`<div class="adj-ex two keep">${field('Tiền thu thêm (đ)', html`<input name="exa" inputmode="numeric" value="${e.amount ? num(e.amount) : ''}" placeholder="0">`)}${field('Ghi chú tiền thu thêm (chữ đỏ)', html`<input name="exl" maxlength="100" value="${e.label && e.label !== 'Chi phí khác' ? e.label : ''}" placeholder="Sửa khóa, internet…">`)}</div>`;
acts.adjust = (el) => {
  const i = D().invoices.find((x) => x.id === el.dataset.id); if (!i) return;
  if (latestInvOf(i.chainId).id !== i.id || i.rolledOver || i.kind !== 'periodic') { openModal('Không sửa được hóa đơn này', html`<p>Chỉ sửa được <b>hóa đơn mới nhất</b> của khách (hóa đơn cũ đã chốt, số nợ đã chuyển sang hóa đơn sau). Hãy mở hóa đơn mới nhất của phòng để sửa.</p>`); return; }
  const auto = i.oldDebt || 0;
  openModal(`Sửa hóa đơn ${i.roomName} – ${i.code}`, html`<form data-form="adjust" data-id="${i.id}"><p class="warn-box">Mỗi lần sửa đều được <b>lưu lịch sử</b> (thời gian, lý do, số cũ → số mới) ở cuối trang hóa đơn.</p>
    <fieldset><legend>Nợ cũ</legend>${auto ? html`<p class="calc" style="margin:0 0 10px">Nợ tự chuyển từ tháng trước: <b>${vnd(auto)}</b> (tự tính theo tiền đã thu, không sửa tay được – muốn đổi thì sửa/hủy giao dịch thanh toán của tháng trước).</p>` : ''}
      <div class="two keep">${field(auto ? 'Nợ cũ nhập thêm (đ)' : 'Nợ cũ (đ)', html`<input name="manualDebt" inputmode="numeric" value="${i.manualDebt ? num(i.manualDebt) : ''}" placeholder="0">`, 'Để trống hoặc 0 = không có')}${field('Ghi chú nợ cũ (chữ đỏ)', html`<input name="manualDebtNote" maxlength="200" value="${i.manualDebtNote || ''}" placeholder="VD: Nợ tiền T9, T10, T11">`)}</div></fieldset>
    <fieldset><legend>Tiền thu thêm</legend><div id="adjex">${(i.extras.length ? i.extras : [{}]).map((e) => exRow(e))}</div>
      <button type="button" class="btn sm" data-act="adj-add-ex" style="margin-bottom:8px">${icon('plus', '1em')} Thêm khoản thu thêm</button><p class="muted small" style="margin:0 0 6px">Muốn bỏ một khoản thì xóa trắng ô số tiền.</p></fieldset>
    ${i.elec ? html`<fieldset><legend>Chỉ số điện nước</legend><div class="two keep">${field(`Chỉ số điện mới (cũ ${num(i.elec.old)})`, html`<input name="elecNew" inputmode="decimal" value="${i.elec.new}">`)}${field(`Chỉ số nước mới (cũ ${num(i.water.old)})`, html`<input name="waterNew" inputmode="decimal" value="${i.water.new}">`)}</div></fieldset>` : ''}
    ${field('Ghi chú hóa đơn', html`<input name="note" maxlength="300" value="${i.note || ''}">`)}
    ${field('Lý do sửa *', html`<input name="reason" required maxlength="200" placeholder="VD: Thêm ghi chú nợ cũ">`)}<div class="err-inline"></div><button class="btn primary block" type="submit">LƯU THAY ĐỔI</button></form>`);
};
acts['adj-add-ex'] = () => { const box = $('#adjex'); if (box) box.insertAdjacentHTML('beforeend', exRow().s); };
forms.adjust = async (f, fd) => {
  const amounts = fd.getAll('exa'), labels = fd.getAll('exl');
  const extras = amounts.map((a, k) => ({ amount: toInt(a) || 0, label: String(labels[k] || '').trim() || 'Chi phí khác' })).filter((e) => e.amount);
  const body = { reason: fd.get('reason'), extras, manualDebt: toInt(fd.get('manualDebt')) || 0, manualDebtNote: (fd.get('manualDebtNote') || '').trim(), note: (fd.get('note') || '').trim() };
  if (f.elecNew) { body.elecNew = toDec(fd.get('elecNew')); body.waterNew = toDec(fd.get('waterNew')); }
  await save('PUT', `invoices/${f.dataset.id}`, body, 'Đã lưu thay đổi hóa đơn'); closeModal(); rerender();
};
// Lịch sử sửa: từng thay đổi "cũ → mới"
const exText = (l) => (l && l.length ? l.map((e) => `${vnd(e.amount)}${e.label && e.label !== 'Chi phí khác' ? ` (${e.label})` : ''}`).join(' + ') : 'không có');
const q = (t) => (t ? `"${t}"` : '(trống)');
export function adjustChanges(a) {
  const b = a.before || {}, f = a.after || {}, out = [];
  if (b.elec?.new !== undefined && f.elec?.new !== undefined && b.elec.new !== f.elec.new) out.push(`Chỉ số điện: ${num(b.elec.new)} → ${num(f.elec.new)}`);
  if (b.water?.new !== undefined && f.water?.new !== undefined && b.water.new !== f.water.new) out.push(`Chỉ số nước: ${num(b.water.new)} → ${num(f.water.new)}`);
  if ('manualDebt' in b && 'manualDebt' in f && (b.manualDebt || 0) !== (f.manualDebt || 0)) out.push(`Nợ cũ: ${vnd(b.manualDebt || 0)} → ${vnd(f.manualDebt || 0)}`);
  if ('manualDebtNote' in b && 'manualDebtNote' in f && (b.manualDebtNote || '') !== (f.manualDebtNote || '')) out.push(`Ghi chú nợ cũ: ${q(b.manualDebtNote)} → ${q(f.manualDebtNote)}`);
  if (b.extras && f.extras && JSON.stringify(b.extras) !== JSON.stringify(f.extras)) out.push(`Tiền thu thêm: ${exText(b.extras)} → ${exText(f.extras)}`);
  if ('note' in b && 'note' in f && (b.note || '') !== (f.note || '')) out.push(`Ghi chú hóa đơn: ${q(b.note)} → ${q(f.note)}`);
  if (b.total !== undefined && f.total !== undefined && b.total !== f.total) out.push(`Tổng tiền: ${vnd(b.total)} → ${vnd(f.total)}`);
  return out;
}
const atVN = (iso) => { try { return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return iso.slice(0, 16).replace('T', ' '); } };
export const adjustHistory = (i) => (i.adjustments.length ? html`<h3>Lịch sử sửa hóa đơn</h3><div class="adj-hist">${[...i.adjustments].reverse().map((a) => html`<div class="ah"><div class="ah1"><b>${atVN(a.at)}</b> · ${a.reason}</div>${adjustChanges(a).map((c) => html`<div class="ah2">${c}</div>`)}</div>`)}</div>` : '');
