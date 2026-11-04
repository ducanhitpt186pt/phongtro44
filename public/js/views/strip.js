import { html } from '../util.js';
import { S } from '../api.js';
// Dòng trạng thái dưới tiêu đề: luôn có % lưu trữ; chỉ hiện cảnh báo khi có vấn đề GitHub/Vercel.
export function stripHtml(sys, { link = false } = {}) {
  const alerts = [...(sys?.alerts || [])]; if (S.sysError) alerts.push({ level: 'red', text: S.sysError });
  const pct = sys?.storagePct; const full = typeof pct === 'number' && pct >= 90;
  return html`<div class="strip"><span class="${full ? 'red' : ''}">🗄 Lưu trữ ảnh: <b>${typeof pct !== 'number' ? '—' : `${String(pct).replace('.', ',')}%`}</b>${sys?.storageUsedMb !== undefined ? ` (${sys.storageUsedMb} / ${sys.storageLimitMb} MB)` : ''}${full ? ' – sắp đầy' : ''}${full && link ? html` · <a href="#/backup">Dọn dữ liệu</a>` : ''}</span>
    ${sys?.upstash ? html`<span class="${Math.max(sys.upstash.commandPct, sys.upstash.dbPct) >= 95 ? 'red' : Math.max(sys.upstash.commandPct, sys.upstash.dbPct) >= 80 ? 'orange' : ''}">⚡ Upstash: lệnh <b>${String(sys.upstash.commandPct).replace('.', ',')}%</b> (${sys.upstash.commands.toLocaleString('vi-VN')} / ${sys.upstash.commandLimit.toLocaleString('vi-VN')} tháng này, ước tính) · dữ liệu <b>${String(sys.upstash.dbPct).replace('.', ',')}%</b> (${sys.upstash.dbKb} KB / ${sys.upstash.dbLimitMb} MB)</span>` : ''}
    ${alerts.map((a) => html`<span class="${a.level}">⚠ ${a.text}</span>`)}</div>`;
}
