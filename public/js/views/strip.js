import { html, raw } from '../util.js';
import { S } from '../api.js';
import { icon } from '../icons.js';
// Dòng trạng thái dưới tiêu đề: luôn có % lưu trữ ảnh (+ hạn mức Upstash); chỉ thêm cảnh báo khi có vấn đề GitHub/Vercel/Upstash.
export function stripHtml(sys, { link = false } = {}) {
  const alerts = [...(sys?.alerts || [])]; if (S.sysError) alerts.push({ level: 'red', text: S.sysError });
  const pct = sys?.storagePct; const full = typeof pct === 'number' && pct >= 90; const u = sys?.upstash;
  const uw = u ? Math.max(u.commandPct, u.dbPct) : 0;
  return html`<div class="strip"><span class="${full ? 'red' : ''}">${raw(icon('storage'))} Lưu trữ ảnh: <b>${typeof pct !== 'number' ? '—' : `${String(pct).replace('.', ',')}%`}</b>${sys?.storageUsedMb !== undefined ? ` (${sys.storageUsedMb} / ${sys.storageLimitMb} MB)` : ''}${full ? ' – sắp đầy' : ''}${full && link ? html` · <a href="#/backup">Dọn dữ liệu</a>` : ''}</span>
    ${u ? html`<span class="${uw >= 95 ? 'red' : uw >= 80 ? 'orange' : ''}">${raw(icon('bolt'))} Upstash: lệnh <b>${String(u.commandPct).replace('.', ',')}%</b> (${u.commands.toLocaleString('vi-VN')} / ${u.commandLimit.toLocaleString('vi-VN')} tháng này, ước tính) · dữ liệu <b>${String(u.dbPct).replace('.', ',')}%</b> (${u.dbKb} KB / ${u.dbLimitMb} MB)</span>` : ''}
    ${alerts.map((a) => html`<span class="${a.level}">${raw(icon('alert'))} ${a.text}</span>`)}</div>`;
}
