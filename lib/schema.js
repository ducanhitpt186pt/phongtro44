import { ApiError } from './errors.js';
export const SCHEMA_VERSION = 1;
export const ROOM_STATUS = ['occupied', 'empty', 'repair', 'notready'];
export const COLLECTIONS = ['rooms', 'tenants', 'occupants', 'rentals', 'priceHistories', 'readings', 'invoices', 'payments', 'monthlyNotes', 'roomTransfers', 'checkoutRecords', 'activityLogs'];

export function emptyDb(now = new Date().toISOString()) {
  const db = { schemaVersion: SCHEMA_VERSION, updatedAt: now, counters: { invoice: 0 }, meta: { lastMonthlyBackup: '' } };
  for (const c of COLLECTIONS) db[c] = [];
  db.rooms = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: `room-${n}`, name: `Phòng ${n}`, status: 'empty', note: '', createdAt: now }));
  return db;
}

// Kiểm tra toàn vẹn trước khi ghi / khôi phục. Ném lỗi nếu dữ liệu sai.
export function validateDb(db) {
  const fail = (m) => { throw new ApiError(422, `Dữ liệu không hợp lệ: ${m}`, 'INVALID_DB'); };
  if (!db || typeof db !== 'object') fail('không phải đối tượng JSON');
  if (db.schemaVersion !== SCHEMA_VERSION) fail(`schemaVersion phải là ${SCHEMA_VERSION}`);
  for (const c of COLLECTIONS) if (!Array.isArray(db[c])) fail(`thiếu mảng "${c}"`);
  if (!db.counters || typeof db.counters.invoice !== 'number') fail('thiếu counters');
  db.meta = db.meta || { lastMonthlyBackup: '' };
  for (const c of COLLECTIONS) {
    const seen = new Set();
    for (const it of db[c]) {
      if (!it || typeof it.id !== 'string') fail(`"${c}" có bản ghi thiếu id`);
      if (seen.has(it.id)) fail(`"${c}" trùng id ${it.id}`);
      seen.add(it.id);
    }
  }
  const rooms = new Set(db.rooms.map((r) => r.id));
  const rentals = new Set(db.rentals.map((r) => r.id));
  const invoices = new Set(db.invoices.map((i) => i.id));
  for (const r of db.rooms) if (!ROOM_STATUS.includes(r.status)) fail(`phòng ${r.id} có trạng thái sai`);
  for (const r of db.rentals) if (!rooms.has(r.roomId)) fail(`lượt thuê ${r.id} trỏ tới phòng không tồn tại`);
  const keys = new Set();
  for (const i of db.invoices) {
    if (!rentals.has(i.rentalId)) fail(`hóa đơn ${i.code} trỏ tới lượt thuê không tồn tại`);
    if (!Number.isInteger(i.total)) fail(`hóa đơn ${i.code} có tổng tiền không phải số nguyên`);
    if (i.kind === 'periodic') {
      const k = `${i.chainId}#${i.periodIndex}`;
      if (keys.has(k)) fail(`hóa đơn trùng kỳ (${i.code})`);
      keys.add(k);
    }
  }
  for (const p of db.payments) {
    if (!invoices.has(p.invoiceId)) fail(`thanh toán ${p.id} trỏ tới hóa đơn không tồn tại`);
    if (!Number.isInteger(p.amount) || p.amount <= 0) fail(`thanh toán ${p.id} có số tiền sai`);
  }
  return true;
}
