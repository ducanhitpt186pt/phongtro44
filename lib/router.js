import { ApiError } from './errors.js';
import { checkPassword, clearCookie, createSession, loginFailed, loginGuard, loginOk, readSession, requireSession, sessionCookie } from './auth.js';
import { readJson, send } from './http.js';
import { H } from './handlers/index.js';
import { readDbCached, getTokenExpiry, driverInfo } from './store.js';
import { storageInfo } from './cleanup.js';
import { buildSystem } from './health.js';
import { publicReminders } from './reminders.js';
import { todayVN } from './dates.js';

const ip = (req) => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
const LISTS = new Set(['rooms', 'tenants', 'invoices', 'payments', 'readings']);

export async function handle(req, res) {
  const u = new URL(req.url, 'http://x');
  const path = u.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
  const seg = path.split('/');
  const m = req.method;
  const q = Object.fromEntries(u.searchParams);
  res.setHeader('Cache-Control', 'no-store');

  // ---- CÔNG KHAI (chỉ đọc, chỉ dữ liệu tổng hợp đã lọc) ----
  if (path === 'public/reminders' && m === 'GET') {
    const db = await readDbCached(20000);
    const today = todayVN();
    return send(res, 200, { ok: true, ...publicReminders(db, today), system: buildSystem({ today, tokenExpires: getTokenExpiry(), storage: storageInfo(db, today), db: driverInfo() }) }, { 'Cache-Control': 'public, s-maxage=20' });
  }
  // ---- XÁC THỰC ----
  if (path === 'auth/login' && m === 'POST') {
    const a = ip(req); loginGuard(a);
    const body = await readJson(req);
    await new Promise((r) => setTimeout(r, 400));
    if (!checkPassword(String(body.password || ''))) { loginFailed(a); throw new ApiError(401, 'Mật khẩu không chính xác', 'BAD_PASSWORD'); }
    loginOk(a);
    const s = createSession();
    return send(res, 200, { ok: true, csrf: s.csrf }, { 'Set-Cookie': sessionCookie(s.token) });
  }
  if (path === 'auth/logout' && m === 'POST') return send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });
  if (path === 'auth/session' && m === 'GET') { const s = readSession(req); return send(res, 200, { ok: true, loggedIn: !!s, csrf: s?.csrf || null }); }

  // ---- TỪ ĐÂY TRỞ XUỐNG: BẮT BUỘC ĐĂNG NHẬP (kiểm tra ở backend) ----
  requireSession(req, { write: m !== 'GET' && m !== 'HEAD' });
  const body = m === 'GET' || m === 'DELETE' || path.startsWith('storage/upload') ? {} : await readJson(req);

  if (path === 'data' && m === 'GET') return send(res, 200, await H.data());
  if (seg.length === 1 && LISTS.has(seg[0]) && m === 'GET') return send(res, 200, await H.list(seg[0]));
  if (path === 'rooms' && m === 'POST') return send(res, 200, await H.rooms.create(body));
  if (seg[0] === 'rooms' && seg[1] && m === 'PUT') return send(res, 200, await H.rooms.update(seg[1], body));
  if (path === 'tenants' && m === 'POST') return send(res, 200, await H.tenants.moveIn(body));
  if (seg[0] === 'tenants' && seg[1] && m === 'PUT') return send(res, 200, await H.tenants.update(seg[1], body));
  if (seg[0] === 'rentals' && seg[2] === 'price' && m === 'POST') return send(res, 200, await H.rentals.price(seg[1], body));
  if ((path === 'readings' || path === 'invoices') && m === 'POST') return send(res, 200, await H.invoices.create(body));
  if (seg[0] === 'invoices' && seg[1] && m === 'PUT') return send(res, 200, await H.invoices.adjust(seg[1], body));
  if (path === 'payments' && m === 'POST') return send(res, 200, await H.payments.create(body));
  if (seg[0] === 'payments' && seg[2] === 'void' && m === 'POST') return send(res, 200, await H.payments.void(seg[1], body));
  if (path === 'notes' && m === 'PUT') return send(res, 200, await H.notes.save(body));
  if (path === 'checkout/preview' && m === 'POST') return send(res, 200, await H.checkout.preview(body));
  if (path === 'checkout' && m === 'POST') return send(res, 200, await H.checkout.confirm(body));
  if (seg[0] === 'checkout' && seg[2] === 'refunded' && m === 'POST') return send(res, 200, await H.checkout.refunded(seg[1], body));
  if (path === 'transfer' && m === 'POST') return send(res, 200, await H.transfer(body));
  if (path === 'reports' && m === 'GET') return send(res, 200, await H.reports(q));
  if (path === 'cleanup' && m === 'POST') return send(res, 200, await H.cleanup.run(body));
  if (path === 'backup/export' && m === 'GET') { const db = await H.backup.export(); return send(res, 200, db, { 'Content-Disposition': `attachment; filename="nha-tro-44-${todayVN()}.json"` }); }
  if (path === 'backup/restore' && m === 'POST') return send(res, 200, await H.backup.restore(body));
  if (path === 'storage/upload' && m === 'POST') return send(res, 200, await H.storage.upload(req, q));
  if (seg[0] === 'storage' && seg[1] && m === 'GET') return H.storage.stream(seg[1], q, res);
  if (seg[0] === 'storage' && seg[1] && m === 'DELETE') return send(res, 200, await H.storage.remove(seg[1]));
  throw new ApiError(404, 'Không có API này', 'NO_ROUTE');
}

export async function entry(req, res) {
  try { await handle(req, res); }
  catch (e) {
    const status = e.status || 500;
    if (!(e instanceof ApiError)) console.error('LỖI:', e);
    if (res.headersSent) return res.end();
    send(res, status, { ok: false, error: e instanceof ApiError || e.code === 'CONFIG' ? e.message : 'Lỗi máy chủ không xác định. Dữ liệu có thể chưa được lưu.', code: e.code || 'SERVER', ...(e.extra?.cause ? {} : e.extra || {}) });
  }
}
