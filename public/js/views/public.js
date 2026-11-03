import { html, raw, vnd, dmy, monthLabel, weekday, esc, $, toast } from '../util.js';
import { S, api } from '../api.js';
import { lunarText } from '../lunar.js';
import { acts, forms, go } from '../ui.js';
import { stripHtml } from './strip.js';

const LEVEL = { red: 'red', orange: 'orange', blue: 'blue', green: 'green' };
export function noticeCard(it, { link = false, tenantName = '' } = {}) {
  const per = it.period || it.periodLabel;
  const rows = [];
  if (it.type === 'need_readings') rows.push(['Kỳ thanh toán', monthLabel(per)], ['Trạng thái', 'Chưa ghi chỉ số điện nước'], ['Ngày cần xử lý', dmy(it.dueDate)]);
  else if (it.type === 'upcoming') rows.push(['Kỳ thanh toán', monthLabel(per)], ['Trạng thái', 'Sắp đến ngày thu tiền'], ['Ngày đến hạn', dmy(it.dueDate)]);
  else if (it.type === 'refund_pending') rows.push(['Trạng thái', 'Cần hoàn tiền cho khách đã trả phòng'], ['Số tiền cần hoàn', vnd(it.remaining)], ['Ngày trả phòng', dmy(it.dueDate)]);
  else rows.push(['Kỳ thanh toán', monthLabel(per)], ['Trạng thái', it.label], ['Tổng tiền', vnd(it.total)], ['Đã thanh toán', vnd(it.paid)], ['Còn phải thu', vnd(it.remaining)], ['Ngày đến hạn', dmy(it.dueDate)]);
  return html`<article class="note ${LEVEL[it.level] || ''} ${link ? 'link' : ''}" ${link ? raw(`data-act="open-room" data-id="${esc(it.roomId)}"`) : ''}>
    <h3>${String(it.roomName).toUpperCase()}${tenantName ? html` <span class="muted small">· ${tenantName}</span>` : ''}</h3>
    <dl>${rows.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>
    ${it.also?.length ? html`<div class="also">Đồng thời: ${it.also.join('; ')}</div>` : ''}</article>`;
}

export function dateBlock(today) { return html`<div class="pub-date">${weekday(today)}, ngày ${dmy(today)}</div><div class="pub-lunar">Âm lịch: ${lunarText(today)}</div>`; }

export async function publicView(app) {
  app.innerHTML = html`<main class="wrap narrow"><header class="pub-head"><h1>NHÀ TRỌ 44 LÊ VĂN PHẤN<span class="credit">ducanhitpt186</span></h1><div id="strip"></div><div id="pubdate"></div></header><div id="pubbody"><p class="boot">Đang tải thông báo…</p></div>
    <div class="pub-foot"><a class="btn primary block" href="#/login">ĐĂNG NHẬP QUẢN LÝ</a><div class="upd" id="upd"></div></div></main>`.s;
  await loadPublic();
}
const CACHE = 'nt44_pub_v1'; // chỉ lưu dữ liệu thông báo ĐÃ LỌC (không có thông tin khách) để mở trang là hiện ngay / xem được khi mất mạng
const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE)); } catch { return null; } };
function paint(res, note = '') {
  const body = $('#pubbody'); if (!body) return;
  const s = res.summary, items = res.items;
  $('#pubdate').innerHTML = dateBlock(res.today).s; $('#strip').innerHTML = stripHtml(res.system).s;
  body.innerHTML = html`<div class="sum-title">TỔNG QUAN CẦN XỬ LÝ</div>
    <div class="stats">
      <div class="stat"><b>${s.rooms}</b><span>phòng đang quản lý</span></div>
      <div class="stat ${s.needReadings ? 'orange' : ''}"><b>${s.needReadings}</b><span>phòng cần ghi điện nước</span></div>
      <div class="stat ${s.unpaidRooms ? 'red' : ''}"><b>${s.unpaidRooms}</b><span>phòng chưa thanh toán đủ</span></div>
      <div class="stat ${s.overdue ? 'red' : ''}"><b>${s.overdue}</b><span>phòng đã quá hạn thanh toán</span></div>
      <div class="stat wide ${s.totalRemaining ? 'red' : ''}"><b>${vnd(s.totalRemaining)}</b><span>tổng tiền còn cần thu</span></div>
    </div>
    <div class="notices">${items.length ? items.map((i) => noticeCard(i)) : html`<div class="empty-state ok"><b>Không có việc cần xử lý.</b><br>Tất cả các phòng đã hoàn tất theo lịch.</div>`}</div>`.s;
  const u = $('#upd'); if (u) u.textContent = note || `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
}
export async function loadPublic() {
  const body = $('#pubbody'); if (!body) return;
  const cached = readCache(); if (cached && !S.pub) paint(cached.res, `Đang cập nhật… (bản lưu lúc ${new Date(cached.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`);
  try {
    const res = await api('GET', 'public/reminders'); S.pub = res; paint(res);
    try { localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), res })); } catch { /* bộ nhớ trình duyệt đầy/bị chặn: bỏ qua */ }
  } catch (e) {
    const sp = $('#strip'); if (sp) sp.innerHTML = stripHtml({ alerts: [{ level: 'red', text: e.message }] }).s;
    if (cached) paint(cached.res, `Không kết nối được máy chủ – đang hiển thị bản lưu trên máy lúc ${new Date(cached.at).toLocaleString('vi-VN')}`);
    else body.innerHTML = html`<div class="err-box"><b>Chưa tải được thông báo.</b><br>${e.message}<br><button class="btn sm" data-act="reload-public" style="margin-top:8px">Thử lại</button></div>`.s;
    if (cached) { const sp2 = $('#strip'); if (sp2) sp2.innerHTML = stripHtml({ ...cached.res.system, alerts: [...(cached.res.system?.alerts || []), { level: 'red', text: e.message }] }).s; }
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
  S.loggedIn = true; S.csrf = j.csrf; S.snap = null;
  go('#/dashboard');
};
