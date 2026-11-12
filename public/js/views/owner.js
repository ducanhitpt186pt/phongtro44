import { html, raw, vnd, num, dmy, field, todayLocal, toDec, toast, $ } from '../util.js';
import { D, DV, S, save } from '../api.js';
import { acts, forms, rerender } from '../ui.js';
import { icon } from '../icons.js';

const f1 = (n) => num(Math.round(n * 10) / 10);
export function ownerView() {
  const ms = D().masterReadings.slice().sort((a, b) => a.date.localeCompare(b.date)); const last = ms[ms.length - 1];
  const series = (DV().ownerSeries || []).slice().reverse(); const alerts = DV().usage.alerts.filter((a) => a.roomName === 'Chủ Nhà');
  return html`<a class="back" href="#/dashboard">← Tổng quan</a>
    <div class="page-head"><span class="rbadge blue">${raw(icon('home', '1.5em'))}</span><h2>Chủ Nhà – đồng hồ tổng</h2></div>
    <p class="muted" style="margin-top:0">Nhập chỉ số điện, nước trên <b>đồng hồ tổng</b> (nên ghi đều đặn, ví dụ mỗi tháng). Hệ thống lấy mức tăng của đồng hồ tổng trừ đi tổng điện nước các phòng cùng khoảng thời gian = <b>điện nước Chủ Nhà dùng</b>.</p>
    ${alerts.map((a) => html`<div class="warn-box" style="background:var(--red-bg);color:var(--red-t)">${raw(icon('alert'))} ${a.text}</div>`)}
    <section class="card"><form data-form="master"><div class="two">${field('Ngày ghi *', html`<input type="date" name="date" value="${todayLocal()}" max="${todayLocal()}" required>`)}<div></div></div>
      <div class="two">${field(`Chỉ số điện TỔNG${last ? ` (lần trước: ${num(last.elec)})` : ''} *`, html`<input name="elec" inputmode="decimal" required>`)}${field(`Chỉ số nước TỔNG${last ? ` (lần trước: ${num(last.water)})` : ''} *`, html`<input name="water" inputmode="decimal" required>`)}</div>
      ${field('Ghi chú', html`<input name="note" maxlength="200">`)}<div class="err-inline"></div><button class="btn primary block" type="submit">LƯU CHỈ SỐ ĐỒNG HỒ TỔNG</button></form></section>
    <section class="card" style="margin-bottom:16px"><h3>${raw(icon('money', '1.2em'))} Thông tin nhận tiền (hiện trên hóa đơn)</h3>
      <p class="muted small" style="margin:6px 0 10px">Nhập một lần, hệ thống tự in vào mọi hóa đơn có số tiền cần thu (cả ảnh JPG gửi Zalo). Chỉ hiện trên hóa đơn, không hiện ở trang ngoài.</p>
      ${(() => { const b = S.snap.settings?.bank || {}; return html`<form data-form="bank">${field('Tên ngân hàng *', html`<input name="bankName" required maxlength="80" value="${b.bankName || ''}" placeholder="Ví dụ: Vietcombank, MB Bank, Techcombank…">`)}${field('Số tài khoản *', html`<input name="accountNumber" inputmode="numeric" required value="${b.accountNumber || ''}" placeholder="Chỉ gồm chữ số">`)}${field('Tên chủ tài khoản *', html`<input name="accountName" required maxlength="80" value="${b.accountName || ''}" placeholder="Ví dụ: NGUYEN VAN A (không dấu, viết hoa)" autocapitalize="characters">`)}<div class="err-inline"></div><div class="row"><button class="btn primary sp" type="submit">LƯU THÔNG TIN NHẬN TIỀN</button>${b.bankName ? html`<button class="btn danger" type="button" data-act="bank-clear">Xóa</button>` : ''}</div></form>`; })()}</section>
    <h2 class="sec">Điện – nước Chủ Nhà dùng theo từng khoảng</h2>
    <div class="list">${series.length ? series.map((s) => html`<section class="card"><div class="row"><b class="sp">${dmy(s.from)} → ${dmy(s.to)} <span class="muted small">(${s.days} ngày)</span></b>${s.complete ? html`<span class="badge green">Đã chốt ${dmy(s.completedOn)}</span>` : html`<span class="badge orange">Đang chờ: ${s.waiting.map((w) => `${w.room}${w.expected ? ` (dự kiến ${dmy(w.expected)})` : ''}`).join(', ')} – số dưới đây chỉ là tạm tính</span>`}</div>
      <div class="ofm"><b>${raw(icon('bolt'))} Điện</b><div>Tổng cả dãy + nhà = mới − cũ = ${num(s.readTo.elec)} − ${num(s.readFrom.elec)} = <b>${f1(s.total.elec)} số</b></div><div>Tổng các phòng đã dùng = <b>${f1(s.rooms.elec)} số</b></div><div class="res">Chủ Nhà dùng = ${f1(s.total.elec)} − ${f1(s.rooms.elec)} = <b>${f1(s.owner.elec)} số</b></div></div>
      <div class="ofm"><b>${raw(icon('drop'))} Nước</b><div>Tổng cả dãy + nhà = mới − cũ = ${num(s.readTo.water)} − ${num(s.readFrom.water)} = <b>${f1(s.total.water)} khối</b></div><div>Tổng các phòng đã dùng = <b>${f1(s.rooms.water)} khối</b></div><div class="res">Chủ Nhà dùng = ${f1(s.total.water)} − ${f1(s.rooms.water)} = <b>${f1(s.owner.water)} khối</b></div></div></section>`) : html`<div class="empty-state">Cần ít nhất 2 lần ghi đồng hồ tổng để tính.</div>`}</div>
    <h2 class="sec">Lịch sử ghi đồng hồ tổng</h2>
    <div class="list">${ms.length ? ms.slice().reverse().map((m, i) => html`<div class="li"><span><b>${dmy(m.date)}</b> · điện ${num(m.elec)} · nước ${num(m.water)} ${m.note ? html`<span class="muted small">· ${m.note}</span>` : ''}</span>${i === 0 ? html`<button class="btn danger sm" data-act="master-del" data-id="${m.id}">Xóa (nhập nhầm)</button>` : ''}</div>`) : html`<div class="empty-state">Chưa có lần ghi nào.</div>`}</div>`;
}
forms.master = async (f, fd) => { await save('POST', 'master-readings', { date: fd.get('date'), elec: toDec(fd.get('elec')), water: toDec(fd.get('water')), note: fd.get('note') }, 'Đã lưu chỉ số đồng hồ tổng'); rerender(); };
acts['master-del'] = async (el) => { if (!confirm('Xóa lần ghi mới nhất này?')) return; await save('DELETE', `master-readings/${el.dataset.id}`, undefined, 'Đã xóa'); rerender(); };

forms.bank = async (f, fd) => { await save('PUT', 'settings', { bank: { bankName: fd.get('bankName'), accountNumber: fd.get('accountNumber'), accountName: fd.get('accountName') } }, 'Đã lưu thông tin nhận tiền – sẽ hiện trên hóa đơn'); rerender(); };
acts['bank-clear'] = async () => { if (!confirm('Xóa thông tin nhận tiền khỏi hóa đơn?')) return; await save('PUT', 'settings', { bank: { bankName: '', accountNumber: '', accountName: '' } }, 'Đã xóa'); rerender(); };
