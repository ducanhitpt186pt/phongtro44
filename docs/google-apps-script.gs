/**
 * NHÀ TRỌ 44 – NHẬN BẢN SAO LƯU VÀO GOOGLE SHEET (CHỈ THÊM DÒNG, KHÔNG BAO GIỜ XÓA/SỬA DÒNG CŨ)
 * Cách dùng: xem docs/GOOGLE-SHEET.md
 * 1) Sửa SECRET bên dưới thành một chuỗi bí mật do bạn tự đặt (ví dụ 20 ký tự chữ + số).
 * 2) Chuỗi này phải GIỐNG HỆT biến GOOGLE_SHEET_SECRET trên Vercel.
 */
const SECRET = 'THAY-CHUOI-BI-MAT-CUA-BAN';
const MAX_CELL = 45000; // Google Sheet giới hạn 50.000 ký tự mỗi ô

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const d = JSON.parse(e.postData.contents);
    if (d.secret !== SECRET) return out_({ ok: false, error: 'Sai mã bí mật: SECRET trong Apps Script khác GOOGLE_SHEET_SECRET trên Vercel' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (d.action === 'ping') {
      return out_({ ok: true, sheet: ss.getName(), url: ss.getUrl(), tabs: ss.getSheets().map(function (s) { return [s.getName(), Math.max(0, s.getLastRow() - 1)]; }) });
    }
    if (d.action === 'append') {
      let n = 0;
      for (const name in d.rows) {
        const rows = d.rows[name]; if (!rows || !rows.length) continue;
        const sh = ss.getSheetByName(name) || ss.insertSheet(name);
        if (sh.getLastRow() === 0 && d.headers && d.headers[name]) {
          sh.appendRow(d.headers[name]); sh.getRange(1, 1, 1, d.headers[name].length).setFontWeight('bold'); sh.setFrozenRows(1);
        }
        const width = Math.max.apply(null, rows.map(function (r) { return r.length; }));
        const values = rows.map(function (r) { const row = r.slice(); while (row.length < width) row.push(''); return row.map(clean_); });
        sh.getRange(sh.getLastRow() + 1, 1, values.length, width).setValues(values);
        n += values.length;
      }
      return out_({ ok: true, appended: n });
    }
    return out_({ ok: false, error: 'Hành động không hợp lệ' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) { /* bỏ qua */ }
  }
}
function clean_(v) {
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  let s = String(v == null ? '' : v);
  if (s.length > MAX_CELL) s = s.slice(0, MAX_CELL);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // chặn công thức độc hại
  return s;
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
