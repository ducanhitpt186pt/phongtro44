// Sao lưu lên Google Sheet (CHỈ THÊM DÒNG). Gửi qua một "Web app" Google Apps Script do chủ nhà tự tạo (xem docs/GOOGLE-SHEET.md).
// Mã Apps Script chỉ có thao tác thêm dòng, không có thao tác xóa/sửa.
import zlib from 'node:zlib';
import { nowISO } from './dates.js';
import { APP_VERSION } from './version.js';

export const TABS = {
  NhatKy: ['Ghi lúc', 'Thao tác', 'Chi tiết'],
  HoaDon: ['Ghi lúc', 'Mã HĐ', 'Phòng', 'Khách', 'Loại', 'Kỳ từ', 'Kỳ đến', 'Ngày đến hạn', 'Tiền phòng', 'Điện cũ', 'Điện mới', 'Số điện', 'Giá điện', 'Tiền điện', 'Nước cũ', 'Nước mới', 'Số nước', 'Giá nước', 'Tiền nước', 'Nợ cũ', 'Phí khác', 'Điều chỉnh', 'TỔNG', 'Đã chuyển nợ', 'Ghi chú'],
  ThanhToan: ['Ghi lúc', 'Ngày thu', 'Phòng', 'Mã HĐ', 'Số tiền', 'Ghi chú', 'Trạng thái', 'Lý do hủy'],
  Khach: ['Ghi lúc', 'Mã', 'Họ tên', 'Ngày sinh', 'Giới tính', 'Số điện thoại', 'CCCD', 'Ngày cấp', 'Nơi cấp', 'Địa chỉ', 'Ghi chú', 'Zalo'],
  NguoiOCung: ['Ghi lúc', 'Mã', 'Khách chính', 'Họ tên', 'Ngày sinh', 'Giới tính', 'Số điện thoại', 'CCCD', 'Ghi chú', 'Trạng thái', 'Địa chỉ', 'Zalo'],
  LuotThue: ['Ghi lúc', 'Phòng', 'Khách', 'Ngày vào', 'Ngày ra', 'Trạng thái'],
  DongHoTong: ['Ghi lúc', 'Ngày ghi', 'Điện tổng', 'Nước tổng', 'Ghi chú'],
  SuKien: ['Ghi lúc', 'Hành động', 'Tên sự kiện', 'Lịch', 'Ngày', 'Tháng', 'Năm', 'Lặp hằng năm', 'Ghi chú'],
  SaoLuuDayDu: ['Ghi lúc', 'Phiên bản', 'Phần', 'Tổng số phần', 'Dữ liệu (nén gzip + base64)'],
};
const url = () => process.env.GOOGLE_SHEET_WEBHOOK_URL || '';
const secret = () => process.env.GOOGLE_SHEET_SECRET || '';
export const configured = () => !!(url() && secret());
const status = { lastOkAt: null, lastError: null, lastAt: null, rowsSent: 0 };
export const getStatus = () => ({ configured: configured(), ...status });
export const includePersonal = (db) => db.meta?.sheetIncludePersonal !== false;

async function post(payload) {
  let res;
  try { res = await fetch(url(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ secret: secret(), ...payload }), redirect: 'follow', signal: AbortSignal.timeout(9000) }); }
  catch (e) { throw new Error(`Không kết nối được Google (${e.name === 'TimeoutError' ? 'quá thời gian chờ' : e.message}). Kiểm tra đường dẫn GOOGLE_SHEET_WEBHOOK_URL.`); }
  const text = await res.text(); let j; try { j = JSON.parse(text); } catch { throw new Error('Google không trả JSON: đường dẫn Web app sai, hoặc chưa đặt quyền truy cập "Bất kỳ ai" (Anyone).'); }
  if (!j.ok) throw new Error(j.error || 'Google Sheet báo lỗi'); return j;
}
const mark = (fn) => async (...a) => { status.lastAt = nowISO(); try { const r = await fn(...a); status.lastOkAt = status.lastAt; status.lastError = null; return r; } catch (e) { status.lastError = e.message; throw e; } };
export const ping = mark(() => post({ action: 'ping' }));
export const pushRows = mark(async (rows) => {
  const names = Object.keys(rows).filter((k) => rows[k].length); if (!names.length) return { appended: 0 }; let total = 0;
  for (const name of names) for (let i = 0; i < rows[name].length; i += 300) { const r = await post({ action: 'append', headers: { [name]: TABS[name] }, rows: { [name]: rows[name].slice(i, i + 300) } }); total += r.appended || 0; }
  status.rowsSent += total; return { appended: total };
});

const GENDER = { male: 'Nam', female: 'Nữ', other: 'Khác' };
const ymd = (s) => (s ? s.split('-').reverse().join('/') : '');
function rowOf(kind, r, db, at, personal) {
  const tn = (id) => db.tenants.find((t) => t.id === id)?.fullName || '';
  switch (kind) {
    case 'invoices': return ['HoaDon', [at, r.code, r.roomName, personal ? r.tenantName : '(ẩn)', r.kind === 'periodic' ? 'Định kỳ' : r.kind === 'checkout' ? 'Trả phòng' : 'Chuyển phòng', ymd(r.periodStart), ymd(r.periodEnd), ymd(r.dueDate), r.rent, r.elec?.old ?? '', r.elec?.new ?? '', r.elec?.usage ?? '', r.elec?.price ?? '', r.elec?.amount ?? '', r.water?.old ?? '', r.water?.new ?? '', r.water?.usage ?? '', r.water?.price ?? '', r.water?.amount ?? '', r.oldDebt, r.extrasTotal, r.adjustTotal || 0, r.total, r.rolledOver ? r.rolledOver.amount : '', r.note || '']];
    case 'payments': { const inv = db.invoices.find((i) => i.id === r.invoiceId); return ['ThanhToan', [at, ymd(r.date), inv?.roomName || '', inv?.code || '', r.amount, r.note || '', r.voided ? 'Đã hủy' : 'Hợp lệ', r.voidReason || '']]; }
    case 'tenants': return ['Khach', [at, r.id, r.fullName, personal ? ymd(r.dob) : '', personal ? GENDER[r.gender] || '' : '', personal ? r.phone : '', personal ? r.cccd : '', personal ? ymd(r.cccdIssueDate) : '', personal ? r.cccdIssuePlace : '', personal ? r.address : '', r.note || '', personal ? r.zalo || '' : '']];
    case 'occupants': return ['NguoiOCung', [at, r.id, tn(r.tenantId), r.fullName, personal ? ymd(r.dob) : '', personal ? GENDER[r.gender] || '' : '', personal ? r.phone : '', personal ? r.cccd || (r.noId ? '(chưa có CCCD)' : '') : '', r.note || '', r.__removed ? 'ĐÃ XÓA' : 'Có mặt', personal ? r.address || '' : '', personal ? r.zalo || '' : '']];
    case 'rentals': return ['LuotThue', [at, db.rooms.find((x) => x.id === r.roomId)?.name || '', tn(r.tenantId), ymd(r.startDate), ymd(r.endDate), { active: 'Đang thuê', ended: 'Đã trả phòng', transferred: 'Đã chuyển phòng' }[r.status] || r.status]];
    case 'masterReadings': return ['DongHoTong', [at, ymd(r.date), r.elec, r.water, r.note || '']];
    case 'events': return ['SuKien', [at, r.__removed ? 'Xóa' : r.__new ? 'Thêm' : 'Sửa', r.name, r.calendar === 'lunar' ? 'Âm lịch' : 'Dương lịch', r.day, r.month, r.year ?? '(mọi năm)', r.repeat ? 'Có' : 'Không', r.note || '']];
    case 'activityLogs': return ['NhatKy', [at, r.action, r.detail]];
    default: return null;
  }
}
const KINDS = ['invoices', 'payments', 'tenants', 'occupants', 'rentals', 'masterReadings', 'events', 'activityLogs'];
export const snapshotMap = (db) => { const m = {}; for (const k of KINDS) m[k] = new Map(db[k].map((r) => [r.id, JSON.stringify(r)])); return m; };
// Các dòng cần THÊM sau một lần lưu: bản ghi mới / đã đổi / (sự kiện, người ở cùng) đã xóa
export function diffRows(before, db, personal, at = nowISO()) {
  const rows = {}; const add = (x) => { if (x) (rows[x[0]] ||= []).push(x[1]); };
  for (const k of KINDS) {
    const b = before[k] || new Map(); const cur = new Set();
    for (const r of db[k]) { cur.add(r.id); const js = JSON.stringify(r); if (b.get(r.id) === js) continue; add(rowOf(k, k === 'events' ? { ...r, __new: !b.has(r.id) } : r, db, at, personal)); }
    if (k === 'events' || k === 'occupants') for (const [id, js] of b) if (!cur.has(id)) add(rowOf(k, { ...JSON.parse(js), __removed: true }, db, at, personal));
  }
  return rows;
}
export const allRows = (db, personal) => diffRows(Object.fromEntries(KINDS.map((k) => [k, new Map()])), { ...db, events: db.events.map((e) => ({ ...e })) }, personal);
export function redact(db) { const c = JSON.parse(JSON.stringify(db)); for (const t of c.tenants) Object.assign(t, { dob: '', phone: '', cccd: '', cccdIssueDate: '', cccdIssuePlace: '', address: '' }); for (const o of c.occupants) Object.assign(o, { dob: '', phone: '', cccd: '' }); return c; }
export function snapshotRows(db, at = nowISO()) {
  const packed = `gz:${zlib.gzipSync(Buffer.from(JSON.stringify(includePersonal(db) ? db : redact(db)), 'utf8')).toString('base64')}`; const parts = []; for (let i = 0; i < packed.length; i += 40000) parts.push(packed.slice(i, i + 40000));
  return { SaoLuuDayDu: parts.map((p, i) => [at, APP_VERSION, i + 1, parts.length, p]) };
}
// Gọi sau khi dữ liệu chính đã lưu thành công. KHÔNG BAO GIỜ làm hỏng việc lưu: mọi lỗi chỉ ghi vào trạng thái.
export async function afterWrite(before, db, needSnapshot) {
  if (!configured() || !before) return;
  try {
    const rows = diffRows(before, db, includePersonal(db)); await pushRows(rows);
    if (needSnapshot) await pushRows(snapshotRows(db));
  } catch { /* lỗi đã được ghi vào status */ }
}
