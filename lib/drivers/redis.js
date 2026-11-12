// Nơi lưu dữ liệu chính: Upstash Redis (gói miễn phí) qua REST. Token do Vercel/Upstash cấp, không có hạn dùng.
// Chống ghi đè: cập nhật theo kiểu "so sánh rồi ghi" (compare-and-set) bằng một lệnh EVAL nguyên tử.
import zlib from 'node:zlib';
import { ApiError } from '../errors.js';
const KEY_VER = 'nt44:ver', KEY_DB = 'nt44:db', TTL_EXTRA = 63115200; // bản sao lưu tự xóa sau 2 năm
// Ưu tiên cặp biến KV_REST_API_URL + KV_REST_API_TOKEN (Vercel tự thêm, có quyền GHI). Không bao giờ dùng KV_REST_API_READ_ONLY_TOKEN.
const env = () => {
  const kv = { url: process.env.KV_REST_API_URL || '', token: process.env.KV_REST_API_TOKEN || '', source: 'KV_REST_API_*' };
  const up = { url: process.env.UPSTASH_REDIS_REST_URL || '', token: process.env.UPSTASH_REDIS_REST_TOKEN || '', source: 'UPSTASH_REDIS_REST_*' };
  const e = kv.url && kv.token ? kv : up;
  return { url: e.url.replace(/\/$/, ''), token: e.token, source: e.source };
};
export const source = () => env().source;
export const name = 'redis';
export const configured = () => { const e = env(); return !!(e.url && e.token); };
export const tokenExpiry = () => null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function cmd(...args) {
  const e = env();
  if (!e.url || !e.token) throw Object.assign(new Error('Chưa kết nối cơ sở dữ liệu Upstash Redis. Làm theo hướng dẫn bước "Tạo cơ sở dữ liệu" rồi Redeploy.'), { status: 500, code: 'CONFIG' });
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(e.url, { method: 'POST', headers: { Authorization: `Bearer ${e.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
      if (res.status >= 500) { last = new Error(`HTTP ${res.status}`); await sleep(300 * (i + 1)); continue; }
      const j = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) throw new ApiError(500, 'Upstash từ chối truy cập (token sai hoặc đã bị đổi/thu hồi). Vào Vercel → Storage kiểm tra kết nối cơ sở dữ liệu rồi Redeploy.', 'REDIS_AUTH');
      if (res.status === 429 || /limit|quota|blocked/i.test(String(j.error || ''))) throw new ApiError(502, 'Upstash báo đã chạm hạn mức gói miễn phí (số lệnh/tháng hoặc dung lượng). Dữ liệu CHƯA được lưu.', 'REDIS_LIMIT');
      if (!res.ok || j.error) throw new ApiError(502, `Cơ sở dữ liệu Upstash báo lỗi: ${String(j.error || res.status).slice(0, 140)}. Dữ liệu CHƯA được lưu.`, 'REDIS');
      return j.result;
    } catch (err) { if (err instanceof ApiError || err.code === 'CONFIG') throw err; last = err; await sleep(300 * (i + 1)); }
  }
  throw new ApiError(502, 'Không kết nối được cơ sở dữ liệu Upstash. Dữ liệu CHƯA được lưu, hãy thử lại.', 'REDIS_DOWN', { cause: String(last?.message || last) });
}
export const redisCmd = cmd;
const pack = (t) => `gz:${zlib.gzipSync(Buffer.from(t, 'utf8')).toString('base64')}`;
const unpack = (s) => (s.startsWith('gz:') ? zlib.gunzipSync(Buffer.from(s.slice(3), 'base64')).toString('utf8') : s);
// Mỗi script đồng thời cộng bộ đếm lệnh của tháng (không tốn thêm yêu cầu mạng) để hiển thị % hạn mức.
const READ = "local c = redis.call('INCRBY', KEYS[3], 3) if c == 3 then redis.call('EXPIRE', KEYS[3], 3888000) end return {redis.call('GET', KEYS[1]), redis.call('GET', KEYS[2]), c}";
const CAS = "local c = redis.call('INCRBY', KEYS[3], 4) if c == 4 then redis.call('EXPIRE', KEYS[3], 3888000) end local cur = redis.call('GET', KEYS[1]) if (not cur and ARGV[1] == '') or cur == ARGV[1] then redis.call('SET', KEYS[2], ARGV[2]) redis.call('SET', KEYS[1], ARGV[3]) return {1, c} end return {0, c}";
const month = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
const usage = { commands: null, dbBytes: null, month: '' };
export const getUsage = () => ({ ...usage, commandLimit: Number(process.env.UPSTASH_COMMAND_LIMIT) || 500000, dbLimitBytes: (Number(process.env.UPSTASH_DB_LIMIT_MB) || 256) * 1048576 });
export async function readDb() {
  const r = await cmd('EVAL', READ, 3, KEY_VER, KEY_DB, `nt44:cmd:${month()}`);
  if (r && r[2] != null) { usage.commands = Number(r[2]); usage.month = month(); }
  if (!r || r[1] == null) return { exists: false, version: null, text: null };
  usage.dbBytes = r[1].length;
  return { exists: true, version: r[0] || '', text: unpack(r[1]) };
}
export async function writeDb(text, version) {
  const nv = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const packed = pack(text);
  const r = await cmd('EVAL', CAS, 3, KEY_VER, KEY_DB, `nt44:cmd:${month()}`, version || '', packed, nv);
  if (r && r[1] != null) { usage.commands = Number(r[1]); usage.month = month(); }
  if (Number(r?.[0]) === 1) { usage.dbBytes = packed.length; return { ok: true }; }
  return { conflict: true };
}
export async function putExtra(path, text) { return (await cmd('SET', `nt44:x:${path}`, pack(text), 'NX', 'EX', TTL_EXTRA)) === 'OK'; }
export async function listExtra() { return []; } // bản sao lưu tự hết hạn nhờ TTL, không cần quét
export async function delExtra() {}
