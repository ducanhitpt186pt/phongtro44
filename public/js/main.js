import { html, $, weekday, dmy, toast, closeModal } from './util.js';
import { S, api, loadSession, loadData, setUnauthHandler, today, D, DV } from './api.js';
import { acts, go, initEvents, setRender } from './ui.js';
import { lunarText } from './lunar.js';
import { stripHtml } from './views/strip.js';
import { icon } from './icons.js';
import { raw } from './util.js';
import { publicView, loginView, loadPublic } from './views/public.js';
import { dashboardView } from './views/dashboard.js';
import { roomView } from './views/room.js';
import { tenantsView, tenantView } from './views/tenants.js';
import { invoiceView } from './views/invoice.js';
import { reportsView, backupView } from './views/reports.js';
import { calendarView, eventBanner } from './views/calendar.js';

const app = () => $('#app');
let timer = null;

function shell(active, inner) {
  const n = DV().reminders.length + DV().usage.alerts.length;
  const t = today();
  const nav = [['dashboard', 'Tổng quan', 'home'], ['tenants', 'Khách thuê', 'users'], ['calendar', 'Lịch', 'calendar'], ['reports', 'Báo cáo', 'chart'], ['backup', 'Sao lưu', 'shield']];
  return html`<div class="top"><div class="in"><div class="tl"><h1>NHÀ TRỌ 44 LÊ VĂN PHẤN<span class="credit">ducanhitpt186</span></h1><div id="strip">${stripHtml(S.snap.system, { link: true })}</div>
    <div class="dt">${weekday(t)}, ${dmy(t)}<br>Âm lịch: ${lunarText(t)}</div></div>
    <div class="tr"><a class="bell" href="#/dashboard" title="Thông báo">${raw(icon('bell', '1em'))} ${n}</a><button class="btn sm" data-act="logout">Đăng xuất</button></div></div></div>
    <nav class="nav"><div class="in">${nav.map(([k, l, ic]) => html`<a href="#/${k}" class="${active === k ? 'on' : ''}">${raw(icon(ic, '1.35em'))}<span>${l}</span></a>`)}</div></nav>
    <main class="wrap">${raw(eventBanner(S.snap.db.events, t))}${inner}</main>`.s;
}

async function render() {
  clearInterval(timer);
  const [name, id] = location.hash.replace(/^#\/?/, '').split('/');
  window.scrollTo(0, 0);
  if (!S.loggedIn) {
    if (name === 'login') return loginView(app());
    await publicView(app());
    timer = setInterval(() => { if (!document.hidden && !S.loggedIn) loadPublic(); }, 60000);
    return;
  }
  if (name === 'login') return go('#/dashboard');
  if (!S.snap) { try { await loadData(); } catch (e) { app().innerHTML = html`<main class="wrap narrow"><div class="err-box"><b>Không tải được dữ liệu.</b><br>${e.message}<br><button class="btn sm" data-act="retry-load" style="margin-top:8px">Thử lại</button></div></main>`.s; return; } }
  const views = {
    '': ['dashboard', () => dashboardView()], dashboard: ['dashboard', () => dashboardView()],
    room: ['dashboard', () => roomView(id)], tenants: ['tenants', () => tenantsView()], tenant: ['tenants', () => tenantView(id)],
    invoice: ['dashboard', () => invoiceView(id)], reports: ['reports', () => reportsView()], calendar: ['calendar', () => calendarView()], backup: ['backup', () => backupView()],
  };
  const v = views[name] || views.dashboard;
  const out = v[1]();
  app().innerHTML = shell(v[0], out);
  if (out.after) out.after();
}
window.addEventListener('sysstatus', () => { const el = $('#strip'); if (el) el.innerHTML = stripHtml(S.snap?.system || S.pub?.system, { link: S.loggedIn }).s; });
acts['retry-load'] = () => render();
acts.logout = async () => { try { await api('POST', 'auth/logout', {}); } catch { /* bỏ qua */ } S.loggedIn = false; S.csrf = null; S.snap = null; go('#/'); toast('Đã đăng xuất'); };
acts['open-room'] = (el) => go(`#/room/${el.dataset.id}`);
setUnauthHandler(() => { S.snap = null; go('#/login'); toast('Phiên đăng nhập đã hết (5 phút không hoạt động). Vui lòng đăng nhập lại.', 'err'); });
// Nhịp "còn đang dùng": chỉ gia hạn phiên khi người dùng thực sự thao tác trong 4,5 phút gần đây
let lastAct = Date.now(); ['pointerdown', 'keydown', 'touchstart', 'scroll', 'input', 'change'].forEach((e) => addEventListener(e, () => { lastAct = Date.now(); }, { passive: true, capture: true }));
setInterval(() => { if (S.loggedIn && Date.now() - lastAct < 270000) api('POST', 'auth/ping', {}).catch(() => {}); }, 60000);

(async function boot() {
  initEvents(); setRender(render);
  try { await loadSession(); } catch { /* chưa đăng nhập */ }
  window.addEventListener('hashchange', () => { closeModal(); render(); }); // chuyển trang thì đóng hộp thoại đang mở
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !S.loggedIn && !location.hash.includes('login')) loadPublic(); });
  render();
})();
