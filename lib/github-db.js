// Đọc/ghi database.json trong repo PRIVATE qua GitHub Contents API, có kiểm tra SHA chống ghi đè.
import { cfg } from './config.js';
import { ApiError } from './errors.js';
import { COLLECTIONS, emptyDb, validateDb } from './schema.js';
import { nowISO, todayVN } from './dates.js';

const API = 'https://api.github.com';
const headers = (extra = {}) => ({ Authorization: `Bearer ${cfg.ghToken}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'nha-tro-44', ...extra });
const url = (path) => `${API}/repos/${cfg.ghOwner}/${cfg.ghRepo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gh(u, opts = {}, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(u, { ...opts, headers: headers(opts.headers) });
      if (res.status >= 500 || res.status === 429) { last = new Error(`GitHub ${res.status}`); await sleep(400 * (i + 1)); continue; }
      return res;
    } catch (e) { last = e; await sleep(400 * (i + 1)); }
  }
  throw new ApiError(502, 'Không kết nối được GitHub để lưu/đọc dữ liệu. Dữ liệu CHƯA được lưu, hãy thử lại.', 'GITHUB_DOWN', { cause: String(last?.message || last) });
}
function authFail(res) {
  if (res.status === 401 || res.status === 403) throw new ApiError(500, 'GitHub từ chối quyền truy cập. Kiểm tra GITHUB_TOKEN (hết hạn hoặc thiếu quyền Contents: Read and write).', 'GITHUB_AUTH');
}
export async function readRaw(path = cfg.dbPath) {
  const res = await gh(`${url(path)}?ref=${encodeURIComponent(cfg.ghBranch)}`, { headers: { 'Cache-Control': 'no-cache' } });
  if (res.status === 404) return { exists: false, sha: null, text: null };
  authFail(res);
  if (!res.ok) throw new ApiError(502, `GitHub trả lỗi ${res.status} khi đọc dữ liệu`, 'GITHUB_READ');
  const j = await res.json();
  let b64 = j.content;
  if (!b64 || j.encoding === 'none') { // file > 1MB: đọc qua Git Blob API
    const br = await gh(`${API}/repos/${cfg.ghOwner}/${cfg.ghRepo}/git/blobs/${j.sha}`);
    if (!br.ok) throw new ApiError(502, 'Không đọc được file dữ liệu lớn', 'GITHUB_READ');
    b64 = (await br.json()).content;
  }
  return { exists: true, sha: j.sha, text: Buffer.from(b64, 'base64').toString('utf8') };
}
export async function readDb() {
  const raw = await readRaw();
  if (!raw.exists) return { db: emptyDb(nowISO()), sha: null, isNew: true };
  let db;
  try { db = JSON.parse(raw.text); } catch { throw new ApiError(500, 'File database.json bị hỏng (không đọc được JSON). Hệ thống từ chối ghi đè để bảo vệ dữ liệu. Hãy khôi phục từ bản sao lưu.', 'DB_CORRUPT'); }
  validateDb(db);
  return { db, sha: raw.sha, isNew: false };
}
// Trả { ok:true, sha } hoặc { conflict:true }. Chỉ báo thành công khi GitHub xác nhận.
async function writeRaw(path, text, sha, message) {
  const body = { message, content: Buffer.from(text, 'utf8').toString('base64'), branch: cfg.ghBranch };
  if (sha) body.sha = sha;
  const res = await gh(url(path), { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }, 2);
  if (res.status === 409 || res.status === 422) return { conflict: true };
  authFail(res);
  if (!res.ok) throw new ApiError(502, `GitHub trả lỗi ${res.status} khi ghi dữ liệu. Dữ liệu CHƯA được lưu.`, 'GITHUB_WRITE');
  const j = await res.json();
  return { ok: true, sha: j.content?.sha };
}

// mutate: đọc bản mới nhất → áp dụng fn → kiểm tra → ghi với SHA. Nếu xung đột, ĐỌC LẠI và áp dụng lại fn trên dữ liệu mới
// (không bao giờ ghi đè âm thầm). Không dùng khóa trong bộ nhớ vì nhiều Function chạy song song.
export async function mutate(fn, message = 'Cập nhật dữ liệu') {
  const MAX = 6;
  for (let attempt = 0; attempt < MAX; attempt++) {
    const { db, sha } = await readDb();
    const result = await fn(db);
    db.updatedAt = nowISO();
    validateDb(db);
    const w = await writeRaw(cfg.dbPath, JSON.stringify(db, null, 1), sha, message);
    if (w.ok) {
      monthlyBackup(db).catch(() => {});
      return { db, result };
    }
    await sleep(150 + Math.random() * 350 * (attempt + 1));
  }
  throw new ApiError(409, 'Dữ liệu vừa được thay đổi ở nơi khác và không thể lưu an toàn sau nhiều lần thử. Dữ liệu CHƯA được lưu. Hãy tải lại trang và thao tác lại.', 'CONFLICT');
}
// Bản sao lưu tự động mỗi tháng (backups/YYYY-MM.json) trong repo dữ liệu riêng tư - nỗ lực tốt nhất.
async function monthlyBackup(db) {
  const ym = todayVN().slice(0, 7);
  if (db.meta?.lastMonthlyBackup === ym) return;
  const path = `backups/${ym}.json`;
  const ex = await readRaw(path);
  if (!ex.exists) await writeRaw(path, JSON.stringify(db, null, 1), null, `Sao lưu tự động ${ym}`);
  db.meta.lastMonthlyBackup = ym;
  const cur = await readRaw();
  if (cur.exists) { const d = JSON.parse(cur.text); d.meta = { ...(d.meta || {}), lastMonthlyBackup: ym }; await writeRaw(cfg.dbPath, JSON.stringify(d, null, 1), cur.sha, 'Đánh dấu sao lưu tháng'); }
}
export async function saveSafetyCopy(db, label) {
  const path = `backups/${label}-${Date.now()}.json`;
  const w = await writeRaw(path, JSON.stringify(db, null, 1), null, `Bản an toàn: ${label}`);
  if (!w.ok) throw new ApiError(502, 'Không tạo được bản sao an toàn trước khi khôi phục', 'GITHUB_WRITE');
  return path;
}
// cache ngắn cho API công khai (giảm số lần gọi GitHub)
let cache = { at: 0, db: null };
export async function readDbCached(ttlMs = 15000) {
  if (cache.db && Date.now() - cache.at < ttlMs) return cache.db;
  const { db } = await readDb(); cache = { at: Date.now(), db }; return db;
}
export const invalidateCache = () => { cache = { at: 0, db: null }; };
export { COLLECTIONS };
