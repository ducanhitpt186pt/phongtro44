import { html, raw, $ } from '../util.js';
import { S } from '../api.js';
import { icon } from '../icons.js';

const worst = (sys) => { const u = sys?.upstash; return Math.max(Number(sys?.storagePct) || 0, u ? u.commandPct : 0, u ? u.dbPct : 0); };
const fmt = (n) => String(n).replace('.', ',');
// 1 thanh màu ở đầu trang: mức dùng cao nhất trong (kho ảnh, lệnh Upstash, dữ liệu Upstash)
export function usageBar(sys) {
  if (!sys || typeof sys.storagePct !== 'number') return html`<div class="ubar"><div class="track"><div class="fill" style="width:2%"></div></div><div class="lbl">Đang tải mức dùng…</div></div>`;
  const w = worst(sys); const cls = w >= 90 ? 'bad' : w >= 70 ? 'warn' : ''; const u = sys.upstash;
  const tip = `Kho ảnh ${fmt(sys.storagePct)}%${u ? ` · lệnh Upstash ${fmt(u.commandPct)}% · dữ liệu Upstash ${fmt(u.dbPct)}%` : ''}`;
  return html`<div class="ubar ${cls}" title="${tip}"><div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${w}" aria-label="Mức dùng bộ nhớ"><div class="fill" style="width:${Math.max(2, Math.min(100, w))}%"></div></div><div class="lbl">Bộ nhớ đã dùng <b>${fmt(w)}%</b>${w >= 90 ? ' – sắp đầy' : ''}</div></div>`;
}
// Chỉ hiện khi CÓ vấn đề (token, Google Sheet, kết nối…)
export function alertsHtml(sys) {
  const alerts = [...(sys?.alerts || [])]; if (S.sysError) alerts.push({ level: 'red', text: S.sysError });
  return alerts.length ? html`<div class="alerts">${alerts.map((a) => html`<span class="${a.level}">${raw(icon('alert'))} ${a.text}</span>`)}</div>` : html``;
}
// Chi tiết đầy đủ ở CUỐI trang
export function footStrip(sys, { link = false } = {}) {
  const pct = sys?.storagePct; const full = typeof pct === 'number' && pct >= 90; const u = sys?.upstash; const uw = u ? Math.max(u.commandPct, u.dbPct) : 0;
  return html`<div class="foot-strip"><span class="${full ? 'red' : ''}">${raw(icon('storage'))} Lưu trữ ảnh: <b>${typeof pct !== 'number' ? '—' : `${fmt(pct)}%`}</b>${sys?.storageUsedMb !== undefined ? ` (${sys.storageUsedMb} / ${sys.storageLimitMb} MB)` : ''}${full ? ' – sắp đầy' : ''}${full && link ? html` · <a href="#/backup">Dọn dữ liệu</a>` : ''}</span>
    ${u ? html`<span class="${uw >= 95 ? 'red' : uw >= 80 ? 'orange' : ''}">${raw(icon('bolt'))} Upstash: lệnh <b>${fmt(u.commandPct)}%</b> (${u.commands.toLocaleString('vi-VN')} / ${u.commandLimit.toLocaleString('vi-VN')} tháng này, ước tính) · dữ liệu <b>${fmt(u.dbPct)}%</b> (${u.dbKb} KB / ${u.dbLimitMb} MB)</span>` : ''}</div>`;
}
// Cập nhật cả 3 vị trí (nếu có trên trang)
export function refreshStatus(sys, link = false) {
  const a = $('#ubar'); if (a) a.innerHTML = usageBar(sys).s; const b = $('#alerts'); if (b) b.innerHTML = alertsHtml(sys).s; const c = $('#footstrip'); if (c) c.innerHTML = footStrip(sys, { link }).s;
}
