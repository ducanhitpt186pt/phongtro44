import { toast } from './util.js';
export const S = { loggedIn: false, csrf: null, snap: null, pub: null, sysError: null };
let onUnauth = () => {};
export const setUnauthHandler = (f) => (onUnauth = f);
export async function api(method, path, body, { raw = false, headers = {}, signal } = {}) {
  const h = { ...headers }; if (S.csrf && method !== 'GET') h['X-CSRF-Token'] = S.csrf;
  let payload;
  if (body instanceof Blob) payload = body; else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try { res = await fetch(`/api/${path}`, { method, headers: h, body: payload, credentials: 'same-origin', signal }); }
  catch { throw new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại. Dữ liệu CHƯA được lưu.'); }
  if (raw) return res;
  let j = null; try { j = await res.json(); } catch { /* không phải JSON */ }
  if (res.status === 401 && path !== 'auth/login') { S.loggedIn = false; onUnauth(); throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'); }
  if (!res.ok && j && /^(GITHUB|CONFIG|BLOB|REDIS|CONFLICT)/.test(j.code || '')) { S.sysError = j.error; window.dispatchEvent(new Event('sysstatus')); }
  else if (res.ok && method !== 'GET' && S.sysError) { S.sysError = null; window.dispatchEvent(new Event('sysstatus')); }
  if (!res.ok || !j || j.ok === false) throw new Error(j?.error || `Lỗi máy chủ (${res.status}). Dữ liệu có thể chưa được lưu.`);
  if (j.db && j.derived) S.snap = j;
  return j;
}
// Thao tác ghi: thành công khi và chỉ khi máy chủ đã ghi được vào GitHub.
export async function save(method, path, body, okMsg = 'Đã lưu') {
  try { const j = await api(method, path, body); if (okMsg) toast(okMsg); return j; }
  catch (e) { toast(e.message, 'err'); e.handled = true; throw e; }
}
export async function loadSession() { const j = await api('GET', 'auth/session'); S.loggedIn = j.loggedIn; S.csrf = j.csrf; return j; }
export async function loadData() { return api('GET', 'data'); }
export const D = () => S.snap.db;
export const DV = () => S.snap.derived;
export const today = () => S.snap?.today || S.pub?.today;
// tiện ích truy vấn
export const room = (id) => D().rooms.find((r) => r.id === id);
export const tenant = (id) => D().tenants.find((t) => t.id === id);
export const activeRental = (roomId) => D().rentals.find((r) => r.roomId === roomId && r.status === 'active');
export const latestInvOf = (chainId) => { const l = D().invoices.filter((i) => i.chainId === chainId); return l[l.length - 1]; };
export const invD = (id) => DV().invoices[id];
