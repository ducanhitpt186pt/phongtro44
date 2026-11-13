import { html, raw, openModal, closeModal, vnd, dmy, monthLabel, weekday, esc, $, toast } from '../util.js';
import { S, api, diagnose } from '../api.js';
import { APP_VERSION } from '../version.js';
import { lunarText } from '../lunar.js';
import { acts, forms, go } from '../ui.js';
import { usageBar, alertsHtml, footStrip, refreshStatus } from './strip.js';
import { a2hsButton } from '../a2hs.js';
import { usagePanel } from './usage.js';
import { calendarPanel, eventBanner, eventsAheadList } from './calendar.js';
import { icon, ROOM_ICON, ROOM_TONE } from '../icons.js';
import { ROOM_STATUS } from '../util.js';

const LEVEL = { red: 'red', orange: 'orange', blue: 'blue', green: 'green' };
export function noticeCard(it, { link = false, tenantName = '', actions = false } = {}) {
  const per = it.period || it.periodLabel; const m$ = (n) => html`<span class="money">${vnd(n)}</span>`;
  const rows = [];
  if (it.type === 'need_readings') rows.push(['Kỳ thanh toán', monthLabel(per)], ['Trạng thái', 'Chưa ghi chỉ số điện nước'], ['Ngày cần xử lý', dmy(it.dueDate)]);
  else if (it.type === 'upcoming') rows.push(['Kỳ thanh toán', monthLabel(per)], ['Trạng thái', 'Sắp đến ngày thu tiền'], ['Ngày đến hạn', dmy(it.dueDate)]);
  else if (it.type === 'refund_pending') rows.push(['Trạng thái', 'Cần hoàn tiền cho khách đã trả phòng'], ['Số tiền cần hoàn', m$(it.remaining)], ['Ngày trả phòng', dmy(it.dueDate)]);
  else { rows.push(['Kỳ thanh toán', monthLabel(per)], ['Trạng thái', it.label]); if (it.months?.length) rows.push(['Chưa thanh toán', it.months.map((m) => `Tháng ${Number(m.ym.slice(5))}`).join(', ')]); rows.push(['Tổng tiền', m$(it.total)], ['Đã thanh toán', m$(it.paid)], ['Còn phải thu', m$(it.remaining)], ['Ngày đến hạn', dmy(it.dueDate)]); }
  const paying = ['overdue', 'debt', 'unpaid', 'partial', 'ended_debt'].includes(it.type) && it.invoiceId;
  const btns = !actions ? '' : html`<div class="nact">${paying ? html`<button class="btn green sm" data-act="pay" data-id="${it.invoiceId}">${icon('check', '1.1em')} Đã nhận tiền</button>` : ''}${['need_readings', 'upcoming'].includes(it.type) && it.rentalId ? html`<button class="btn red sm" data-act="readings" data-id="${it.rentalId}">${icon('bolt', '1.1em')} Tính tiền</button>` : ''}${it.type === 'refund_pending' && it.recordId ? html`<button class="btn green sm" data-act="refunded" data-id="${it.recordId}">${icon('check', '1.1em')} Đã hoàn tiền</button>` : ''}</div>`;
  return html`<article class="note ${LEVEL[it.level] || ''} ${link ? 'link' : ''}" ${link ? raw(`data-act="open-room" data-id="${esc(it.roomId)}"`) : ''}>
    <h3>${String(it.roomName).toUpperCase()}${tenantName ? html` <span class="muted small">· ${tenantName}</span>` : ''}</h3>
    <dl>${rows.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>
    ${it.also?.length ? html`<div class="also">Đồng thời: ${it.also.join('; ')}</div>` : ''}${btns}</article>`;
}

function rosterCard(r) {
  const tone = ROOM_TONE[r.status];
  const sub = { empty: 'Phòng trống – sẵn sàng cho thuê', repair: 'Đang sửa chữa', notready: 'Đang sửa chữa hoặc đang sử dụng' }[r.status];
  return html`<article class="card click room-card st-${tone}" data-act="pub-room" data-id="${r.roomId}" data-name="${r.roomName}"><div class="rhead"><span class="rbadge ${tone}">${raw(icon(ROOM_ICON[r.status], '1.6em'))}</span><div class="sp"><h3>${r.roomName}</h3><span class="badge ${tone}">${ROOM_STATUS[r.status]}</span></div></div>
    ${r.startDate ? html`<dl class="kv"><dt>Ngày vào</dt><dd>${dmy(r.startDate)}</dd>${r.tenantName !== undefined ? html`<dt>Khách</dt><dd class="big">${r.tenantName}</dd>` : ''}<dt>Số người</dt><dd>${r.people}</dd><dt>Nợ</dt><dd class="${r.debt ? 'owe' : 'okc'}">${vnd(r.debt)}</dd>${r.note ? html`<dt>Ghi chú</dt><dd>${r.note}</dd>` : ''}</dl>` : html`<div class="rempty ${tone}"><b>${sub}</b></div>`}</article>`;
}
export function dateBlock(today) { return html`<div class="pub-date">${weekday(today)}, ngày ${dmy(today)}</div><div class="pub-lunar">Âm lịch: ${lunarText(today)}</div>`; }

export async function publicView(app) {
  app.innerHTML = html`<header class="hero"><a class="login-top" href="#/login"><span class="btn sm">${icon('login', '1.1em')} Đăng nhập</span></a><div class="hero-in"><h1>NHÀ TRỌ 44 LÊ VĂN PHẤN<span class="credit">ducanhitpt186</span></h1><div id="ubar">${usageBar(null)}</div><div id="alerts"></div><div id="pubdate"></div></div></header>
    <main class="wrap narrow"><div id="pubbanner"></div><div id="pubbody"><p class="boot">Đang tải thông báo…</p></div>
    <div id="pubcal" style="margin-top:20px"></div>
    <div id="a2hs">${a2hsButton()}</div>
    <footer class="page-foot"><div id="footstrip"></div><div class="upd" id="upd"></div><div class="upd">Phiên bản giao diện: ${APP_VERSION}</div></footer></main>`.s;
  await loadPublic();
}
const CACHE = 'nt44_pub_v1'; // chỉ lưu dữ liệu thông báo ĐÃ LỌC (không có thông tin khách) để mở trang là hiện ngay / xem được khi mất mạng
const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE)); } catch { return null; } };
function paint(res, note = '') {
  const body = $('#pubbody'); if (!body) return;
  S.pub = res; const s = res.summary, items = res.items;
  $('#pubbanner').innerHTML = eventBanner(res.events, res.today).s; $('#pubcal').innerHTML = calendarPanel().s;
  $('#pubdate').innerHTML = dateBlock(res.today).s; refreshStatus(res.system);
  body.innerHTML = html`<div class="sum-title sumrow"><span>TỔNG QUAN CẦN XỬ LÝ</span>${items.length ? '' : html`<span class="okpill">${icon('check', '1.1em')} Không có việc cần xử lý</span>`}</div>
    <div class="stats">
      <div class="stat wide rooms3"><div><b>${s.rooms}</b><span>Tổng số phòng</span></div><div><b>${s.rented}</b><span>Đang cho thuê</span></div><div><b>${s.closed}</b><span>Đang đóng</span></div></div>
      <div class="stat ${s.needReadings ? 'orange' : ''}"><b>${s.needReadings}</b><span>phòng cần ghi điện nước</span></div>
      <div class="stat redtxt"><b>${s.unpaidRooms}</b><span>phòng chưa thanh toán đủ</span></div>
      <div class="stat wide redtxt"><b>${vnd(s.totalRemaining)}</b><span>tổng tiền còn cần thu</span></div>
    </div>
    ${items.length ? html`<div class="notices">${items.map((i) => noticeCard(i))}</div>` : ''}
    ${eventsAheadList(res.events, res.today)}
    ${usagePanel(res.usage)}
    <div class="sum-title" style="margin-top:26px">DANH SÁCH PHÒNG</div>
    <div class="notices" style="margin-top:0">${(res.roster || []).map(rosterCard)}</div>`.s;
  const u = $('#upd'); if (u) u.textContent = note || `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
}
export async function loadPublic() {
  const body = $('#pubbody'); if (!body) return;
  const cached = readCache(); if (cached && !S.pub) paint(cached.res, `Đang cập nhật… (bản lưu lúc ${new Date(cached.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`);
  try {
    const res = await api('GET', 'public/reminders'); S.pub = res; paint(res);
    try { localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), res })); } catch { /* bộ nhớ trình duyệt đầy/bị chặn: bỏ qua */ }
  } catch (e) {
    const sp = $('#alerts'); if (sp) sp.innerHTML = alertsHtml({ alerts: [{ level: 'red', text: e.message }] }).s;
    if (cached) paint(cached.res, `Không kết nối được máy chủ – đang hiển thị bản lưu trên máy lúc ${new Date(cached.at).toLocaleString('vi-VN')}`);
    else {
      body.innerHTML = html`<div class="err-box"><b>Chưa tải được thông báo.</b><br>${e.message}<div id="diag" class="small" style="margin-top:8px"></div><button class="btn sm" data-act="reload-public" style="margin-top:8px">Thử lại</button></div>`.s;
      diagnose().then((l) => { const d = $('#diag'); if (d) d.innerHTML = html`<b>Tự kiểm tra:</b><br>${l.map((x) => html`${x}<br>`)}`.s; });
    }
  }
}
acts['reload-public'] = () => loadPublic();

export function loginView(app) {
  app.innerHTML = html`<main class="login"><h1>NHÀ TRỌ 44 LÊ VĂN PHẤN<span class="credit">ducanhitpt186</span></h1>
    <form data-form="login" autocomplete="on"><input type="password" name="password" placeholder="Nhập mật khẩu" autocomplete="current-password" required autofocus aria-label="Mật khẩu">
    <div class="msg err-inline" role="alert"></div><button class="btn primary block" type="submit">ĐĂNG NHẬP</button>
    <a href="#/" class="muted small">← Xem thông báo</a></form></main>`.s;
}
forms.login = async (f, fd) => {
  const j = await api('POST', 'auth/login', { password: fd.get('password') });
  S.loggedIn = true; S.csrf = j.csrf; S.snap = null; try { sessionStorage.setItem('nt44_tab', '1'); } catch { /* chỉ là cờ, không chứa bí mật */ }
  const to = S.afterLogin || '#/dashboard'; S.afterLogin = null; go(to);
  if (S.afterLoginAct) { const a = S.afterLoginAct; S.afterLoginAct = null; const wait = setInterval(() => { if (S.snap) { clearInterval(wait); acts[a]?.({ dataset: {} }); } }, 200); setTimeout(() => clearInterval(wait), 8000); }
};
acts['pub-room'] = (el) => openModal(`Đăng nhập để xem ${el.dataset.name}`, html`<p style="margin-top:0">Bạn cần <b>đăng nhập</b> mới xem được chi tiết <b>${el.dataset.name}</b>.</p><button class="btn primary block" data-act="pub-login" data-target="#/room/${el.dataset.id}">${icon('login', '1.2em')} Đăng nhập</button>`);
acts['pub-login'] = (el) => { S.afterLogin = el.dataset.target || null; closeModal(); go('#/login'); };
acts['pub-add-event'] = () => { S.afterLogin = '#/dashboard'; S.afterLoginAct = 'ev-add'; openModal('Nhập mật khẩu để thêm sự kiện', html`<form data-form="login"><input type="password" name="password" placeholder="Nhập mật khẩu" autocomplete="current-password" required autofocus aria-label="Mật khẩu"><div class="err-inline"></div><button class="btn primary block" type="submit">${icon('login', '1.2em')} ĐĂNG NHẬP & THÊM SỰ KIỆN</button></form>`); };
