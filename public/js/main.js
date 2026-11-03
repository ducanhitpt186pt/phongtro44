import { html, $, weekday, dmy, toast } from './util.js';
import { S, api, loadSession, loadData, setUnauthHandler, today, D, DV } from './api.js';
import { acts, go, initEvents, setRender } from './ui.js';
import { lunarText } from './lunar.js';
import { stripHtml } from './views/strip.js';
import { publicView, loginView, loadPublic } from './views/public.js';
import { dashboardView } from './views/dashboard.js';
import { roomView } from './views/room.js';
import { tenantsView, tenantView } from './views/tenants.js';
import { invoiceView } from './views/invoice.js';
import { reportsView, backupView } from './views/reports.js';

const app = () => $('#app');
let timer = null;

function shell(active, inner) {
  const n = DV().reminders.length;
  const t = today();
  return html`<div class="top"><div class="in"><div style="margin-right:auto"><h1>NHÀ TRỌ 44 LÊ VĂN PHẤN<span class="credit">ducanhitpt186</span></h1><div id="strip">${stripHtml(S.snap.system, { link: true })}</div></div>
    <a class="bell" href="#/dashboard" style="color:#fff" title="Thông báo">🔔 ${n}</a>
    <div class="dt">${weekday(t)}, ${dmy(t)}<br>Âm lịch: ${lunarText(t)}</div>
    <button class="btn sm" data-act="logout">Đăng xuất</button></div></div>
    <nav class="nav"><div class="in">${[['dashboard', 'Tổng quan'], ['tenants', 'Khách thuê'], ['reports', 'Báo cáo'], ['backup', 'Sao lưu']].map(([k, l]) => html`<a href="#/${k}" class="${active === k ? 'on' : ''}">${l}</a>`)}</div></nav>
    <main class="wrap">${inner}</main>`.s;
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
    invoice: ['dashboard', () => invoiceView(id)], reports: ['reports', () => reportsView()], backup: ['backup', () => backupView()],
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
setUnauthHandler(() => { S.snap = null; go('#/login'); });

(async function boot() {
  initEvents(); setRender(render);
  try { await loadSession(); } catch { /* chưa đăng nhập */ }
  window.addEventListener('hashchange', render);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !S.loggedIn && !location.hash.includes('login')) loadPublic(); });
  render();
})();
