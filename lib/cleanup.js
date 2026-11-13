// Dọn dữ liệu cũ: khách đã trả phòng từ 2 năm trở lên. Khách đang thuê KHÔNG BAO GIỜ bị đụng tới.
// Xóa: ảnh CCCD (giải phóng dung lượng), họ tên, ngày sinh, SĐT, CCCD, địa chỉ, người ở cùng.
// Giữ: hóa đơn/thanh toán (chỉ số tiền) để báo cáo doanh thu không bị sai; tên trên hóa đơn thành "(Đã xóa hồ sơ)".
import { addMonthsClamp } from './dates.js';
import { activeRentalOfChain, latestInvoice, remainingOf, log } from './billing.js';
import { bad, notFound } from './errors.js';

export const RETENTION_MONTHS = 24;
export const PURGED_NAME = '(Đã xóa hồ sơ)';
export const cutoffDate = (today) => addMonthsClamp(today, -RETENTION_MONTHS);
const sz = (x) => ['front', 'back'].reduce((s, k) => s + (x.idImages?.[k]?.size || 0), 0);
const imgBytes = (t, db) => sz(t) + (db ? db.occupants.filter((o) => o.tenantId === t.id).reduce((s, o) => s + sz(o), 0) : 0);

export function storageInfo(db, today, limitMb = Number(process.env.STORAGE_LIMIT_MB) || 1024) {
  const cutoff = cutoffDate(today);
  const used = db.tenants.reduce((s, t) => s + sz(t), 0) + db.occupants.reduce((s, o) => s + sz(o), 0);
  const limit = limitMb * 1048576;
  const eligible = [];
  for (const t of db.tenants) {
    if (t.purgedAt) continue;
    const rs = db.rentals.filter((r) => r.tenantId === t.id);
    if (!rs.length || rs.some((r) => r.status === 'active')) continue;
    const lastEnd = rs.map((r) => r.endDate || '').sort().pop();
    if (!lastEnd || lastEnd > cutoff) continue;
    let blocked = null;
    for (const c of new Set(rs.map((r) => r.chainId))) {
      const inv = latestInvoice(db, c);
      if (inv && remainingOf(db, inv) > 0) blocked = 'Còn công nợ chưa thu';
      if (db.checkoutRecords.some((x) => x.chainId === c && x.refund?.status === 'pending')) blocked = 'Chưa xác nhận hoàn tiền cho khách';
    }
    const last = rs[rs.length - 1];
    eligible.push({ tenantId: t.id, name: t.fullName, room: db.rooms.find((r) => r.id === last.roomId)?.name || '', lastEnd, bytes: imgBytes(t, db), blocked });
  }
  return { usedBytes: used, limitBytes: limit, pct: limit ? Math.round((used / limit) * 1000) / 10 : 0, imageCount: [...db.tenants, ...db.occupants].reduce((s, t) => s + ['front', 'back'].filter((k) => t.idImages?.[k]).length, 0), cutoff, eligible, reclaimBytes: eligible.filter((e) => !e.blocked).reduce((s, e) => s + e.bytes, 0), dbBytes: JSON.stringify(db).length };
}

// Trả về danh sách pathname ảnh cần xóa khỏi kho Blob (sau khi dữ liệu đã ghi thành công).
// Xóa hồ sơ MỘT khách đã trả phòng (bất kể bao lâu): xóa thông tin cá nhân + ảnh; giữ số tiền để báo cáo không sai.
export function purgeOne(db, tenantId, today) {
  const t = db.tenants.find((x) => x.id === tenantId); if (!t) throw notFound('Không tìm thấy khách');
  const fail = (m) => { throw bad(m, 'CANNOT_DELETE'); };
  const rs = db.rentals.filter((r) => r.tenantId === t.id); if (!rs.length) fail('Khách chưa có lượt thuê nào');
  if (rs.some((r) => r.status === 'active')) fail('Khách đang thuê phòng – hãy Trả phòng trước khi xóa hồ sơ');
  for (const c of new Set(rs.map((r) => r.chainId))) { const inv = latestInvoice(db, c); if (inv && remainingOf(db, inv) > 0) fail('Khách còn công nợ chưa thu – thu đủ rồi mới xóa được'); if (db.checkoutRecords.some((x) => x.chainId === c && x.refund?.status === 'pending')) fail('Chưa xác nhận hoàn tiền cho khách – xác nhận rồi mới xóa được'); }
  const paths = []; const oldName = t.fullName;
  for (const k of ['front', 'back']) if (t.idImages?.[k]) paths.push(t.idImages[k].pathname);
  Object.assign(t, { fullName: PURGED_NAME, dob: '', gender: '', phone: '', zalo: '', cccd: '', cccdIssueDate: '', cccdIssuePlace: '', address: '', note: '', idImages: { front: null, back: null }, purgedAt: today });
  for (const o of db.occupants.filter((x) => x.tenantId === t.id)) for (const k of ['front', 'back']) if (o.idImages?.[k]) paths.push(o.idImages[k].pathname);
  db.occupants = db.occupants.filter((o) => o.tenantId !== t.id);
  for (const i of db.invoices) if (i.tenantId === t.id) i.tenantName = PURGED_NAME;
  for (const l of db.activityLogs) if (oldName && l.detail?.includes(oldName)) l.detail = l.detail.split(oldName).join(PURGED_NAME);
  log(db, 'Xóa hồ sơ khách', `${paths.length} ảnh đã xóa; số tiền trên hóa đơn được giữ để báo cáo`); return { paths };
}
export function purgeOld(db, today) {
  const info = storageInfo(db, today);
  const paths = []; let n = 0;
  for (const e of info.eligible) {
    if (e.blocked) continue;
    const t = db.tenants.find((x) => x.id === e.tenantId); const oldName = t.fullName;
    for (const k of ['front', 'back']) if (t.idImages?.[k]) paths.push(t.idImages[k].pathname);
    Object.assign(t, { fullName: PURGED_NAME, dob: '', gender: '', phone: '', zalo: '', cccd: '', cccdIssueDate: '', cccdIssuePlace: '', address: '', note: '', idImages: { front: null, back: null }, purgedAt: today });
    for (const o of db.occupants.filter((x) => x.tenantId === t.id)) for (const k of ['front', 'back']) if (o.idImages?.[k]) paths.push(o.idImages[k].pathname);
    db.occupants = db.occupants.filter((o) => o.tenantId !== t.id);
    for (const i of db.invoices) if (i.tenantId === t.id) i.tenantName = PURGED_NAME;
    for (const l of db.activityLogs) if (oldName && l.detail?.includes(oldName)) l.detail = l.detail.split(oldName).join(PURGED_NAME);
    n++;
  }
  if (n) log(db, 'Dọn dữ liệu cũ', `${n} hồ sơ khách trả phòng trước ${info.cutoff}, ${paths.length} ảnh`);
  return { count: n, paths };
}
