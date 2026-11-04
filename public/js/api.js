import { toast } from './util.js';
export const S = { loggedIn: false, csrf: null, snap: null, pub: null, sysError: null, apiMode: 'direct' };
// Địa chỉ API. 'direct' = /api/<đường dẫn>; 'index' = /api/index?path=<đường dẫn> (dùng khi Vercel không nhận đường dẫn trực tiếp).
export function apiUrl(path, mode = S.apiMode) {
  if (mode !== 'index') return `/api/${path}`;
  const [p, qs] = path.split('?'); return `/api/index?path=${encodeURIComponent(p)}${qs ? `&${qs}` : ''}`;
}
const isJson = (res) => (res.headers.get('content-type') || '').includes('json');
async function doFetch(path, opts) {
  let res = await fetch(apiUrl(path), opts);
  if (res.status === 404 && !isJson(res)) { // 404 của nền tảng (không phải của ứng dụng): thử đường dẫn còn lại
    const alt = S.apiMode === 'index' ? 'direct' : 'index'; const r2 = await fetch(apiUrl(path, alt), opts);
    if (r2.status !== 404 || isJson(r2)) { S.apiMode = alt; return r2; }
  }
  return res;
}
export async function diagnose() {
  const t = async (u) => { try { const r = await fetch(u); return `${u} → ${r.status}${isJson(r) ? ' (JSON – máy chủ chạy)' : ' (không phải JSON)'}`; } catch { return `${u} → không kết nối được`; } };
  return [await t('/api/health'), await t('/api/index?path=health')];
}
let onUnauth = () => {};
export const setUnauthHandler = (f) => (onUnauth = f);
export async function api(method, path, body, { raw = false, headers = {}, signal } = {}) {
  const h = { ...headers }; if (S.csrf && method !== 'GET') h['X-CSRF-Token'] = S.csrf;
  let payload;
  if (body instanceof Blob) payload = body; else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try { res = await doFetch(path, { method, headers: h, body: payload, credentials: 'same-origin', signal }); }
  catch { throw new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại. Dữ liệu CHƯA được lưu.'); }
  if (raw) return res;
  let j = null; try { j = await res.json(); } catch { /* không phải JSON */ }
  if (res.status === 401 && path !== 'auth/login') { S.loggedIn = false; onUnauth(); throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'); }
  if (!res.ok && j && /^(GITHUB|CONFIG|BLOB|REDIS|CONFLICT)/.test(j.code || '')) { S.sysError = j.error; window.dispatchEvent(new Event('sysstatus')); }
  else if (res.ok && method !== 'GET' && S.sysError) { S.sysError = null; window.dispatchEvent(new Event('sysstatus')); }
  if (!res.ok || !j || j.ok === false) throw new Error(j?.error || (res.status === 404 ? 'Không tìm thấy phần máy chủ (/api): Vercel chưa chạy thư mục api. Kiểm tra trên GitHub có api/index.js và vercel.json, xem Deployments có báo Error không, rồi Redeploy.' : `Lỗi máy chủ (${res.status}). Dữ liệu có thể chưa được lưu.`));
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
