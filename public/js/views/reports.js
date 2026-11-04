import { html, vnd, dmy, field, toast, download, $, monthLabel, openModal } from '../util.js';
import { api, apiUrl, D, S, save, today } from '../api.js';

import { acts, forms, rerender } from '../ui.js';

let range = null; let last = null;
export function reportsView() {
  range = range || { from: `${today().slice(0, 4)}-01-01`, to: today() };
  const v = html`<div class="page-head"><h2>Báo cáo</h2></div>
    <form data-form="report" class="row noprint" style="align-items:end"><div style="flex:1;min-width:140px">${field('Từ ngày', html`<input type="date" name="from" value="${range.from}" required>`)}</div><div style="flex:1;min-width:140px">${field('Đến ngày', html`<input type="date" name="to" value="${range.to}" required>`)}</div><button class="btn primary" type="submit" style="margin-bottom:12px">Xem báo cáo</button></form>
    <div id="rep"><p class="boot">Đang tính…</p></div>`;
  v.after = loadReport; return v;
}
async function loadReport() {
  const box = $('#rep'); if (!box) return;
  try {
    const r = await api('GET', `reports?from=${range.from}&to=${range.to}`); last = r;
    const t = r.total;
    box.innerHTML = html`<div class="cards7"><div class="stat"><b>${vnd(t.rent)}</b><span>Tổng tiền thuê</span></div><div class="stat"><b>${vnd(t.elec)}</b><span>Tổng tiền điện</span></div><div class="stat"><b>${vnd(t.water)}</b><span>Tổng tiền nước</span></div><div class="stat"><b>${vnd(t.extras)}</b><span>Khoản phát sinh / điều chỉnh</span></div>
      <div class="stat"><b>${vnd(t.billed)}</b><span>Tổng tiền phải thu (không gồm nợ cũ chuyển kỳ)</span></div><div class="stat"><b>${vnd(t.collected)}</b><span>Tổng tiền đã thu</span></div><div class="stat ${r.debtNow ? 'red' : ''}"><b>${vnd(r.debtNow)}</b><span>Tổng công nợ hiện tại</span></div></div>
    <h2 class="sec">Theo tháng</h2><table class="tbl stack"><thead><tr><th>Tháng</th><th class="r">Tiền phòng</th><th class="r">Điện</th><th class="r">Nước</th><th class="r">Phát sinh</th><th class="r">Phải thu</th><th class="r">Đã thu</th></tr></thead><tbody>${r.months.map((m) => html`<tr><td data-l="Tháng">${monthLabel(m.ym)}</td><td data-l="Tiền phòng" class="r">${vnd(m.rent)}</td><td data-l="Điện" class="r">${vnd(m.elec)}</td><td data-l="Nước" class="r">${vnd(m.water)}</td><td data-l="Phát sinh" class="r">${vnd(m.extras + m.adjust)}</td><td data-l="Phải thu" class="r">${vnd(m.billed)}</td><td data-l="Đã thu" class="r">${vnd(m.collected)}</td></tr>`)}</tbody></table>
    <h2 class="sec">Theo phòng</h2><table class="tbl stack"><thead><tr><th>Phòng</th><th class="r">Phải thu</th><th class="r">Đã thu</th></tr></thead><tbody>${r.rooms.map((m) => html`<tr><td data-l="Phòng">${m.room}</td><td data-l="Phải thu" class="r">${vnd(m.billed)}</td><td data-l="Đã thu" class="r">${vnd(m.collected)}</td></tr>`)}</tbody></table>
    <p class="muted small">Báo cáo theo ngày đến hạn của hóa đơn; "Đã thu" theo ngày thực tế thanh toán. Không chứa ảnh/thông tin CCCD.</p>
    <div class="row noprint"><button class="btn" data-act="rep-csv">⬇ Xuất Excel (CSV)</button><button class="btn" data-act="rep-json">⬇ Xuất JSON</button><button class="btn" data-act="print">🖨 In báo cáo</button></div>`.s;
  } catch (e) { box.innerHTML = html`<div class="err-box">${e.message}</div>`.s; }
}
forms.report = async (f, fd) => { range = { from: fd.get('from'), to: fd.get('to') }; await loadReport(); };
const csvCell = (v) => `"${String(v).replace(/"/g, '""')}"`;
acts['rep-csv'] = () => {
  const rows = [['Tháng', 'Tiền phòng', 'Tiền điện', 'Tiền nước', 'Phát sinh', 'Phải thu', 'Đã thu'], ...last.months.map((m) => [m.ym, m.rent, m.elec, m.water, m.extras + m.adjust, m.billed, m.collected]), [], ['Phòng', 'Phải thu', 'Đã thu'], ...last.rooms.map((m) => [m.room, m.billed, m.collected])];
  download(`bao-cao-${last.from}-${last.to}.csv`, '\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
};
acts['rep-json'] = () => download(`bao-cao-${last.from}-${last.to}.json`, JSON.stringify(last, null, 1));

export function backupView() {
  const logs = D().activityLogs.slice(-40).reverse();
  return html`<div class="page-head"><h2>Sao lưu & khôi phục</h2></div>
    <section class="card"><h3>Sao lưu dữ liệu</h3><p class="muted">Tải toàn bộ dữ liệu (không gồm ảnh CCCD) về máy. Nên làm mỗi tháng và cất ở nơi khác (Google Drive, email…). Hệ thống cũng tự lưu bản sao mỗi tháng trong kho dữ liệu riêng tư trên GitHub.</p>
      <a class="btn primary" href="${apiUrl('backup/export')}" download>⬇ Tải database.json</a></section>
    <section class="card" style="margin-top:12px"><h3>Khôi phục từ file JSON</h3><p class="warn-box">⚠ Khôi phục sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại. Hệ thống tự lưu một bản an toàn của dữ liệu hiện tại trước khi ghi đè.</p>
      <form data-form="restore"><input type="file" name="file" accept="application/json,.json" required style="margin-bottom:12px"><div id="rsum" class="calc" hidden></div>${field('Gõ chính xác: GHI DE để xác nhận', html`<input name="confirm" autocomplete="off" placeholder="GHI DE">`)}<div class="err-inline"></div><button class="btn danger" type="submit">KIỂM TRA & KHÔI PHỤC</button></form></section>
    ${cleanupCard()}
    <section class="card" style="margin-top:12px"><h3>Ảnh CCCD</h3><p class="muted">Ảnh nằm trong kho Vercel Blob riêng tư, không nằm trong file JSON. Tải từng ảnh ở trang hồ sơ khách (nút "Tải về") khi cần bản dự phòng.</p></section>
    <h2 class="sec">Nhật ký thao tác gần đây</h2><div class="list">${logs.map((l) => html`<div class="li"><span><b>${l.action}</b> <span class="muted">${l.detail}</span></span><span class="muted small">${l.at.slice(0, 16).replace('T', ' ')}</span></div>`)}</div>`;
}
forms.restore = async (f, fd) => {
  const file = fd.get('file'); if (!file || !file.size) throw new Error('Chưa chọn file');
  let db; try { db = JSON.parse(await file.text()); } catch { throw new Error('File không phải JSON hợp lệ'); }
  if (db.schemaVersion !== 1 || !Array.isArray(db.rooms) || !Array.isArray(db.invoices)) throw new Error('File không đúng định dạng dữ liệu Nhà trọ 44');
  const s = $('#rsum'); s.hidden = false; s.textContent = `File có ${db.rooms.length} phòng, ${db.tenants.length} khách, ${db.invoices.length} hóa đơn, ${db.payments.length} giao dịch; lưu lúc ${db.updatedAt}.`;
  if (fd.get('confirm') !== 'GHI DE') throw new Error('Kiểm tra file xong. Gõ đúng "GHI DE" vào ô xác nhận rồi bấm lại để khôi phục.');
  if (!confirm('Chắc chắn GHI ĐÈ toàn bộ dữ liệu hiện tại bằng file này?')) return;
  await save('POST', 'backup/restore', { db, confirm: 'GHI DE' }, 'Đã khôi phục dữ liệu'); rerender();
};

const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;
function cleanupCard() {
  const st = S.snap.system.storage; const ok = st.eligible.filter((e) => !e.blocked); const hold = st.eligible.filter((e) => e.blocked);
  return html`<section class="card" style="margin-top:12px"><h3>Dung lượng & dọn dữ liệu cũ</h3>
    <p style="margin:6px 0">Ảnh CCCD: <b>${mb(st.usedBytes)}</b> / ${mb(st.limitBytes)} (<b class="${st.pct >= 90 ? 'owe' : ''}">${st.pct}%</b>) · ${st.imageCount} ảnh · dữ liệu JSON ~${(st.dbBytes / 1024).toFixed(0)} KB</p>
    <p class="muted small">Chỉ dọn khách <b>đã trả phòng từ ${dmy(st.cutoff)} trở về trước</b>. Khách đang thuê không bao giờ bị xóa. Sẽ xóa: ảnh CCCD, họ tên, ngày sinh, SĐT, CCCD, địa chỉ, người ở cùng. Giữ lại số tiền hóa đơn/thanh toán để báo cáo doanh thu không sai (tên hiện là "(Đã xóa hồ sơ)"). Không thể hoàn tác.</p>
    ${ok.length ? html`<div class="list">${ok.map((e) => html`<div class="li"><span><b>${e.name}</b> · ${e.room} · trả phòng ${dmy(e.lastEnd)}</span><span class="muted small">${mb(e.bytes)}</span></div>`)}</div>
      <button class="btn danger" style="margin-top:10px" data-act="cleanup-run">🗑 XÓA DỮ LIỆU ${ok.length} KHÁCH CŨ (giải phóng ${mb(ok.reduce((s, e) => s + e.bytes, 0))})</button>` : html`<div class="empty-state">Chưa có hồ sơ nào đủ điều kiện xóa.</div>`}
    ${hold.length ? html`<p class="muted small" style="margin-top:10px">Đang giữ lại vì chưa đủ điều kiện: ${hold.map((e) => `${e.name} (${e.blocked})`).join('; ')}.</p>` : ''}</section>`;
}
acts['cleanup-run'] = async (el) => {
  const st = S.snap.system.storage; const n = st.eligible.filter((e) => !e.blocked).length;
  if (!confirm(`Xóa vĩnh viễn dữ liệu cá nhân và ảnh CCCD của ${n} khách đã trả phòng quá 2 năm?\n\nHệ thống sẽ tải về một bản sao lưu trước khi xóa. Không thể hoàn tác.`)) return;
  const res = await api('GET', 'backup/export', undefined, { raw: true }); if (!res.ok) throw new Error('Không tải được bản sao lưu nên chưa xóa gì.');
  download(`truoc-khi-don-${today()}.json`, await res.text());
  el.disabled = true;
  try { const j = await save('POST', 'cleanup', { confirm: 'XOA' }, null); toast(`Đã xóa ${j.purged} hồ sơ, ${j.imagesDeleted} ảnh${j.imagesFailed ? ` (${j.imagesFailed} ảnh chưa xóa được, thử lại sau)` : ''}`); rerender(); } finally { el.disabled = false; }
};
