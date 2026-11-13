import { html, raw, vnd, num, dmy, field, openModal, closeModal, toInt, toDec, todayLocal, INV_STATUS, INV_COLOR } from '../util.js';
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
  return html`<div class="row noprint" style="margin-bottom:12px"><a class="back sp" href="#/room/${i.roomId}">← ${i.roomName}</a></div>
  ${billArticle(i, x, 'bill')}
  ${isLatest && x.remaining > 0 ? html`<div class="row noprint" style="justify-content:center;margin:14px 0 0"><button class="btn green big" data-act="pay" data-id="${i.id}">${icon('check', '1.2em')} Đã nhận tiền (còn ${vnd(x.remaining)})</button></div>` : ''}<div class="row noprint" style="justify-content:center;margin:14px 0"><button class="btn primary" data-act="bill-jpg">${raw(icon('photo', '1.15em'))} Tải hóa đơn (ảnh JPG)</button>${canShare ? html`<button class="btn" data-act="bill-share">Gửi Zalo / Chia sẻ</button>` : ''}<button class="btn" data-act="print">In</button>${isLatest && i.kind === 'periodic' ? html`<button class="btn" data-act="adjust" data-id="${i.id}">Điều chỉnh</button>` : ''}</div>
  <p class="muted small noprint" style="text-align:center;margin:0 0 16px">Bấm "Tải hóa đơn" để lưu ảnh JPG vào điện thoại rồi gửi Zalo cho khách. Trên điện thoại, "Gửi Zalo / Chia sẻ" mở sẵn danh sách ứng dụng để chọn Zalo.</p>
  <section class="card noprint" style="max-width:640px;margin:0 auto">
    ${pays.length ? html`<h3>Lịch sử thanh toán</h3><div class="list" style="margin:8px 0 12px">${pays.map((p) => html`<div class="li"><span>${dmy(p.date)} ${p.note ? `· ${p.note}` : ''}${p.voided ? html` <span class="badge red">Đã hủy: ${p.voidReason}</span>` : ''}</span><span style="${p.voided ? 'text-decoration:line-through' : ''}">${vnd(p.amount)} ${isLatest && !p.voided ? html`<button class="btn sm" data-act="void-pay" data-id="${p.id}">Hủy</button>` : ''}</span></div>`)}</div>` : html`<p class="muted small" style="margin:0 0 8px">Chưa có giao dịch thanh toán.</p>`}
    ${i.adjustments.length ? html`<h3>Lịch sử điều chỉnh</h3>${i.adjustments.map((a) => html`<p class="small muted">${a.at.slice(0, 16).replace('T', ' ')} · ${a.reason} · tổng ${vnd(a.before.total)} → ${vnd(a.after.total)}</p>`)}` : ''}
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
acts.adjust = (el) => {
  const i = D().invoices.find((x) => x.id === el.dataset.id); const e0 = i.extras[0];
  openModal(`Điều chỉnh ${i.code}`, html`<form data-form="adjust" data-id="${i.id}"><p class="warn-box">Chỉ điều chỉnh được hóa đơn mới nhất của khách. Mọi thay đổi được lưu lịch sử kèm lý do.</p>
    ${i.elec ? html`<div class="two">${field(`Chỉ số điện mới (cũ ${i.elec.old})`, html`<input name="elecNew" inputmode="decimal" value="${i.elec.new}">`)}${field(`Chỉ số nước mới (cũ ${i.water.old})`, html`<input name="waterNew" inputmode="decimal" value="${i.water.new}">`)}</div>` : ''}
    <div class="two">${field('Khoản phát sinh – nội dung', html`<input name="x1l" value="${e0?.label || ''}">`)}${field('Số tiền (đ)', html`<input name="x1a" inputmode="numeric" value="${e0?.amount || ''}">`)}</div>
    ${field('Lý do điều chỉnh *', html`<input name="reason" required maxlength="200">`)}<div class="err-inline"></div><button class="btn primary block" type="submit">LƯU ĐIỀU CHỈNH</button></form>`);
};
forms.adjust = async (f, fd) => {
  const x = fd.get('x1l').trim(); const body = { reason: fd.get('reason'), extras: x || fd.get('x1a') ? [{ label: x, amount: toInt(fd.get('x1a')) }] : [] };
  if (f.elecNew) { body.elecNew = toDec(fd.get('elecNew')); body.waterNew = toDec(fd.get('waterNew')); }
  await save('PUT', `invoices/${f.dataset.id}`, body, 'Đã điều chỉnh'); closeModal(); rerender();
};
