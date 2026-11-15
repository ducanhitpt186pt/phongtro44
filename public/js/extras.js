// Nút "Tải lại dữ liệu" nổi theo trang + số thông báo trên biểu tượng ứng dụng (màn hình chính).
import { html, raw, toast, openModal } from './util.js';
import { S, loadData, api } from './api.js';
import { acts, rerender } from './ui.js';
import { icon } from './icons.js';
import { isStandalone } from './a2hs.js';

// ---- Nút tải lại dữ liệu (luôn nằm ở mép phải màn hình, kéo trang đến đâu cũng thấy) ----
export const refreshFab = () => html`<button class="refresh-fab" type="button" data-act="reload-data" title="Tải lại dữ liệu mới nhất (khi máy khác vừa nhập liệu)" aria-label="Tải lại dữ liệu">${raw(icon('rotate', '1.35em'))}<span class="fab-t">Tải lại dữ liệu</span></button>`;
let reloading = false;
export async function reloadData({ silent = false } = {}) {
  if (reloading) return; reloading = true; const btn = document.querySelector('.refresh-fab'); if (btn) btn.classList.add('spin');
  const y = window.scrollY;
  try {
    if (S.loggedIn) { await loadData(); rerender(); }
    else { const { loadPublic } = await import('./views/public.js'); S.pub = null; await loadPublic(); }
    window.scrollTo(0, y);
    if (!silent) toast('Đã tải dữ liệu mới nhất');
  } catch (e) { if (!silent) toast(`Chưa tải lại được: ${e.message}`, 'err'); }
  finally { reloading = false; const b = document.querySelector('.refresh-fab'); if (b) b.classList.remove('spin'); }
}
acts['reload-data'] = () => reloadData();
// Quay lại ứng dụng (mở lại tab / mở lại app từ màn hình chính) => tự lấy dữ liệu mới, trừ khi đang mở hộp nhập liệu
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (!S.loggedIn || !S.snap || Date.now() - hiddenAt < 15000) return;
  if (document.querySelector('#modal .dialog')) return;
  reloadData({ silent: true });
});

// ---- Số thông báo trên biểu tượng ứng dụng ----
// iPhone/iPad (iOS 16.4+): chỉ hiện khi đã "Thêm vào màn hình chính", mở bằng biểu tượng đó và đã cho phép Thông báo.
// Android/máy tính (Chrome, Edge): hiện khi đã cài ứng dụng.
export const badgeSupported = () => 'setAppBadge' in navigator;
const needsPermission = () => 'Notification' in window && Notification.permission !== 'granted';
export function setBadge(n) {
  if (!badgeSupported()) return;
  try { (n > 0 ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch { /* trình duyệt không hỗ trợ */ }
}
// ---- Thông báo đẩy mỗi sáng (cập nhật số trên icon cả khi app đang đóng) ----
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const ua = () => navigator.userAgent || '';
const isIOS = () => /iPhone|iPad|iPod/.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const deviceName = () => (/iPad/.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'iPad' : /iPhone/.test(ua()) ? 'iPhone' : /Android/.test(ua()) ? 'Android' : 'Máy tính');
const keyBytes = (b64) => { const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
export async function pushState() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try { const reg = await navigator.serviceWorker.getRegistration('/'); const sub = reg && await reg.pushManager.getSubscription(); return sub && Notification.permission === 'granted' ? 'on' : 'off'; } catch { return 'off'; }
}
export async function enablePush() {
  if (!pushSupported()) {
    if (isIOS() && !isStandalone()) throw new Error('Trên iPhone/iPad: hãy "Thêm vào màn hình chính" trước, rồi mở web bằng biểu tượng Nhà trọ 44 trên màn hình chính và bấm lại nút này.');
    throw new Error('Trình duyệt này chưa hỗ trợ thông báo đẩy. iPhone/iPad cần iOS 16.4 trở lên và mở bằng biểu tượng trên màn hình chính.');
  }
  const perm = await Notification.requestPermission(); // phải gọi ngay khi bấm nút (iPhone yêu cầu)
  if (perm !== 'granted') throw Object.assign(new Error('Bạn chưa cho phép thông báo'), { denied: true });
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' }); await navigator.serviceWorker.ready;
  const { publicKey } = await api('POST', 'push/key', {});
  let sub = await reg.pushManager.getSubscription();
  const same = sub && sub.options?.applicationServerKey && btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') === publicKey;
  if (sub && !same) { try { await sub.unsubscribe(); } catch { /* bỏ qua */ } sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  await api('POST', 'push/subscribe', { subscription: sub.toJSON(), device: deviceName() });
  setBadge(S.lastBadge || 0); return true;
}
export async function disablePush() {
  const reg = await navigator.serviceWorker?.getRegistration('/'); const sub = reg && await reg.pushManager.getSubscription();
  if (sub) { try { await api('POST', 'push/unsubscribe', { endpoint: sub.endpoint }); } catch { /* bỏ qua */ } await sub.unsubscribe(); }
}
const deniedHelp = () => openModal('Chưa bật được thông báo', html`<p style="margin-top:0">Máy đang <b>chặn thông báo</b> của Nhà trọ 44. Muốn bật lại trên iPhone/iPad:</p><ol class="small" style="padding-left:20px;line-height:1.7"><li>Mở <b>Cài đặt</b> của iPhone.</li><li>Kéo xuống chọn <b>Thông báo</b>.</li><li>Tìm và bấm <b>Nhà trọ 44</b>.</li><li>Bật <b>Cho phép thông báo</b>, bật <b>Kí hiệu</b> (số trên icon) và <b>Màn hình khóa</b>.</li><li>Mở lại app Nhà trọ 44, vào tab <b>Sao lưu</b> → bấm <b>Bật thông báo trên máy này</b>.</li></ol>`);
async function doEnable(el) {
  if (el) el.disabled = true;
  try { await enablePush(); document.querySelectorAll('.badge-chip').forEach((x) => (x.hidden = true)); toast('Đã bật: mỗi sáng sẽ có thông báo và số trên biểu tượng app khi còn việc cần xử lý'); rerender(); }
  catch (e) { if (e.denied || Notification?.permission === 'denied') deniedHelp(); else toast(e.message, 'err'); }
  finally { if (el) el.disabled = false; }
}
acts['push-enable'] = (el) => doEnable(el);
acts['push-test'] = async (el) => { el.disabled = true; try { const j = await api('POST', 'push/test', {}); toast(j.sent ? `Đã gửi thử tới ${j.sent} máy – xem trên màn hình khóa` : `Chưa gửi được: ${j.skipped || j.error || 'không có máy nào bật thông báo'}`, j.sent ? 'ok' : 'err'); await loadData(); rerender(); } catch (e) { toast(e.message, 'err'); } finally { el.disabled = false; } };
acts['push-disable'] = async (el) => { el.disabled = true; try { await disablePush(); toast('Đã tắt thông báo trên máy này'); await loadData(); rerender(); } catch (e) { toast(e.message, 'err'); } finally { el.disabled = false; } };
// Thẻ cài đặt trong tab Sao lưu
export function pushCard() {
  const st = S.snap?.push || {}; const id = 'pushstate';
  setTimeout(async () => { const el = document.getElementById(id); if (!el) return; const v = await pushState(); el.innerHTML = { on: '✅ Máy này <b>đang bật</b> thông báo.', off: 'Máy này <b>chưa bật</b> thông báo.', denied: '⛔ Máy này đang <b>chặn</b> thông báo (bật lại trong Cài đặt của máy).', unsupported: isIOS() && !isStandalone() ? 'Đang mở bằng Safari: hãy <b>Thêm vào màn hình chính</b> rồi mở bằng biểu tượng đó mới bật được.' : 'Trình duyệt này chưa hỗ trợ thông báo đẩy.' }[v]; const on = v === 'on'; document.querySelectorAll('[data-pushon]').forEach((b) => (b.hidden = !on)); document.querySelectorAll('[data-pushoff]').forEach((b) => (b.hidden = on)); }, 0);
  return html`<section class="card" style="margin-top:12px"><h3>${raw(icon('bell', '1.2em'))} Thông báo mỗi sáng (số trên biểu tượng app)</h3>
    <p class="muted small" style="margin:6px 0">Mỗi sáng khoảng <b>7 giờ</b>, nếu còn việc cần xử lý (chưa thu tiền, cần ghi điện nước, nhắc nợ…), máy chủ gửi <b>1 tin lên màn hình khóa</b> và cập nhật <b>số trên biểu tượng app</b> – kể cả khi không mở app. Hết việc thì gửi 1 tin báo xong và xóa số, sau đó không gửi nữa.</p>
    <p style="margin:6px 0" id="${id}">Đang kiểm tra…</p>
    <p class="muted small" style="margin:6px 0">Số máy đã bật: <b>${st.subs || 0}</b>${st.lastSent ? html` · Gửi gần nhất: <b>${st.lastSent.split('-').reverse().join('/')}</b>` : ''}${st.lastResult ? html`<br>Kết quả lần gửi gần nhất: ${st.lastResult}` : ''}</p>
    <div class="row"><button class="btn primary" data-act="push-enable" data-pushoff>${raw(icon('bell', '1.1em'))} Bật thông báo trên máy này</button><button class="btn" data-act="push-test" data-pushon hidden>Gửi thử ngay</button><button class="btn danger" data-act="push-disable" data-pushon hidden>Tắt trên máy này</button></div>
    <p class="muted small" style="margin:8px 0 0">iPhone/iPad: cần iOS 16.4 trở lên, đã <b>Thêm vào màn hình chính</b> và mở app bằng biểu tượng đó. Mỗi máy (iPhone, iPad…) bật riêng một lần.</p></section>`;
}
// Nút nhỏ "Bật số báo trên biểu tượng" – chỉ hiện khi đang mở từ màn hình chính và chưa cho phép
export const badgeChip = () => (badgeSupported() && isStandalone() && needsPermission() && Notification.permission !== 'denied'
  ? html`<button class="a2hs-chip badge-chip" type="button" data-act="push-enable">${raw(icon('bell', '1.1em'))}<span>Bật thông báo</span></button>` : '');
acts['badge-enable'] = async () => {
  if (!('Notification' in window)) { toast('Máy này chưa hỗ trợ số báo trên biểu tượng', 'err'); return; }
  let p = 'default'; try { p = await Notification.requestPermission(); } catch { /* bỏ qua */ }
  document.querySelectorAll('.badge-chip').forEach((el) => (el.hidden = true));
  if (p === 'granted') { setBadge(S.lastBadge || 0); toast('Đã bật: số thông báo sẽ hiện trên biểu tượng ứng dụng'); }
  else openModal('Chưa bật được số báo', html`<p style="margin-top:0">Bạn đã chọn <b>Không cho phép</b>. Muốn bật lại trên iPhone/iPad:</p><ol class="small" style="padding-left:20px;line-height:1.7"><li>Mở <b>Cài đặt</b> của iPhone.</li><li>Kéo xuống chọn <b>Thông báo</b>.</li><li>Tìm và bấm <b>Nhà trọ 44</b>.</li><li>Bật <b>Cho phép thông báo</b> và bật <b>Kí hiệu</b> (Badges).</li></ol>`);
};
export function updateBadge(n) { S.lastBadge = n; setBadge(n); }
// Mỗi lần đăng nhập trên máy đã cho phép: tự giữ đăng ký thông báo còn hiệu lực (không hỏi lại)
let autoDone = false;
export function autoPush() { if (autoDone || !S.loggedIn || !pushSupported() || Notification.permission !== 'granted') return; autoDone = true; enablePush().catch(() => { autoDone = false; }); }
