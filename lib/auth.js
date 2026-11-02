import crypto from 'node:crypto';
import { cfg } from './config.js';
import { ApiError } from './errors.js';

const COOKIE = 'nt44_session';
const MAX_AGE = 14 * 24 * 3600; // 14 ngày
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
export function createSession() {
  const csrf = crypto.randomBytes(18).toString('base64url');
  const payload = b64(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + MAX_AGE, csrf }));
  return { token: `${payload}.${sign(payload)}`, csrf };
}
export function sessionCookie(token) { return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`; }
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
// Hạn chế lạm dụng đăng nhập (bộ nhớ của từng instance - nỗ lực tốt nhất, xem docs/GIOI-HAN).
const fails = new Map();
export function loginGuard(ip) {
  const f = fails.get(ip);
  if (f && f.until > Date.now()) throw new ApiError(429, `Đăng nhập sai quá nhiều lần. Thử lại sau ${Math.ceil((f.until - Date.now()) / 1000)} giây.`, 'RATE_LIMIT');
}
export function loginFailed(ip) {
  const f = fails.get(ip) || { n: 0, until: 0 };
  f.n += 1; if (f.n >= 5) f.until = Date.now() + Math.min(15 * 60_000, 30_000 * 2 ** (f.n - 5));
  fails.set(ip, f); if (fails.size > 500) fails.clear();
}
export const loginOk = (ip) => fails.delete(ip);
