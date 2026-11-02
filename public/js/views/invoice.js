import { html, raw, vnd, num, dmy, field, openModal, closeModal, toInt, toDec, todayLocal, INV_STATUS, INV_COLOR } from '../util.js';
import { D, DV, save, invD, latestInvOf, room } from '../api.js';
import { acts, forms, rerender, go } from '../ui.js';
import { payDialog } from './room.js';

export function invoiceView(id) {
  const i = D().invoices.find((x) => x.id === id); if (!i) return html`<p>Không tìm thấy hóa đơn. <a href="#/dashboard">Về tổng quan</a></p>`;
  const x = invD(i.id); const isLatest = latestInvOf(i.chainId).id === i.id && !i.rolledOver;
  const pays = D().payments.filter((p) => p.invoiceId === i.id);
  const co = D().checkoutRecords.find((c) => c.invoiceId === i.id);
  const title = { periodic: 'HÓA ĐƠN TIỀN PHÒNG', checkout: 'HÓA ĐƠN QUYẾT TOÁN TRẢ PHÒNG', transfer: 'HÓA ĐƠN CHỐT PHÒNG KHI CHUYỂN PHÒNG' }[i.kind];
  const meter = (m, unit) => (m ? html`<tr><td>${unit === 'điện' ? 'Tiền điện' : 'Tiền nước'}<br><span class="muted small">Chỉ số ${num(m.old)} → ${num(m.new)} = ${num(m.usage)} ${unit === 'điện' ? 'số' : 'khối'} × ${num(m.price)} đ</span></td><td class="r">${vnd(m.amount)}</td></tr>` : '');
  const v = html`<div class="row noprint" style="margin-bottom:12px"><a class="back sp" href="#/room/${i.roomId}">← ${i.roomName}</a><button class="btn sm" data-act="print">🖨 In</button>${isLatest && x.remaining > 0 ? html`<button class="btn sm warn" data-act="pay" data-id="${i.id}">Thanh toán</button>` : ''}${isLatest && i.kind === 'periodic' ? html`<button class="btn sm" data-act="adjust" data-id="${i.id}">Điều chỉnh</button>` : ''}</div>
  <article class="invoice"><h1>NHÀ TRỌ 44 LÊ VĂN PHẤN</h1><div class="sub">${title}</div>
    <dl class="meta"><dt>Mã hóa đơn</dt><dd>${i.code}</dd><dt>Phòng</dt><dd>${i.roomName}</dd><dt>Khách thuê</dt><dd>${i.tenantName}</dd><dt>Kỳ tính tiền</dt><dd>${dmy(i.periodStart)} – ${dmy(i.periodEnd)}${i.kind === 'periodic' ? ` (kỳ ${i.periodIndex + 1})` : ''}</dd><dt>Ngày lập hóa đơn</dt><dd>${dmy(i.issuedDate)}</dd><dt>Ngày đến hạn</dt><dd>${dmy(i.dueDate)}</dd></dl>
    <table><tbody>${i.rent ? html`<tr><td>Tiền thuê phòng</td><td class="r">${vnd(i.rent)}</td></tr>` : ''}${meter(i.elec, 'điện')}${meter(i.water, 'nước')}
    ${i.oldDebt ? html`<tr><td>Nợ cũ chuyển sang</td><td class="r">${vnd(i.oldDebt)}</td></tr>` : ''}${i.adjustLines.map((l) => html`<tr><td>${l.label}</td><td class="r">${vnd(l.amount)}</td></tr>`)}${i.extras.map((e) => html`<tr><td>${e.label}</td><td class="r">${vnd(e.amount)}</td></tr>`)}
    <tr class="tot"><td>${i.total < 0 ? 'SỐ TIỀN CHỦ NHÀ HOÀN LẠI KHÁCH' : 'TỔNG TIỀN PHẢI THU'}</td><td class="r">${vnd(Math.abs(i.total))}</td></tr>
    ${i.total > 0 ? html`<tr><td>Đã thanh toán</td><td class="r">${vnd(x.paid)}</td></tr><tr><td><b>Còn nợ</b></td><td class="r"><b class="${x.remaining ? 'owe' : ''}">${vnd(x.remaining)}</b></td></tr>` : ''}</tbody></table>
    ${i.rolledOver ? html`<p class="warn-box">Còn nợ ${vnd(i.rolledOver.amount)} đã được chuyển sang hóa đơn kỳ sau (${dmy(i.rolledOver.date)}).</p>` : ''}
    ${co ? html`<p class="muted small">Quyết toán: ${co.days} ngày thực tế × ${vnd(co.rentPerDay)}/ngày = ${vnd(co.actualRent)}. ${co.refund ? `Hoàn tiền: ${co.refund.status === 'done' ? 'đã hoàn ' + dmy(co.refund.date) : 'CHƯA hoàn'}.` : ''}</p>` : ''}
    ${i.note ? html`<p class="muted small">Ghi chú: ${i.note}</p>` : ''}
    <div style="text-align:center"><span class="stamp ${INV_COLOR[x.status]}">${INV_STATUS[x.status].toUpperCase()}</span></div>
    ${pays.length ? html`<h3 style="margin-top:14px">Lịch sử thanh toán</h3><table><tbody>${pays.map((p) => html`<tr><td>${dmy(p.date)} ${p.note ? `· ${p.note}` : ''}${p.voided ? html` <span class="badge red">Đã hủy: ${p.voidReason}</span>` : ''}</td><td class="r" style="${p.voided ? 'text-decoration:line-through' : ''}">${vnd(p.amount)} ${isLatest && !p.voided ? html`<button class="btn sm noprint" data-act="void-pay" data-id="${p.id}">Hủy</button>` : ''}</td></tr>`)}</tbody></table>` : ''}
    ${i.adjustments.length ? html`<h3 style="margin-top:14px">Lịch sử điều chỉnh</h3>${i.adjustments.map((a) => html`<p class="small muted">${a.at.slice(0, 16).replace('T', ' ')} · ${a.reason} · tổng ${vnd(a.before.total)} → ${vnd(a.after.total)}</p>`)}` : ''}
    ${co?.refund?.status === 'pending' ? html`<div class="noprint" style="margin-top:12px"><button class="btn primary block" data-act="refunded" data-id="${co.id}">Xác nhận ĐÃ HOÀN ${vnd(co.refund.amount)} cho khách</button></div>` : ''}
  </article>`;
  return v;
}
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
