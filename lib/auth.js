import crypto from 'node:crypto';
import { cfg } from './config.js';
import { ApiError } from './errors.js';
import * as redisDriver from './drivers/redis.js';

const COOKIE = 'nt44_session';
// Phiên hết hạn sau N phút KHÔNG hoạt động (mặc định 5; mỗi thao tác hoặc nhịp "còn dùng" từ trình duyệt sẽ gia hạn). Tối đa 12 giờ liên tục.
const IDLE = () => Math.max(1, Number(process.env.SESSION_IDLE_MINUTES) || 5) * 60;
const ABS_MAX = 12 * 3600;
const b64 = (b) => Buffer.from(b).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', cfg.sessionSecret).update(data).digest('base64url');
const safeEq = (a, b) => { const x = crypto.createHash('sha256').update(String(a)).digest(); const y = crypto.createHash('sha256').update(String(b)).digest(); return crypto.timingSafeEqual(x, y); };

export function checkPassword(input) {
  const hash = cfg.passwordHash;
  if (hash) { // định dạng: scrypt$<salt-hex>$<hash-hex>
    const [alg, salt, h] = hash.split('$');
    if (alg !== 'scrypt' || !salt || !h) throw new ApiError(500, 'APP_PASSWORD_HASH sai định dạng', 'CONFIG');
    const dk = crypto.scryptSync(String(input), Buffer.from(salt, 'hex'), 32).toString('hex');
    return safeEq(dk, h);
  }
  if (!cfg.password) throw new ApiError(500, 'Chưa cấu hình APP_PASSWORD trên Vercel', 'CONFIG');
  return safeEq(input, cfg.password);
}
const mk = (csrf, iat) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = b64(JSON.stringify({ exp: Math.min(now + IDLE(), iat + ABS_MAX), iat, csrf }));
  return `${payload}.${sign(payload)}`;
};
export function createSession() { const csrf = crypto.randomBytes(18).toString('base64url'); return { token: mk(csrf, Math.floor(Date.now() / 1000)), csrf }; }
export const refreshToken = (s) => mk(s.csrf, s.iat || Math.floor(Date.now() / 1000));
export function sessionCookie(token) { return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${IDLE() + 60}`; }
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export function readSession(req) {
  const raw = (req.headers.cookie || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(COOKIE + '='));
  if (!raw) return null;
  const token = raw.slice(COOKIE.length + 1);
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  let ok = false; try { ok = safeEq(sig, sign(payload)); } catch { return null; }
  if (!ok) return null;
  try { const p = JSON.parse(Buffer.from(payload, 'base64url').toString()); return p.exp > Date.now() / 1000 ? p : null; } catch { return null; }
}
// Bắt buộc đăng nhập; với thao tác ghi còn kiểm tra CSRF + Origin.
export function requireSession(req, { write }) {
  const s = readSession(req);
  if (!s) throw new ApiError(401, 'Chưa đăng nhập hoặc phiên đã hết hạn', 'UNAUTHENTICATED');
  if (write) {
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) throw new ApiError(403, 'Nguồn yêu cầu không hợp lệ', 'BAD_ORIGIN');
    const t = req.headers['x-csrf-token'];
    if (!t || !safeEq(t, s.csrf)) throw new ApiError(403, 'Thiếu hoặc sai mã bảo vệ CSRF. Hãy tải lại trang.', 'CSRF');
  }
  return s;
}
// Chống dò mật khẩu: sai 8 lần thì KHÓA 10 phút (theo địa chỉ IP). Có Upstash thì bộ đếm dùng chung cho mọi máy chủ Vercel; không thì đếm trong bộ nhớ từng máy chủ.
export const MAX_FAILS = 8, LOCK_SEC = 600;
const mem = new Map(); // ip -> {n, lastAt, until}
const ipKey = (ip) => String(ip).replace(/[^0-9a-fA-F:.]/g, '').slice(0, 45) || 'unknown';
const useRedis = () => redisDriver.configured();
const safe = async (fn, fallback) => { try { return await fn(); } catch { return fallback(); } };
function memLeft(ip) { const f = mem.get(ip); return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 1000) : 0; }
export async function loginGuard(ip) {
  ip = ipKey(ip); const left = useRedis() ? await safe(async () => Math.max(0, Number(await redisDriver.redisCmd('TTL', `nt44:lock:${ip}`)) || 0), () => memLeft(ip)) : memLeft(ip);
  if (left > 0) throw new ApiError(429, `Đã nhập sai mật khẩu ${MAX_FAILS} lần. Vui lòng thử lại sau ${Math.ceil(left / 60)} phút.`, 'RATE_LIMIT');
}
export async function loginFailed(ip) {
  ip = ipKey(ip);
  const memFail = () => { const f = mem.get(ip) || { n: 0, lastAt: 0, until: 0 }; if (Date.now() - f.lastAt > LOCK_SEC * 1000 && f.until < Date.now()) f.n = 0; f.n += 1; f.lastAt = Date.now(); if (f.n >= MAX_FAILS) { f.until = Date.now() + LOCK_SEC * 1000; f.n = 0; } mem.set(ip, f); if (mem.size > 500) mem.clear(); };
  if (!useRedis()) return memFail();
  await safe(async () => { const n = Number(await redisDriver.redisCmd('INCR', `nt44:lf:${ip}`)); await redisDriver.redisCmd('EXPIRE', `nt44:lf:${ip}`, LOCK_SEC); if (n >= MAX_FAILS) { await redisDriver.redisCmd('SET', `nt44:lock:${ip}`, '1', 'EX', LOCK_SEC); await redisDriver.redisCmd('DEL', `nt44:lf:${ip}`); } }, memFail);
}
export async function loginOk(ip) { ip = ipKey(ip); mem.delete(ip); if (useRedis()) await safe(() => redisDriver.redisCmd('DEL', `nt44:lf:${ip}`), () => null); }
