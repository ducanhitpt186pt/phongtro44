// Quản Lý Thu Chi: sổ thu – chi riêng của chủ nhà (không hiện ra trang ngoài, không tạo thông báo).
import { html, raw, vnd, dmy, field, toInt, openModal, closeModal, toast, todayLocal } from '../util.js';
import { D, DV, save } from '../api.js';
import { acts, forms, rerender } from '../ui.js';
import { icon } from '../icons.js';

let month = ''; let year = ''; let kindF = 'all';
const wd = (s) => ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][new Date(`${s}T00:00:00Z`).getUTCDay()];
const bal = (b) => html`<b class="${b < 0 ? 'owe' : 'okc'}">${b < 0 ? '−' : ''}${vnd(Math.abs(b))}</b>`;

export function ledgerView() {
  const st = DV().ledger; const t = todayLocal(); month = month || t.slice(0, 7); year = year || t.slice(0, 4);
  const years = [...new Set([...st.years.map((y) => y.key), t.slice(0, 4)])].sort().reverse();
  const entries = D().ledger.filter((e) => e.date.startsWith(month) && (kindF === 'all' || e.type === kindF)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const days = {}; for (const e of entries) (days[e.date] = days[e.date] || []).push(e);
  const dayStat = Object.fromEntries(st.days.map((d) => [d.key, d]));
  const mrow = (k) => st.months.find((m) => m.key === k) || { income: 0, expense: 0 };
  const mm = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`).map((k) => ({ key: k, ...mrow(k) }));
  const tot = (rows) => rows.reduce((a, r) => ({ income: a.income + r.income, expense: a.expense + r.expense }), { income: 0, expense: 0 });
  const row = (label, r, strong) => html`<div class="li" ${strong ? raw('style="font-weight:700"') : ''}><span style="flex:1.2">${label}</span><span style="flex:1;text-align:right" class="okc">${vnd(r.income)}</span><span style="flex:1;text-align:right" class="owe">${vnd(r.expense)}</span><span style="flex:1;text-align:right">${bal(r.income - r.expense)}</span></div>`;
  const head = (l) => html`<div class="li" style="font-weight:700"><span style="flex:1.2">${l}</span><span style="flex:1;text-align:right">Thu</span><span style="flex:1;text-align:right">Chi</span><span style="flex:1;text-align:right">Chênh lệch</span></div>`;
  const ys = tot(mm);
  return html`<main class="wrap"><div class="page-head"><h2>Quản Lý Thu Chi</h2><span class="sp"></span><button class="btn green sm" data-act="led-add" data-type="income">${icon('plus', '1.1em')} Thêm khoản Thu</button><button class="btn red sm" data-act="led-add" data-type="expense">${icon('plus', '1.1em')} Thêm khoản Chi</button></div>
    <p class="muted small" style="margin:0 0 10px">Sổ riêng của bạn – không hiện ở trang ngoài và không tạo thông báo.</p>
    <div class="cards7"><div class="stat"><b class="okc">${vnd(st.income)}</b><span>Tổng thu (tất cả)</span></div><div class="stat"><b class="owe">${vnd(st.expense)}</b><span>Tổng chi (tất cả)</span></div><div class="stat wide"><b>${bal(st.balance)}</b><span>Chênh lệch thu − chi</span></div></div>
    <h2 class="sec">Theo ngày</h2>
    <div class="row" style="gap:8px;margin-bottom:8px"><label class="fld" style="margin:0"><span>Tháng</span><input type="month" id="led-month" value="${month}" data-led="month"></label><label class="fld" style="margin:0"><span>Hiện</span><select data-led="kind">${[['all', 'Thu và chi'], ['income', 'Chỉ thu'], ['expense', 'Chỉ chi']].map(([k, l]) => html`<option value="${k}" ${kindF === k ? raw('selected') : ''}>${l}</option>`)}</select></label></div>
    <div class="list">${Object.keys(days).length ? Object.keys(days).map((d) => html`<section class="card"><div class="row"><b class="sp">${wd(d)}, ${dmy(d)}</b><span class="muted small">Thu ${vnd(dayStat[d].income)} · Chi ${vnd(dayStat[d].expense)} · ${bal(dayStat[d].income - dayStat[d].expense)}</span></div>
      ${days[d].map((e) => html`<div class="li" style="box-shadow:none;padding:8px 0"><span><span class="badge ${e.type === 'income' ? 'green' : 'red'}">${e.type === 'income' ? 'Thu' : 'Chi'}</span> <b>${vnd(e.amount)}</b>${e.category ? ` · ${e.category}` : ''}${e.note ? html`<br><span class="muted small">${e.note}</span>` : ''}</span><span class="row"><button class="btn sm" data-act="led-edit" data-id="${e.id}">${icon('edit', '1em')} Sửa</button><button class="btn danger sm" data-act="led-del" data-id="${e.id}">${icon('trash', '1em')} Xóa</button></span></div>`)}</section>`) : html`<div class="empty-state">Tháng này chưa có khoản thu chi nào.</div>`}</div>
    <h2 class="sec">Theo tháng – năm <select data-led="year" style="width:auto">${years.map((y) => html`<option ${y === year ? raw('selected') : ''}>${y}</option>`)}</select></h2>
    <div class="list">${head('Tháng')}${mm.map((m) => row(`Tháng ${Number(m.key.slice(5))}`, m))}${row(`Cả năm ${year}`, ys, true)}</div>
    <h2 class="sec">Theo năm</h2>
    <div class="list">${st.years.length ? html`${head('Năm')}${st.years.map((y) => row(`Năm ${y.key}`, y))}` : html`<div class="empty-state">Chưa có dữ liệu.</div>`}</div>
    <h2 class="sec">Xóa dữ liệu thu chi theo năm</h2>
    <section class="card"><p class="muted small" style="margin-top:0">Chọn năm rồi bấm Xóa. Toàn bộ khoản thu chi của năm đó sẽ mất (nên tải Excel ở mục Sao lưu trước).</p>
      <div class="row" style="gap:8px"><select id="led-delyear" style="width:auto">${st.years.length ? st.years.map((y) => html`<option value="${y.key}">Năm ${y.key} (${y.count} khoản)</option>`) : html`<option value="">Chưa có dữ liệu</option>`}</select><button class="btn danger" data-act="led-delyear" ${st.years.length ? '' : raw('disabled')}>${icon('trash', '1em')} Xóa</button></div></section></main>`;
}
document.addEventListener('change', (e) => {
  const el = e.target; if (!(el instanceof HTMLElement) || !el.dataset.led) return;
  if (el.dataset.led === 'month' && el.value) { month = el.value; rerender(); } else if (el.dataset.led === 'kind') { kindF = el.value; rerender(); } else if (el.dataset.led === 'year') { year = el.value; rerender(); }
});
const form = (e, type) => html`<form data-form="ledger" data-id="${e?.id || ''}"><div class="radios" role="radiogroup"><b>Loại</b><label><input type="radio" name="type" value="income" ${(e?.type || type) === 'income' ? raw('checked') : ''}>Thu</label><label><input type="radio" name="type" value="expense" ${(e?.type || type) === 'expense' ? raw('checked') : ''}>Chi</label></div>
  <div class="two">${field('Ngày *', html`<input type="date" name="date" value="${e?.date || todayLocal()}" required>`)}${field('Số tiền (đ) *', html`<input name="amount" inputmode="numeric" required value="${e?.amount || ''}">`)}</div>
  ${field('Danh mục', html`<input name="category" maxlength="60" list="led-cats" value="${e?.category || ''}" placeholder="Ví dụ: Tiền phòng, Sửa chữa, Điện nước">`)}<datalist id="led-cats">${[...new Set(D().ledger.map((x) => x.category).filter(Boolean))].map((c) => html`<option value="${c}">`)}</datalist>
  ${field('Ghi chú', html`<input name="note" maxlength="300" value="${e?.note || ''}">`)}<div class="err-inline"></div><button class="btn primary block" type="submit">${e ? 'LƯU THAY ĐỔI' : 'LƯU'}</button></form>`;
acts['led-add'] = (el) => openModal(el.dataset.type === 'income' ? 'Thêm khoản Thu' : 'Thêm khoản Chi', form(null, el.dataset.type));
acts['led-edit'] = (el) => openModal('Sửa khoản thu chi', form(D().ledger.find((x) => x.id === el.dataset.id)));
forms.ledger = async (f, fd) => {
  const id = f.dataset.id; const b = { type: fd.get('type'), date: fd.get('date'), amount: toInt(fd.get('amount')), category: fd.get('category'), note: fd.get('note') };
  if (id) await save('PUT', `ledger/${id}`, b, 'Đã lưu thay đổi'); else await save('POST', 'ledger', b, 'Đã thêm khoản thu chi');
  if (b.date) month = b.date.slice(0, 7); closeModal(); rerender();
};
acts['led-del'] = async (el) => { if (!confirm('Xóa khoản thu chi này?')) return; await save('DELETE', `ledger/${el.dataset.id}`, undefined, 'Đã xóa'); rerender(); };
acts['led-delyear'] = async () => {
  const y = document.getElementById('led-delyear')?.value; if (!y) return; const n = D().ledger.filter((e) => e.date.startsWith(y)).length;
  if (!confirm(`CẢNH BÁO: bạn sắp XÓA TOÀN BỘ ${n} khoản thu chi của năm ${y}.\n\nDữ liệu đã xóa không khôi phục được (trừ khi có file sao lưu).\n\nBấm OK để tiếp tục.`)) return;
  const typed = prompt(`Để xác nhận, hãy gõ lại đúng năm cần xóa: ${y}`); if (typed === null) return;
  if (typed.trim() !== y) { toast('Năm gõ lại không khớp – chưa xóa gì', 'err'); return; }
  await save('POST', 'ledger/delete-year', { year: y, confirm: typed.trim() }, `Đã xóa dữ liệu thu chi năm ${y}`); rerender();
};
