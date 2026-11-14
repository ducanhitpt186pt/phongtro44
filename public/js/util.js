const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => (s instanceof Raw ? s : new Raw(s));
const one = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(one).join('') : esc(v));
// Mẫu HTML tự động thoát ký tự đặc biệt (chống XSS). Dùng raw() hoặc kết quả html`` lồng nhau để chèn HTML.
export function html(strings, ...vals) { let o = ''; strings.forEach((s, i) => { o += s; if (i < vals.length) o += one(vals[i]); }); return new Raw(o); }
export const vnd = (n) => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')} đ`;
export const num = (n) => (Number(n) || 0).toLocaleString('vi-VN');
export const dmy = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
export const monthLabel = (ym) => `Tháng ${ym.slice(5, 7)}/${ym.slice(0, 4)}`;
export const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
export const weekday = (iso) => { const [y, m, d] = iso.split('-').map(Number); return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; };
export const GENDER = { male: 'Nam', female: 'Nữ', other: 'Khác' };
export const ROOM_STATUS = { occupied: 'Đang cho thuê', empty: 'Đang trống', repair: 'Đang sửa chữa', notready: 'Đang khóa' };
export const INV_STATUS = { paid: 'Đã thanh toán', partial: 'Đã thanh toán một phần', unpaid: 'Chưa thanh toán', overdue: 'Quá hạn', rolled: 'Đã chuyển nợ sang kỳ sau', refund: 'Cần hoàn tiền cho khách' };
export const INV_COLOR = { paid: 'green', partial: 'orange', unpaid: 'orange', overdue: 'red', rolled: 'gray', refund: 'blue' };

export const $ = (sel, root = document) => root.querySelector(sel);
export function toast(msg, kind = 'ok') {
  const el = $('#toast'); el.className = `show ${kind}`; el.textContent = msg;
  clearTimeout(toast.t); toast.t = setTimeout(() => (el.className = ''), kind === 'err' ? 7000 : 3000);
}
export function openModal(title, body, { wide = false } = {}) {
  $('#modal').innerHTML = html`<div class="overlay" data-act="modal-backdrop"><div class="dialog ${wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="dlg-head"><h2>${title}</h2><button class="x" data-act="modal-close" aria-label="Đóng">✕</button></div><div class="dlg-body">${body}</div></div></div>`.s;
  document.body.classList.add('noscroll'); const f = $('#modal input:not([type=hidden]):not([type=file]), #modal select'); if (f && matchMedia('(pointer:fine)').matches) f.focus();
}
export function closeModal() { $('#modal').innerHTML = ''; document.body.classList.remove('noscroll'); }
export const field = (label, input, hint = '') => html`<label class="fld"><span>${label}</span>${input}${hint ? html`<small>${hint}</small>` : ''}</label>`;
export const ISSUE_PLACE = 'CỤC TRƯỞNG CỤC CẢNH SÁT QUẢN LÝ HÀNH CHÍNH VỀ TRẬT TỰ XÃ HỘI';
// Ô "Nơi cấp" có gợi ý: gõ để chọn trong danh sách, hoặc bấm nút bên dưới để điền nhanh
export const issueField = (name, value = '', label = 'Nơi cấp *', required = true) => field(label, html`<input name="${name}" ${required ? raw('required') : ''} list="issuePlaces" autocomplete="off" value="${value || ''}"><datalist id="issuePlaces"><option value="${ISSUE_PLACE}"></option></datalist><button type="button" class="chipbtn" data-act="fill-issue">✔ Chọn: ${ISSUE_PLACE}</button>`);
export const todayLocal = () => { const d = new Date(Date.now() + 7 * 3600e3); return d.toISOString().slice(0, 10); };
export function download(name, text, type = 'application/json') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
// Số tiền: cho phép gõ 1.200.000 hoặc 1200000 → số nguyên
export const toInt = (v) => { const s = String(v ?? '').replace(/[.,\s]/g, ''); return s === '' ? NaN : Number(s); };
export const toDec = (v) => { const s = String(v ?? '').trim().replace(',', '.'); return s === '' ? NaN : Number(s); };
