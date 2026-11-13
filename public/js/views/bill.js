import { html, raw, vnd, INV_STATUS, INV_COLOR } from '../util.js';
import { S, invD } from '../api.js';
import { billModel } from '../invoice-img.js';

// Phần "tờ hóa đơn" dùng chung: trang Hóa đơn (id="bill") và bản xem nhanh trong hộp thoại Thanh toán (không đặt id)
export function billArticle(i, x = invD(i.id), id = null) {
  const m = billModel(i, x, S.snap.settings?.bank, S.snap.settings?.bankQr);
  return html`<article class="bill" ${id ? raw(`id="${id}"`) : ''}><h1>${m.title}</h1>
    <dl class="binfo">${m.info.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>
    ${m.meters.length ? html`<div class="bmeters">${m.meters.map((row) => html`<div class="bm">${row.map(([k, v]) => html`<span>${k}</span><b>${v}</b>`)}</div>`)}</div>` : ''}
    <div class="bcalc">${m.calc.map((r) => html`<div class="bl ${r.info ? 'info' : ''}"><div class="bl1"><span>${r.label}</span><b class="${r.amount < 0 ? 'neg' : ''}">${r.info ? `(${m.money(r.amount)})` : m.money(r.amount)}</b></div>${r.formula ? html`<div class="bf">${r.formula}</div>` : ''}</div>`)}</div>
    <div class="btotal"><span>${m.total.label}</span><b>${m.total.value}</b></div>
    ${m.pay || m.qr ? html`<div class="bbank ${m.qr ? 'hasqr' : ''}"><b>${m.pay ? 'THÔNG TIN CHUYỂN KHOẢN' : 'QUÉT MÃ QR ĐỂ CHUYỂN KHOẢN'}</b><div class="bbrow">${m.pay ? html`<dl>${m.pay.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>` : ''}${m.qr ? html`<img class="bqr" alt="QR chuyển khoản" src="${m.qr}">` : ''}</div></div>` : ''}
    ${m.foot.length ? html`<dl class="binfo" style="margin-top:12px">${m.foot.map(([k, v, red]) => html`<dt class="${red ? 'owe' : ''}">${k}</dt><dd class="${red ? 'owe' : ''}">${v}</dd>`)}</dl>` : ''}
    ${i.rolledOver ? html`<p class="bnote">Còn nợ ${vnd(i.rolledOver.amount)} đã chuyển sang hóa đơn kỳ sau.</p>` : ''}
    ${i.note ? html`<p class="bnote">Ghi chú: ${i.note}</p>` : ''}
    <div class="bstamp"><span class="stamp ${INV_COLOR[x.status]}">${INV_STATUS[x.status].toUpperCase()}</span></div></article>`;
}
