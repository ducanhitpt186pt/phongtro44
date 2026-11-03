// Tất cả thao tác nghiệp vụ. Mỗi hàm ghi (mutation) chạy trong mutate() => đọc mới nhất, kiểm tra, ghi có SHA.
import { ApiError, bad, notFound } from '../errors.js';
import { todayVN, isValidISO, ymOf } from '../dates.js';
import { mutate, readDb, saveSafetyCopy, invalidateCache, getTokenExpiry, driverInfo } from '../store.js';
import { validateDb, ROOM_STATUS, SCHEMA_VERSION } from '../schema.js';
import * as B from '../billing.js';
import { buildReminders, buildSummary, invoiceDerived, rentalDerived } from '../reminders.js';
import { cleanPerson, num, str } from '../validate.js';
import { delPrivate, getPrivate, putPrivate } from '../blob.js';
import { readBody } from '../http.js';
import { purgeOld, storageInfo } from '../cleanup.js';
import { buildSystem } from '../health.js';

export function snapshot(db) {
  const today = todayVN();
  const reminders = buildReminders(db, today);
  return { today, db, system: (() => { const storage = storageInfo(db, today); return { storage, ...buildSystem({ today, tokenExpires: getTokenExpiry(), storage, db: driverInfo() }) }; })(), derived: { invoices: invoiceDerived(db, today), rentals: rentalDerived(db, today), reminders, summary: buildSummary(db, reminders) } };
}
const done = (db, extra = {}) => ({ ok: true, ...snapshot(db), ...extra });
async function run(message, fn) { const { db, result } = await mutate(fn); invalidateCache(); return done(db, { result }); }

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
      const occupants = (b.occupants || []).map((o) => cleanPerson(o, { full: false }, today));
      return B.moveIn(db, { ...b, tenant, occupants, note: str(b.note, 300), headcount: Math.max(1, Math.round(Number(b.headcount) || 1 + occupants.length)) }, today);
    }),
    update: (id, b) => run('Sửa khách thuê', (db) => {
      const t = db.tenants.find((x) => x.id === id); if (!t) throw notFound('Không tìm thấy khách');
      const today = todayVN();
      if (b.tenant) Object.assign(t, cleanPerson(b.tenant, { full: true }, today));
      if (Array.isArray(b.occupants)) {
        const keep = new Map(db.occupants.filter((o) => o.tenantId === id).map((o) => [o.id, o]));
        db.occupants = db.occupants.filter((o) => o.tenantId !== id);
        for (const o of b.occupants) db.occupants.push({ id: keep.has(o.id) ? o.id : B.uid('occ'), tenantId: id, ...cleanPerson(o, { full: false }, today) });
      }
      if (b.rentalId) {
        const r = B.getRental(db, b.rentalId); if (!r || r.tenantId !== id) throw notFound('Không tìm thấy lượt thuê');
        if (b.headcount !== undefined) r.headcount = Math.max(1, Math.round(Number(b.headcount) || 1));
        if (b.rentalNote !== undefined) r.note = str(b.rentalNote, 300);
      }
      B.log(db, 'Sửa khách thuê', t.fullName); return t;
    }),
  },

  rentals: { price: (id, b) => run('Đổi giá', (db) => B.changePrice(db, { rentalId: id, rent: num(b.rent, 'Giá thuê'), elecPrice: num(b.elecPrice, 'Giá điện'), waterPrice: num(b.waterPrice, 'Giá nước'), effectiveFrom: b.effectiveFrom, reason: b.reason }, todayVN())) },

  invoices: {
    create: (b) => run('Lập hóa đơn', (db) => B.createPeriodicInvoice(db, b, todayVN())),
    adjust: (id, b) => run('Điều chỉnh hóa đơn', (db) => B.adjustInvoice(db, id, b, todayVN())),
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
      r.billed += i.total - i.oldDebt; // không cộng nợ cũ để không đếm trùng
    }
    for (const p of db.payments) if (!p.voided && p.date >= from && p.date <= to) row(ymOf(p.date)).collected += p.amount;
    const byRoom = {};
    for (const i of db.invoices) { if (i.dueDate < from || i.dueDate > to) continue; const r = (byRoom[i.roomName] ||= { room: i.roomName, billed: 0, collected: 0 }); r.billed += i.total - i.oldDebt; }
    for (const p of db.payments) if (!p.voided && p.date >= from && p.date <= to) { const inv = db.invoices.find((i) => i.id === p.invoiceId); (byRoom[inv.roomName] ||= { room: inv.roomName, billed: 0, collected: 0 }).collected += p.amount; }
    const reminders = buildReminders(db, today);
    const total = Object.values(rows).reduce((a, r) => ({ rent: a.rent + r.rent, elec: a.elec + r.elec, water: a.water + r.water, extras: a.extras + r.extras + r.adjust, billed: a.billed + r.billed, collected: a.collected + r.collected }), { rent: 0, elec: 0, water: 0, extras: 0, billed: 0, collected: 0 });
    return { ok: true, from, to, months: Object.values(rows).sort((a, b) => a.ym.localeCompare(b.ym)), rooms: Object.values(byRoom).sort((a, b) => a.room.localeCompare(b.room, 'vi', { numeric: true })), total, debtNow: buildSummary(db, reminders).totalRemaining };
  },

  backup: {
    export: async () => { const { db } = await readDb(); return db; },
    restore: async (b) => {
      if (b.confirm !== 'GHI DE') throw bad('Cần xác nhận ghi đè bằng cách gõ đúng "GHI DE"');
      const incoming = b.db; validateDb(incoming);
      if (incoming.schemaVersion !== SCHEMA_VERSION) throw bad('Phiên bản dữ liệu không khớp');
      const r = await mutate(async (cur) => { const path = await saveSafetyCopy(cur, 'truoc-khi-khoi-phuc'); for (const k of Object.keys(cur)) delete cur[k]; Object.assign(cur, incoming); B.log(cur, 'Khôi phục dữ liệu từ file', `Bản an toàn: ${path}`); return path; });
      invalidateCache(); return done(r.db, { safetyCopy: r.result });
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
      const { tenantId, side } = q;
      if (!['front', 'back'].includes(side)) throw bad('side phải là front hoặc back');
      const ct = String(req.headers['content-type'] || '').split(';')[0];
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(ct)) throw bad('Chỉ nhận ảnh JPEG/PNG/WEBP');
      const buf = await readBody(req, 4_200_000);
      if (buf.length < 1000) throw bad('Ảnh rỗng hoặc quá nhỏ');
      const sig = (a) => a.every((v, i) => buf[i] === v);
      if (!(sig([0xff, 0xd8, 0xff]) || sig([0x89, 0x50, 0x4e, 0x47]) || (sig([0x52, 0x49, 0x46, 0x46]) && buf.subarray(8, 12).toString() === 'WEBP'))) throw bad('File không phải ảnh JPEG/PNG/WEBP hợp lệ');
      const { db } = await readDb(); if (!db.tenants.find((t) => t.id === tenantId)) throw notFound('Không tìm thấy khách');
      const blob = await putPrivate(`cccd/${tenantId}/${side}.jpg`, buf, ct);
      let oldPath = null;
      const r = await mutate((d) => {
        const t = d.tenants.find((x) => x.id === tenantId); if (!t) throw notFound('Không tìm thấy khách');
        oldPath = t.idImages?.[side]?.pathname || null;
        t.idImages = t.idImages || { front: null, back: null };
        t.idImages[side] = { id: B.uid('img'), pathname: blob.pathname, side, contentType: ct, size: buf.length, uploadedAt: new Date().toISOString() };
        B.log(d, 'Tải ảnh CCCD', `${t.fullName} - ${side === 'front' ? 'mặt trước' : 'mặt sau'}`);
      });
      if (oldPath && oldPath !== blob.pathname) { try { await delPrivate(oldPath); } catch { /* ảnh cũ mồ côi - không ảnh hưởng dữ liệu */ } }
      invalidateCache(); return done(r.db);
    },
    stream: async (id, q, res) => {
      const { db } = await readDb();
      let img = null; for (const t of db.tenants) for (const s of ['front', 'back']) if (t.idImages?.[s]?.id === id) img = t.idImages[s];
      if (!img) throw notFound('Không tìm thấy ảnh');
      const r = await getPrivate(img.pathname);
      if (!r || r.statusCode !== 200) throw notFound('Ảnh không còn trong kho lưu trữ');
      res.statusCode = 200;
      res.setHeader('Content-Type', img.contentType || 'image/jpeg');
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (q.download) res.setHeader('Content-Disposition', `attachment; filename="cccd-${img.side}.jpg"`);
      const { Readable } = await import('node:stream');
      Readable.fromWeb(r.stream).pipe(res);
    },
    remove: async (id) => {
      let path = null;
      const { db } = await readDb();
      for (const t of db.tenants) for (const s of ['front', 'back']) if (t.idImages?.[s]?.id === id) path = t.idImages[s].pathname;
      if (!path) throw notFound('Không tìm thấy ảnh');
      await delPrivate(path);
      return run('Xóa ảnh CCCD', (d) => { for (const t of d.tenants) for (const s of ['front', 'back']) if (t.idImages?.[s]?.id === id) { t.idImages[s] = null; B.log(d, 'Xóa ảnh CCCD', t.fullName); } });
    },
  },
};
