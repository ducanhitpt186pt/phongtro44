// Nơi lưu dữ liệu chính: Upstash Redis (gói miễn phí) qua REST. Token do Vercel/Upstash cấp, không có hạn dùng.
// Chống ghi đè: cập nhật theo kiểu "so sánh rồi ghi" (compare-and-set) bằng một lệnh EVAL nguyên tử.
import zlib from 'node:zlib';
import { ApiError } from '../errors.js';
const KEY_VER = 'nt44:ver', KEY_DB = 'nt44:db', TTL_EXTRA = 63115200; // bản sao lưu tự xóa sau 2 năm
const env = () => ({ url: (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').replace(/\/$/, ''), token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '' });
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
const pack = (t) => `gz:${zlib.gzipSync(Buffer.from(t, 'utf8')).toString('base64')}`;
const unpack = (s) => (s.startsWith('gz:') ? zlib.gunzipSync(Buffer.from(s.slice(3), 'base64')).toString('utf8') : s);
const READ = "return {redis.call('GET', KEYS[1]), redis.call('GET', KEYS[2])}";
const CAS = "local cur = redis.call('GET', KEYS[1]) if (not cur and ARGV[1] == '') or cur == ARGV[1] then redis.call('SET', KEYS[2], ARGV[2]) redis.call('SET', KEYS[1], ARGV[3]) return 1 end return 0";
export async function readDb() {
  const r = await cmd('EVAL', READ, 2, KEY_VER, KEY_DB);
  if (!r || r[1] == null) return { exists: false, version: null, text: null };
  return { exists: true, version: r[0] || '', text: unpack(r[1]) };
}
export async function writeDb(text, version) {
  const nv = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const ok = await cmd('EVAL', CAS, 2, KEY_VER, KEY_DB, version || '', pack(text), nv);
  return Number(ok) === 1 ? { ok: true } : { conflict: true };
}
export async function putExtra(path, text) { return (await cmd('SET', `nt44:x:${path}`, pack(text), 'NX', 'EX', TTL_EXTRA)) === 'OK'; }
export async function listExtra() { return []; } // bản sao lưu tự hết hạn nhờ TTL, không cần quét
export async function delExtra() {}
