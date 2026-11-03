// Lớp lưu trữ dữ liệu dùng chung cho mọi nơi lưu (Vercel Blob mặc định, GitHub tùy chọn).
import { ApiError } from './errors.js';
import { emptyDb, validateDb } from './schema.js';
import { addMonthsClamp, nowISO, todayVN } from './dates.js';
import * as blobDriver from './drivers/blobdb.js';
import * as ghDriver from './drivers/github.js';
import * as redisDriver from './drivers/redis.js';
import { hasBlobConfig } from './blob.js';

const pick = () => {
  const d = process.env.DB_DRIVER;
  if (d === 'github') return ghDriver; if (d === 'blob') return blobDriver; if (d === 'redis') return redisDriver;
  if (redisDriver.configured()) return redisDriver; // mặc định khi đã nối Upstash
  if (process.env.GITHUB_TOKEN) return ghDriver;
  return blobDriver;
};
const driver = pick;
// Trạng thái kết nối nơi lưu dữ liệu (cho dòng cảnh báo)
export const driverInfo = () => { const d = pick(); return { name: d.name, configured: d === redisDriver ? redisDriver.configured() : d === blobDriver ? hasBlobConfig() : !!process.env.GITHUB_TOKEN }; };
export const driverName = () => driver().name;
export const getTokenExpiry = () => driver().tokenExpiry();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function readDb() {
  const raw = await driver().readDb();
  if (!raw.exists) return { db: emptyDb(nowISO()), version: null, isNew: true };
  let db; try { db = JSON.parse(raw.text); } catch { throw new ApiError(500, 'File dữ liệu bị hỏng (không đọc được JSON). Hệ thống từ chối ghi đè để bảo vệ dữ liệu. Hãy khôi phục từ bản sao lưu.', 'DB_CORRUPT'); }
  validateDb(db);
  return { db, version: raw.version, isNew: false };
}
// mutate: đọc bản mới nhất → áp dụng fn → kiểm tra → ghi có kiểm tra phiên bản. Xung đột => đọc lại & áp dụng lại (không ghi đè âm thầm).
export async function mutate(fn) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { db, version } = await readDb();
    const result = await fn(db);
    db.updatedAt = nowISO(); db.meta = db.meta || {};
    const ym = todayVN().slice(0, 7); let backedUp = false;
    if (db.meta.lastMonthlyBackup !== ym) { try { await driver().putExtra(`backups/${ym}.json`, JSON.stringify(db, null, 1)); db.meta.lastMonthlyBackup = ym; backedUp = true; } catch { /* thử lại ở lần lưu sau */ } }
    validateDb(db);
    const w = await driver().writeDb(JSON.stringify(db, null, 1), version);
    if (w.ok) { if (backedUp) pruneBackups().catch(() => {}); return { db, result }; }
    await sleep(150 + Math.random() * 350 * (attempt + 1));
  }
  throw new ApiError(409, 'Dữ liệu vừa được thay đổi ở nơi khác và không thể lưu an toàn sau nhiều lần thử. Dữ liệu CHƯA được lưu. Hãy tải lại trang và thao tác lại.', 'CONFLICT');
}
// Tự xóa bản sao lưu quá 24 tháng
async function pruneBackups() {
  const cutoff = addMonthsClamp(todayVN(), -24).slice(0, 7);
  for (const f of await driver().listExtra('backups/')) {
    const m = /^(\d{4}-\d{2})\.json$/.exec(f.name); const t = /-(\d{13})\.json$/.exec(f.name);
    const ym = m ? m[1] : t ? new Date(Number(t[1]) + 7 * 3600e3).toISOString().slice(0, 7) : null;
    if (ym && ym < cutoff) await driver().delExtra(f.ref);
  }
}
export async function saveSafetyCopy(db, label) {
  const path = `backups/${label}-${Date.now()}.json`;
  if (!(await driver().putExtra(path, JSON.stringify(db, null, 1)))) throw new ApiError(502, 'Không tạo được bản sao an toàn trước khi khôi phục', 'STORE_WRITE');
  return path;
}
let cache = { at: 0, db: null };
export async function readDbCached(ttlMs = 15000) { if (cache.db && Date.now() - cache.at < ttlMs) return cache.db; const { db } = await readDb(); cache = { at: Date.now(), db }; return db; }
export const invalidateCache = () => { cache = { at: 0, db: null }; };
