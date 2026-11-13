import { html, raw, vnd, dmy, field, toast, download, $, monthLabel, openModal } from '../util.js';
import { api, apiUrl, D, S, save, today } from '../api.js';
import { icon } from '../icons.js';
import { GAS } from '../gas-code.js';

import { acts, forms, changes, rerender } from '../ui.js';

const HK = 'nt44_hidden_rows'; const hidden = () => { try { return new Set(JSON.parse(localStorage.getItem(HK) || '[]')); } catch { return new Set(); } }; const setHidden = (h) => { try { localStorage.setItem(HK, JSON.stringify([...h])); } catch { /* bỏ qua */ } };
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
    const h = hidden(); const vm = r.months.filter((m) => !h.has(`m:${m.ym}`)); const vr = r.rooms.filter((m) => !h.has(`r:${m.room}`)); const nHidden = r.months.length - vm.length + r.rooms.length - vr.length;
    const t = vm.reduce((a, m) => ({ rent: a.rent + m.rent, elec: a.elec + m.elec, water: a.water + m.water, extras: a.extras + m.extras + m.adjust, billed: a.billed + m.billed, collected: a.collected + m.collected }), { rent: 0, elec: 0, water: 0, extras: 0, billed: 0, collected: 0 });
    box.innerHTML = html`${nHidden ? html`<div class="warn-box">Đang ẩn <b>${nHidden}</b> dòng khỏi báo cáo này (chỉ ẩn trên màn hình, sổ sách không thay đổi). <button class="btn sm" data-act="show-rows">Hiện lại tất cả</button></div>` : ''}<div class="cards7"><div class="stat"><b>${vnd(t.rent)}</b><span>Tổng tiền thuê</span></div><div class="stat"><b>${vnd(t.elec)}</b><span>Tổng tiền điện</span></div><div class="stat"><b>${vnd(t.water)}</b><span>Tổng tiền nước</span></div><div class="stat"><b>${vnd(t.billed)}</b><span>Tổng tiền phải thu (không gồm nợ cũ chuyển kỳ)</span></div><div class="stat"><b>${vnd(t.collected)}</b><span>Tổng tiền đã thu</span></div><div class="stat debt"><b>${vnd(r.debtNow)}</b><span>Tổng công nợ hiện tại</span></div></div>
    <h2 class="sec">Theo tháng</h2><table class="tbl stack"><thead><tr><th>Tháng</th><th class="r">Tiền phòng</th><th class="r">Điện</th><th class="r">Nước</th><th class="r">Phải thu</th><th class="r">Đã thu</th><th></th></tr></thead><tbody>${vm.map((m) => html`<tr><td data-l="Tháng">${monthLabel(m.ym)}</td><td data-l="Tiền phòng" class="r">${vnd(m.rent)}</td><td data-l="Điện" class="r">${vnd(m.elec)}</td><td data-l="Nước" class="r">${vnd(m.water)}</td><td data-l="Phải thu" class="r">${vnd(m.billed)}</td><td data-l="Đã thu" class="r">${vnd(m.collected)}</td><td class="noprint"><button class="btn sm danger" data-act="hide-row" data-key="m:${m.ym}" title="Xóa dòng này khỏi báo cáo">${icon('trash', '1em')} Xóa dòng</button></td></tr>`)}</tbody></table>
    <h2 class="sec">Theo phòng</h2><table class="tbl stack"><thead><tr><th>Phòng</th><th class="r">Phải thu</th><th class="r">Đã thu</th><th></th></tr></thead><tbody>${vr.map((m) => html`<tr><td data-l="Phòng">${m.room}</td><td data-l="Phải thu" class="r">${vnd(m.billed)}</td><td data-l="Đã thu" class="r">${vnd(m.collected)}</td><td class="noprint"><button class="btn sm danger" data-act="hide-row" data-key="r:${m.room}" title="Xóa dòng này khỏi báo cáo">${icon('trash', '1em')} Xóa dòng</button></td></tr>`)}</tbody></table>
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
    ${sheetCard()}
    ${settingsCard()}
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

function settingsCard() {
  const on = S.snap.settings?.publicShowTenant !== false;
  return html`<section class="card" style="margin-top:12px"><h3>Hiển thị trên trang ngoài (chưa đăng nhập)</h3>
    <p class="muted small">Trang ngoài luôn hiện: số phòng, số tiền phải thu, ngày vào, số người, nợ. Tùy chọn dưới đây điều khiển việc hiện <b>họ tên khách</b> và <b>ghi chú của tháng</b>. Số điện thoại, CCCD, ngày sinh, địa chỉ, tên người ở cùng thì KHÔNG BAO GIỜ hiện. Ai biết địa chỉ web đều xem được trang ngoài.</p>
    <label class="radios"><input type="checkbox" data-change="set-public" ${on ? raw('checked') : ''}> Hiện họ tên khách và ghi chú trên trang ngoài</label>
    <label class="radios"><input type="checkbox" data-change="set-events" ${S.snap.settings?.publicShowEvents !== false ? raw('checked') : ''}> Hiện tên và ngày các sự kiện trên lịch ở trang ngoài (ghi chú sự kiện luôn ẩn)</label></section>`;
}
changes['set-public'] = async (el) => { await save('PUT', 'settings', { publicShowTenant: el.checked }, el.checked ? 'Trang ngoài sẽ hiện họ tên khách và ghi chú' : 'Trang ngoài đã ẩn họ tên khách và ghi chú'); rerender(); };

changes['set-events'] = async (el) => { await save('PUT', 'settings', { publicShowEvents: el.checked }, el.checked ? 'Trang ngoài sẽ hiện sự kiện' : 'Trang ngoài đã ẩn sự kiện'); rerender(); };
changes['set-personal'] = async (el) => { await save('PUT', 'settings', { sheetIncludePersonal: el.checked }, el.checked ? 'Sẽ gửi cả thông tin cá nhân khách vào Google Sheet' : 'Sẽ KHÔNG gửi SĐT/CCCD/địa chỉ vào Google Sheet'); rerender(); };
function sheetCard() {
  const sh = S.snap.sheets || {}; const personal = S.snap.settings?.sheetIncludePersonal !== false;
  const fm = (iso) => (iso ? new Date(iso).toLocaleString('vi-VN') : '');
  return html`<section class="card" style="margin-top:12px"><h3>${raw(icon('sheet', '1.2em'))} Sao lưu vào Google Sheet (chỉ thêm dòng, không xóa)</h3>
    <p class="muted small" style="margin:6px 0">Mỗi khi bạn lưu dữ liệu (hóa đơn, thanh toán, khách, sự kiện…), hệ thống tự THÊM dòng mới vào Google Sheet trong Gmail của bạn; mỗi ngày thêm 1 bản sao lưu đầy đủ. Không có thao tác xóa hay sửa dòng cũ.</p>
    ${sh.configured ? html`<div class="calc">${raw(icon('check'))} Đã cấu hình kết nối.${sh.lastOkAt ? ` Gửi thành công lúc ${fm(sh.lastOkAt)}.` : ' Chưa gửi lần nào kể từ khi máy chủ khởi động.'}${sh.lastError ? html`<br><b style="color:var(--red-t)">Lỗi gần nhất: ${sh.lastError}</b>` : ''}</div>
      <div class="row"><button class="btn sm" data-act="sheet-ping">Kiểm tra kết nối</button><button class="btn sm" data-act="sheet-test">Gửi dòng thử</button><button class="btn sm" data-act="sheet-snap">Sao lưu đầy đủ ngay</button><button class="btn sm" data-act="sheet-all">Gửi toàn bộ chi tiết (làm 1 lần)</button></div>
      <div id="sheetout" class="small" style="margin-top:10px"></div>
      <label class="radios"><input type="checkbox" data-change="set-personal" ${personal ? raw('checked') : ''}> Gửi cả thông tin cá nhân khách (SĐT, CCCD, ngày sinh, địa chỉ) vào Google Sheet</label>
      <p class="muted small" style="margin:0">Giữ Google Sheet ở chế độ riêng tư (đừng chia sẻ). Ảnh CCCD không được gửi vào Google Sheet.</p>`
    : html`<div class="warn-box">Chưa kết nối. Làm theo 4 bước ngay bên dưới (khoảng 10 phút).</div>`}
    <details class="gs-help" ${sh.configured ? '' : raw('open')}><summary>${sh.configured ? 'Xem lại hướng dẫn kết nối + mã Apps Script' : 'Hướng dẫn kết nối 4 bước + mã Apps Script (bấm để mở)'}</summary>
      <ol class="small" style="padding-left:20px;line-height:1.6">
        <li><b>Tạo mã bí mật:</b> bấm nút <b>Tạo mã bí mật</b> bên dưới (ghi lại mã này).</li>
        <li><b>Tạo Google Sheet:</b> vào <a href="https://sheets.google.com" target="_blank" rel="noopener">sheets.google.com</a> bằng Gmail của bạn → <b>Trống</b>. Menu <b>Tiện ích → Apps Script</b> → bấm vào khung code, <b>Ctrl+A</b>, <b>Delete</b>, rồi bấm <b>Sao chép mã Apps Script</b> bên dưới và <b>Ctrl+V</b> dán vào → bấm biểu tượng đĩa mềm <b>Lưu</b>.</li>
        <li><b>Triển khai:</b> nút xanh <b>Triển khai → Tùy chọn triển khai mới</b> → bánh răng ⚙ chọn <b>Ứng dụng web</b> → <b>Thực thi dưới dạng: Tôi</b>, <b>Quyền truy cập: Bất kỳ ai</b> → <b>Triển khai</b> → <b>Cấp quyền truy cập</b> (nếu Google cảnh báo: <b>Nâng cao → Đi tới … → Cho phép</b>) → <b>Sao chép URL ứng dụng web</b> (kết thúc bằng /exec).</li>
        <li><b>Khai báo trên Vercel:</b> Settings → Environment Variables → thêm <code>GOOGLE_SHEET_WEBHOOK_URL</code> = URL vừa sao chép và <code>GOOGLE_SHEET_SECRET</code> = mã bí mật ở bước 1 → Deployments → ⋯ → Redeploy. Quay lại đây bấm <b>Kiểm tra kết nối</b>.</li></ol>
      <div class="row" style="margin-bottom:8px"><button class="btn sm" data-act="gas-secret">Tạo mã bí mật</button><button class="btn sm primary" data-act="gas-copy">Sao chép mã Apps Script</button></div>
      <div class="fld"><span>Mã bí mật của bạn (dán vào biến GOOGLE_SHEET_SECRET trên Vercel)</span><div class="row"><input id="gssecret" readonly placeholder="Bấm &quot;Tạo mã bí mật&quot;" style="flex:1;min-width:200px"><button class="btn sm" data-act="gas-copy-secret">Sao chép mã bí mật</button></div></div>
      <textarea id="gscode" readonly rows="8" style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.78rem">${GAS}</textarea>
      <p class="muted small" style="margin:6px 0 0">Mã chỉ có thao tác THÊM dòng, không có lệnh xóa hay sửa. Chi tiết: docs/GOOGLE-SHEET.md</p></details></section>`;
}
async function sheetCall(el, path, label) {
  const out = $('#sheetout'); out.textContent = `${label}…`; el.disabled = true;
  try { const j = await api('POST', path, {}); out.innerHTML = html`<span style="color:var(--green-t)">${raw(icon('check'))} Thành công.</span>${j.sheet ? html` Google Sheet: <b>${j.sheet}</b>${j.url ? html` · <a href="${j.url}" target="_blank" rel="noopener">Mở Sheet</a>` : ''}` : ''}${j.rows !== undefined ? ` Đã thêm ${j.rows} dòng.` : ''}${j.tabs ? html`<br>Các tab: ${j.tabs.map(([n, c]) => `${n} (${c} dòng)`).join(' · ')}` : ''}`.s; }
  catch (e) { out.innerHTML = html`<span style="color:var(--red-t)">${raw(icon('alert'))} ${e.message}</span>`.s; } finally { el.disabled = false; }
}
acts['sheet-ping'] = (el) => sheetCall(el, 'sheets/ping', 'Đang kiểm tra');
acts['sheet-test'] = (el) => sheetCall(el, 'sheets/test', 'Đang gửi dòng thử');
acts['sheet-snap'] = (el) => sheetCall(el, 'sheets/snapshot', 'Đang gửi bản sao lưu đầy đủ');
acts['sheet-all'] = async (el) => { if (!confirm('Gửi TOÀN BỘ chi tiết hiện có (hóa đơn, thanh toán, khách…) vào Google Sheet? Chỉ nên làm 1 lần khi mới kết nối; làm lại sẽ thêm dòng trùng.')) return; await sheetCall(el, 'sheets/export-all', 'Đang gửi toàn bộ chi tiết'); };

const GAS_PLACEHOLDER = 'THAY-CHUOI-BI-MAT-CUA-BAN';
function gasText() { const sec = $('#gssecret')?.value; return sec ? GAS.replace(GAS_PLACEHOLDER, sec) : GAS; }
async function copyText(text, okMsg) { try { await navigator.clipboard.writeText(text); toast(okMsg); } catch { const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); try { document.execCommand('copy'); toast(okMsg); } catch { toast('Không sao chép tự động được, hãy chọn và sao chép bằng tay', 'err'); } t.remove(); } }
acts['gas-secret'] = () => { const al = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; const a = new Uint32Array(22); crypto.getRandomValues(a); const sec = 'nt44-' + [...a].map((x) => al[x % al.length]).join(''); $('#gssecret').value = sec; $('#gscode').value = gasText(); toast('Đã tạo mã bí mật và đưa vào đoạn mã Apps Script. Hãy sao chép mã Apps Script SAU bước này.'); };
acts['gas-copy'] = async () => { if (!$('#gssecret').value) { toast('Hãy bấm "Tạo mã bí mật" trước, để mã Apps Script có sẵn mã bí mật của bạn.', 'err'); return; } await copyText(gasText(), 'Đã sao chép mã Apps Script (đã kèm mã bí mật). Dán vào Apps Script.'); };
acts['gas-copy-secret'] = async () => { const v = $('#gssecret').value; if (!v) { toast('Chưa có mã bí mật', 'err'); return; } await copyText(v, 'Đã sao chép mã bí mật'); };

acts['hide-row'] = (el) => { if (!confirm('Xóa dòng này khỏi báo cáo? (Chỉ ẩn trên báo cáo; hóa đơn và tiền thu vẫn được giữ nguyên trong sổ sách. Có nút Hiện lại.)')) return; const h = hidden(); h.add(el.dataset.key); setHidden(h); loadReport(); };
acts['show-rows'] = () => { setHidden(new Set()); loadReport(); };
