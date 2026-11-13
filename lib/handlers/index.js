// Tất cả thao tác nghiệp vụ. Mỗi hàm ghi (mutation) chạy trong mutate() => đọc mới nhất, kiểm tra, ghi có SHA.
import { ApiError, bad, notFound } from '../errors.js';
import { todayVN, isValidISO, ymOf } from '../dates.js';
import { mutate, readDb, saveSafetyCopy, invalidateCache, getTokenExpiry, driverInfo, getDriverUsage } from '../store.js';
import { validateDb, migrateDb, ROOM_STATUS, SCHEMA_VERSION } from '../schema.js';
import { usageOverview, analyzeOwner } from '../usage.js';
import * as B from '../billing.js';
import { buildReminders, buildSummary, invoiceDerived, rentalDerived, monthsDerived, readingsDue } from '../reminders.js';
import { cleanPerson, cleanOccupant, cleanBank, num, str } from '../validate.js';
import { delPrivate, getPrivate, putPrivate } from '../blob.js';
import { readBody } from '../http.js';
import { purgeOld, purgeOne, storageInfo } from '../cleanup.js';
import { buildSystem } from '../health.js';
import { cleanEvent } from '../events.js';
import * as sheets from '../sheets.js';
const sheetsStatus = () => sheets.getStatus();

export function snapshot(db) {
  const today = todayVN();
  const reminders = buildReminders(db, today);
  return { today, db, settings: { publicShowTenant: db.meta?.publicShowTenant !== false, publicShowEvents: db.meta?.publicShowEvents !== false, sheetIncludePersonal: db.meta?.sheetIncludePersonal !== false, bank: db.meta?.bank || null, bankQr: db.meta?.bankQr ? { id: db.meta.bankQr.id, uploadedAt: db.meta.bankQr.uploadedAt } : null }, sheets: sheets.getStatus(), system: (() => { const storage = storageInfo(db, today); return { storage, ...buildSystem({ today, tokenExpires: getTokenExpiry(), storage, db: driverInfo(), usage: getDriverUsage(), sheets: sheetsStatus() }) }; })(), derived: { readings: readingsDue(db, today), months: monthsDerived(db, today), usage: usageOverview(db, today), ownerSeries: analyzeOwner(db, today).series, invoices: invoiceDerived(db, today), rentals: rentalDerived(db, today), reminders, summary: buildSummary(db, reminders) } };
}
const done = (db, extra = {}) => ({ ok: true, ...snapshot(db), ...extra });
async function run(message, fn) { const { db, result } = await mutate(fn); invalidateCache(); return done(db, { result }); }

// Số đồng hồ tổng phải LUÔN không nhỏ hơn số cũ đã lưu (ngày ghi nào cũng được, kể cả cùng ngày với lần trước)
function checkMasterOrder(db, exceptId, date, e, w) {
  const others = db.masterReadings.filter((x) => x.id !== exceptId).sort((a, c) => a.date.localeCompare(c.date) || String(a.createdAt).localeCompare(String(c.createdAt)));
  const prev = [...others].reverse().find((x) => x.date <= date), next = others.find((x) => x.date > date); const dm = (d) => d.split('-').reverse().join('/');
  if (prev && e < prev.elec) throw bad(`Số điện tổng mới (${e}) nhỏ hơn số cũ đã lưu (${prev.elec}, ngày ${dm(prev.date)}). Số mới phải lớn hơn hoặc bằng số cũ.`, 'METER_DECREASED');
  if (prev && w < prev.water) throw bad(`Số nước tổng mới (${w}) nhỏ hơn số cũ đã lưu (${prev.water}, ngày ${dm(prev.date)}). Số mới phải lớn hơn hoặc bằng số cũ.`, 'METER_DECREASED');
  if (next && (e > next.elec || w > next.water)) throw bad(`Số phải không lớn hơn lần ghi sau (${dm(next.date)}: điện ${next.elec}, nước ${next.water})`, 'METER_DECREASED');
}
export const H = {
  async data() { const { db } = await readDb(); return { ok: true, ...snapshot(db) }; },
  async list(name) { const { db } = await readDb(); return { ok: true, [name]: db[name] }; },

  rooms: {
    create: (b) => run('Thêm phòng', (db) => {
      const name = str(b.name, 60); if (!name) throw bad('Chưa nhập tên phòng');
      if (db.rooms.some((r) => r.name.toLowerCase() === name.toLowerCase())) throw bad('Tên phòng đã tồn tại');
      const room = { id: B.uid('room'), name, status: 'empty', note: str(b.note, 300), createdAt: new Date().toISOString() };
      db.rooms.push(room); B.log(db, 'Thêm phòng', name); return room;
    }),
    remove: (id) => run('Xóa phòng', (db) => {
      const room = B.getRoom(db, id); if (!room) throw notFound('Không tìm thấy phòng');
      if (room.kind === 'owner') throw bad('Không xóa được phòng Chủ Nhà (đồng hồ tổng)');
      if (db.rentals.some((r) => r.roomId === id) || db.invoices.some((i) => i.roomId === id) || db.readings.some((r) => r.roomId === id)) throw bad('Phòng này đã có lịch sử thuê/hóa đơn nên không xóa được (để giữ đúng sổ sách). Hãy đổi trạng thái sang "Đang sửa chữa hoặc đang sử dụng" để tạm ngưng.', 'HAS_HISTORY');
      db.rooms = db.rooms.filter((r) => r.id !== id); db.monthlyNotes = db.monthlyNotes.filter((n) => n.roomId !== id); B.log(db, 'Xóa phòng', room.name); return true;
    }),
    update: (id, b) => run('Sửa phòng', (db) => {
      const room = B.getRoom(db, id); if (!room) throw notFound('Không tìm thấy phòng');
      if (b.name !== undefined) { const n = str(b.name, 60); if (!n) throw bad('Tên phòng không được trống'); if (db.rooms.some((r) => r.id !== id && r.name.toLowerCase() === n.toLowerCase())) throw bad('Tên phòng đã tồn tại'); room.name = n; }
      if (b.note !== undefined) room.note = str(b.note, 300);
      if (b.status !== undefined) {
        if (!ROOM_STATUS.includes(b.status)) throw bad('Trạng thái không hợp lệ');
        const active = db.rentals.some((r) => r.roomId === id && r.status === 'active');
        if (active && b.status !== 'occupied') throw bad('Phòng đang có khách. Hãy trả phòng hoặc chuyển phòng trước.');
        if (!active && b.status === 'occupied') throw bad('Phòng chưa có khách. Hãy dùng "Thêm khách thuê".');
        room.status = b.status;
      }
      B.log(db, 'Sửa phòng', room.name); return room;
    }),
  },

  tenants: {
    moveIn: (b) => run('Thêm khách thuê', (db) => {
      const today = todayVN();
      const tenant = cleanPerson(b.tenant || {}, { full: true }, today);
      if (!isValidISO(b.startDate)) throw bad('Ngày bắt đầu vào ở không hợp lệ');
      const occupants = (b.occupants || []).map((o) => cleanOccupant(o, today));
      const r = B.moveIn(db, { ...b, tenant, occupants, note: str(b.note, 300) }, today);
      return { tenant: r.tenant, rental: r.rental, invoice: r.invoice, occupantIds: r.occupants.map((o) => o.id) };
    }),
    update: (id, b) => run('Sửa khách thuê', (db) => {
      const t = db.tenants.find((x) => x.id === id); if (!t) throw notFound('Không tìm thấy khách');
      const today = todayVN();
      if (b.tenant) Object.assign(t, cleanPerson(b.tenant, { full: true }, today));
      if (b.rentalId) {
        const r = B.getRental(db, b.rentalId); if (!r || r.tenantId !== id) throw notFound('Không tìm thấy lượt thuê');
        if (b.rentalNote !== undefined) r.note = str(b.rentalNote, 300);
      }
      B.log(db, 'Sửa khách thuê', t.fullName); return t;
    }),
  },

  occupants: {
    create: (b) => run('Thêm người ở cùng', (db) => {
      const t = db.tenants.find((x) => x.id === b.tenantId); if (!t || t.purgedAt) throw notFound('Không tìm thấy khách');
      if (!db.rentals.some((r) => r.tenantId === t.id && r.status === 'active')) throw bad('Khách này hiện không thuê phòng nào');
      const o = { id: B.uid('occ'), tenantId: t.id, ...cleanOccupant(b.occupant || {}, todayVN()), idImages: { front: null, back: null }, createdAt: new Date().toISOString() };
      db.occupants.push(o); B.log(db, 'Thêm người ở cùng', `${o.fullName} (cùng ${t.fullName})`); return o;
    }),
    update: (id, b) => run('Sửa người ở cùng', (db) => {
      const o = db.occupants.find((x) => x.id === id); if (!o) throw notFound('Không tìm thấy người ở cùng');
      Object.assign(o, cleanOccupant(b.occupant || {}, todayVN())); B.log(db, 'Sửa người ở cùng', o.fullName); return o;
    }),
    remove: async (id) => {
      let paths = [];
      const r = await mutate((db) => { const o = db.occupants.find((x) => x.id === id); if (!o) throw notFound('Không tìm thấy người ở cùng'); paths = ['front', 'back'].map((k) => o.idImages?.[k]?.pathname).filter(Boolean); db.occupants = db.occupants.filter((x) => x.id !== id); B.log(db, 'Xóa người ở cùng', o.fullName); });
      let failed = 0; for (const p of paths) { try { await delPrivate(p); } catch { failed++; } }
      invalidateCache(); return done(r.db, { imagesFailed: failed });
    },
  },
  master: {
    create: (b) => run('Ghi chỉ số đồng hồ tổng', (db) => {
      const today = todayVN(); const date = b.date || today; const e = Number(b.elec), w = Number(b.water);
      if (!isValidISO(date) || date > today) throw bad('Ngày ghi không hợp lệ (không được ở tương lai)');
      if (!Number.isFinite(e) || !Number.isFinite(w) || e < 0 || w < 0) throw bad('Chỉ số điện/nước tổng không hợp lệ');
      checkMasterOrder(db, null, date, e, w);
      const rec = { id: B.uid('mr'), date, elec: e, water: w, note: str(b.note, 200), createdAt: new Date().toISOString() };
      db.masterReadings.push(rec); B.log(db, 'Ghi đồng hồ tổng', `điện ${e}, nước ${w}`); return rec;
    }),
    update: (id, b) => run('Sửa chỉ số đồng hồ tổng', (db) => {
      const r = db.masterReadings.find((x) => x.id === id); if (!r) throw notFound('Không tìm thấy lần ghi'); const today = todayVN();
      const date = b.date || r.date, e = Number(b.elec), w = Number(b.water);
      if (!isValidISO(date) || date > today) throw bad('Ngày ghi không hợp lệ (không được ở tương lai)');
      if (!Number.isFinite(e) || !Number.isFinite(w) || e < 0 || w < 0) throw bad('Chỉ số điện/nước tổng không hợp lệ');
      checkMasterOrder(db, id, date, e, w);
      const before = { date: r.date, elec: r.elec, water: r.water }; Object.assign(r, { date, elec: e, water: w, note: str(b.note, 200) }); (r.history ||= []).push({ at: new Date().toISOString(), before });
      B.log(db, 'Sửa đồng hồ tổng', `${before.date}: ${before.elec}/${before.water} → ${date}: ${e}/${w}`); return r;
    }),
    remove: (id) => run('Xóa chỉ số đồng hồ tổng', (db) => {
      const last = db.masterReadings.slice().sort((a, c) => a.date.localeCompare(c.date) || String(a.createdAt).localeCompare(String(c.createdAt))).pop();
      if (!last || last.id !== id) throw bad('Chỉ xóa được lần ghi mới nhất (để sửa nhập nhầm)');
      db.masterReadings = db.masterReadings.filter((x) => x.id !== id); B.log(db, 'Xóa chỉ số đồng hồ tổng', `${last.date}`);
    }),
  },
  settings: { save: (b) => run('Cài đặt', (db) => {
    db.meta = db.meta || {}; const names = { publicShowTenant: 'Hiện họ tên khách + ghi chú ở trang ngoài', publicShowEvents: 'Hiện sự kiện ở trang ngoài', sheetIncludePersonal: 'Gửi thông tin cá nhân khách vào Google Sheet' };
    if (b.bank !== undefined) { db.meta.bank = cleanBank(b.bank); B.log(db, 'Cập nhật thông tin nhận tiền (hiện trên hóa đơn)', db.meta.bank ? `${db.meta.bank.bankName} – ${db.meta.bank.accountName}` : 'đã xóa'); }
    for (const k of Object.keys(names)) if (b[k] !== undefined) { db.meta[k] = !!b[k]; B.log(db, 'Đổi cài đặt', `${names[k]}: ${db.meta[k] ? 'BẬT' : 'TẮT'}`); }
    return true;
  }) },
  events: {
    create: (b) => run('Thêm sự kiện', (db) => { const e = { id: B.uid('evt'), ...cleanEvent(b), createdAt: new Date().toISOString() }; db.events.push(e); B.log(db, 'Thêm sự kiện', e.name); return e; }),
    update: (id, b) => run('Sửa sự kiện', (db) => { const e = db.events.find((x) => x.id === id); if (!e) throw notFound('Không tìm thấy sự kiện'); Object.assign(e, cleanEvent(b)); B.log(db, 'Sửa sự kiện', e.name); return e; }),
    remove: (id) => run('Xóa sự kiện', (db) => { const e = db.events.find((x) => x.id === id); if (!e) throw notFound('Không tìm thấy sự kiện'); db.events = db.events.filter((x) => x.id !== id); B.log(db, 'Xóa sự kiện', e.name); }),
  },
  sheets: {
    ping: async () => { if (!sheets.configured()) throw bad('Chưa kết nối Google Sheet: thiếu GOOGLE_SHEET_WEBHOOK_URL hoặc GOOGLE_SHEET_SECRET trên Vercel.', 'SHEET_CONFIG'); try { const r = await sheets.ping(); return { ok: true, sheet: r.sheet, url: r.url, tabs: r.tabs, status: sheets.getStatus() }; } catch (e) { throw new ApiError(502, e.message, 'SHEET'); } },
    test: async () => { if (!sheets.configured()) throw bad('Chưa kết nối Google Sheet', 'SHEET_CONFIG'); try { await sheets.pushRows({ NhatKy: [[new Date().toISOString(), 'Kiểm tra kết nối', 'Dòng thử gửi từ nút "Gửi dòng thử" – có thể bỏ qua']] }); return { ok: true, status: sheets.getStatus() }; } catch (e) { throw new ApiError(502, e.message, 'SHEET'); } },
    snapshot: async () => { if (!sheets.configured()) throw bad('Chưa kết nối Google Sheet', 'SHEET_CONFIG'); const { db } = await readDb(); try { const r = await sheets.pushRows(sheets.snapshotRows(db)); return { ok: true, rows: r.appended, status: sheets.getStatus() }; } catch (e) { throw new ApiError(502, e.message, 'SHEET'); } },
    exportAll: async () => { if (!sheets.configured()) throw bad('Chưa kết nối Google Sheet', 'SHEET_CONFIG'); const { db } = await readDb(); try { const r = await sheets.pushRows(sheets.allRows(db, sheets.includePersonal(db))); return { ok: true, rows: r.appended, status: sheets.getStatus() }; } catch (e) { throw new ApiError(502, e.message, 'SHEET'); } },
  },

  rentals: { price: (id, b) => run('Đổi giá', (db) => B.changePrice(db, { rentalId: id, rent: num(b.rent, 'Giá thuê'), elecPrice: num(b.elecPrice, 'Giá điện'), waterPrice: num(b.waterPrice, 'Giá nước'), effectiveFrom: b.effectiveFrom, reason: b.reason }, todayVN())) },

  invoices: {
    create: (b) => run('Lập hóa đơn', (db) => B.createPeriodicInvoice(db, b, todayVN())),
    adjust: (id, b) => run('Điều chỉnh hóa đơn', (db) => B.adjustInvoice(db, id, b, todayVN())),
    remove: async (id) => {
      let out = null; const r = await mutate((db) => { out = B.deleteInvoice(db, id); return out; });
      let failed = 0; for (const p of out.paths || []) { try { await delPrivate(p); } catch { failed++; } }
      invalidateCache(); return done(r.db, { result: { ...out, paths: undefined }, imagesFailed: failed });
    },
  },
  payments: {
    create: (b) => run('Thu tiền', (db) => B.addPayment(db, b, todayVN())),
    void: (id, b) => run('Hủy giao dịch', (db) => B.voidPayment(db, id, b.reason)),
  },
  notes: { save: (b) => run('Ghi chú tháng', (db) => {
    if (!/^\d{4}-\d{2}$/.test(b.ym || '') || !B.getRoom(db, b.roomId)) throw bad('Thiếu phòng hoặc tháng');
    let n = db.monthlyNotes.find((x) => x.roomId === b.roomId && x.ym === b.ym);
    if (!n) { n = { id: B.uid('note'), roomId: b.roomId, ym: b.ym, text: '', updatedAt: '' }; db.monthlyNotes.push(n); }
    n.text = str(b.text, 500); n.updatedAt = new Date().toISOString(); return n;
  }) },

  checkout: {
    preview: async (b) => { const { db } = await readDb(); const c = B.computeCheckout(db, b, todayVN()); const { rental, L, ...rest } = c; return { ok: true, preview: { ...rest, roomName: B.getRoom(db, rental.roomId).name, tenantName: db.tenants.find((t) => t.id === rental.tenantId).fullName, startDate: rental.startDate, latestInvoiceCode: L.code } }; },
    confirm: (b) => run('Trả phòng', (db) => B.confirmCheckout(db, b, todayVN())),
    refunded: (id, b) => run('Xác nhận hoàn tiền', (db) => B.markRefunded(db, id, b.date, todayVN())),
  },
  transfer: (b) => run('Chuyển phòng', (db) => B.transferRoom(db, b, todayVN())),

  reports: async (q) => {
    const { db } = await readDb(); const today = todayVN();
    const from = q.from || `${today.slice(0, 4)}-01-01`, to = q.to || today;
    const rows = {};
    const row = (ym) => (rows[ym] ||= { ym, rent: 0, elec: 0, water: 0, extras: 0, adjust: 0, billed: 0, collected: 0 });
    for (const i of db.invoices) {
      if (i.dueDate < from || i.dueDate > to) continue;
      const r = row(ymOf(i.dueDate)); r.rent += i.rent; r.elec += i.elec?.amount || 0; r.water += i.water?.amount || 0; r.extras += i.extrasTotal; r.adjust += i.adjustTotal || 0;
      r.billed += i.total - i.oldDebt - (i.manualDebt || 0); // không cộng nợ cũ để không đếm trùng
    }
    for (const p of db.payments) if (!p.voided && p.date >= from && p.date <= to) row(ymOf(p.date)).collected += p.amount;
    const byRoom = {};
    for (const i of db.invoices) { if (i.dueDate < from || i.dueDate > to) continue; const r = (byRoom[i.roomName] ||= { room: i.roomName, billed: 0, collected: 0 }); r.billed += i.total - i.oldDebt - (i.manualDebt || 0); }
    for (const p of db.payments) if (!p.voided && p.date >= from && p.date <= to) { const inv = db.invoices.find((i) => i.id === p.invoiceId); (byRoom[inv.roomName] ||= { room: inv.roomName, billed: 0, collected: 0 }).collected += p.amount; }
    const reminders = buildReminders(db, today);
    const total = Object.values(rows).reduce((a, r) => ({ rent: a.rent + r.rent, elec: a.elec + r.elec, water: a.water + r.water, extras: a.extras + r.extras + r.adjust, billed: a.billed + r.billed, collected: a.collected + r.collected }), { rent: 0, elec: 0, water: 0, extras: 0, billed: 0, collected: 0 });
    return { ok: true, from, to, months: Object.values(rows).sort((a, b) => a.ym.localeCompare(b.ym)), rooms: Object.values(byRoom).sort((a, b) => a.room.localeCompare(b.room, 'vi', { numeric: true })), total, debtNow: buildSummary(db, reminders).totalRemaining };
  },

  backup: {
    export: async () => { const { db } = await readDb(); return db; },
    restore: async (b) => {
      if (b.confirm !== 'GHI DE') throw bad('Cần xác nhận ghi đè bằng cách gõ đúng "GHI DE"');
      const incoming = migrateDb(b.db); validateDb(incoming);
      if (incoming.schemaVersion !== SCHEMA_VERSION) throw bad('Phiên bản dữ liệu không khớp');
      const r = await mutate(async (cur) => { const path = await saveSafetyCopy(cur, 'truoc-khi-khoi-phuc'); for (const k of Object.keys(cur)) delete cur[k]; Object.assign(cur, incoming); B.log(cur, 'Khôi phục dữ liệu từ file', `Bản an toàn: ${path}`); return path; });
      invalidateCache(); return done(r.db, { safetyCopy: r.result });
    },
  },

  rentalsEdit: {
    remove: async (id) => {
      let paths = []; const r = await mutate((db) => { const o = B.undoMoveIn(db, id); paths = o.paths; return true; });
      let failed = 0; for (const p of paths) { try { await delPrivate(p); } catch { failed++; } }
      invalidateCache(); return done(r.db, { imagesDeleted: paths.length - failed, imagesFailed: failed });
    },
    updateStart: (id, b) => run('Sửa ngày nhận phòng', (db) => B.changeStartDate(db, id, b.startDate, todayVN())),
  },
  tenantsDel: {
    remove: async (id) => {
      let paths = []; const r = await mutate((db) => { const o = purgeOne(db, id, todayVN()); paths = o.paths; return true; });
      let failed = 0; for (const p of paths) { try { await delPrivate(p); } catch { failed++; } }
      invalidateCache(); return done(r.db, { imagesDeleted: paths.length - failed, imagesFailed: failed });
    },
  },
  cleanup: {
    run: async (b) => {
      if (b.confirm !== 'XOA') throw bad('Cần xác nhận xóa');
      let paths = [];
      const r = await mutate((db) => { const o = purgeOld(db, todayVN()); paths = o.paths; return o.count; });
      let failed = 0; for (const p of paths) { try { await delPrivate(p); } catch { failed++; } }
      invalidateCache(); return done(r.db, { purged: r.result, imagesDeleted: paths.length - failed, imagesFailed: failed });
    },
  },

  storage: {
    upload: async (req, q) => {
      const ownerId = q.ownerId || q.tenantId; const side = q.side; const isQr = ownerId === 'bank-qr';
      if (isQr ? side !== 'qr' : !['front', 'back'].includes(side)) throw bad(isQr ? 'side phải là qr' : 'side phải là front hoặc back');
      const ct = String(req.headers['content-type'] || '').split(';')[0];
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(ct)) throw bad('Chỉ nhận ảnh JPEG/PNG/WEBP');
      const buf = await readBody(req, 4_200_000);
      if (buf.length < 1000) throw bad('Ảnh rỗng hoặc quá nhỏ');
      const sig = (a) => a.every((v, i) => buf[i] === v);
      if (!(sig([0xff, 0xd8, 0xff]) || sig([0x89, 0x50, 0x4e, 0x47]) || (sig([0x52, 0x49, 0x46, 0x46]) && buf.subarray(8, 12).toString() === 'WEBP'))) throw bad('File không phải ảnh JPEG/PNG/WEBP hợp lệ');
      const find = (d) => d.tenants.find((x) => x.id === ownerId) || d.occupants.find((x) => x.id === ownerId);
      // đẩy ảnh lên kho trước, rồi chỉ cần MỘT lần cập nhật dữ liệu (nhanh hơn; nếu không tìm thấy người thì xóa ảnh vừa đẩy)
      const blob = await putPrivate(isQr ? `bank/qr-${Date.now()}.jpg` : `cccd/${ownerId}/${side}.jpg`, buf, ct);
      let oldPath = null; let r;
      try {
        r = await mutate((d) => {
          const img = { id: B.uid('img'), pathname: blob.pathname, side, contentType: ct, size: buf.length, uploadedAt: new Date().toISOString() };
          if (isQr) { d.meta = d.meta || {}; oldPath = d.meta.bankQr?.pathname || null; d.meta.bankQr = img; B.log(d, 'Tải ảnh QR ngân hàng', 'QR nhận tiền'); return; }
          const t = find(d); if (!t) throw notFound('Không tìm thấy người cần lưu ảnh');
          oldPath = t.idImages?.[side]?.pathname || null; t.idImages = t.idImages || { front: null, back: null }; t.idImages[side] = img;
          B.log(d, 'Tải ảnh CCCD', `${t.fullName} - ${side === 'front' ? 'mặt trước' : 'mặt sau'}`);
        });
      } catch (e) { try { await delPrivate(blob.pathname); } catch { /* bỏ qua */ } throw e; }
      if (oldPath && oldPath !== blob.pathname) { try { await delPrivate(oldPath); } catch { /* ảnh cũ mồ côi - không ảnh hưởng dữ liệu */ } }
      invalidateCache(); return done(r.db);
    },
    stream: async (id, q, res) => {
      const { db } = await readDb();
      let img = db.meta?.bankQr?.id === id ? db.meta.bankQr : null; for (const t of [...db.tenants, ...db.occupants]) for (const s of ['front', 'back']) if (t.idImages?.[s]?.id === id) img = t.idImages[s];
      if (!img) throw notFound('Không tìm thấy ảnh');
      const r = await getPrivate(img.pathname);
      if (!r || r.statusCode !== 200) throw notFound('Ảnh không còn trong kho lưu trữ');
      res.statusCode = 200;
      res.setHeader('Content-Type', img.contentType || 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=600'); // ảnh có mã riêng, đổi ảnh là đổi mã; lưu tạm trên máy 10 phút để tải lại nhanh
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (q.download) res.setHeader('Content-Disposition', `attachment; filename="cccd-${img.side}.jpg"`);
      const { Readable } = await import('node:stream');
      Readable.fromWeb(r.stream).pipe(res);
    },
    remove: async (id) => {
      let path = null;
      const { db } = await readDb(); if (db.meta?.bankQr?.id === id) path = db.meta.bankQr.pathname;
      for (const t of [...db.tenants, ...db.occupants]) for (const s of ['front', 'back']) if (t.idImages?.[s]?.id === id) path = t.idImages[s].pathname;
      if (!path) throw notFound('Không tìm thấy ảnh');
      await delPrivate(path);
      if (db.meta?.bankQr?.id === id) return run('Xóa ảnh QR ngân hàng', (d) => { d.meta.bankQr = null; B.log(d, 'Xóa ảnh QR ngân hàng', ''); });
      return run('Xóa ảnh CCCD', (d) => { for (const t of [...d.tenants, ...d.occupants]) for (const s of ['front', 'back']) if (t.idImages?.[s]?.id === id) { t.idImages[s] = null; B.log(d, 'Xóa ảnh CCCD', t.fullName); } });
    },
  },
};
