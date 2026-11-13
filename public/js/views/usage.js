import { html, raw, num, dmy } from '../util.js';
import { icon } from '../icons.js';

const pct = (p) => (p == null ? '' : `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(Math.round(p * 100))}%`);
const fm = (n) => (n == null ? '—' : num(n));
const ymLabel = (ym) => (ym ? `Tháng ${ym.slice(5, 7)}/${ym.slice(0, 4)}` : '');
function line(label, unit, o) {
  if (!o) return '';
  const arrow = o.trend === 'up' ? html`<b class="up">▲ ${pct(o.pctPrev)}</b>` : o.trend === 'down' ? html`<b class="down">▼ ${pct(o.pctPrev)}</b>` : o.trend === 'same' ? html`<b>＝</b>` : '';
  return html`<div class="uline ${o.alert ? 'bad' : ''}"><span class="ul">${raw(icon(label === 'Điện' ? 'bolt' : 'drop', '1.1em'))} ${label}</span><span class="uv">${o.prev == null ? '' : html`${fm(o.prev)} → `}<b>${fm(o.cur)}</b> ${unit} ${arrow}</span>
    <span class="ua">${o.avg == null ? '' : html`TB các tháng gần nhất: ${fm(o.avg)} ${unit}${o.pctAvg == null ? '' : ` (${pct(o.pctAvg)})`}`}</span></div>`;
}
export function usagePanel(u) {
  if (!u) return '';
  return html`<div class="sum-title" style="margin-top:26px">ĐIỆN – NƯỚC CÁC PHÒNG SO VỚI THÁNG TRƯỚC</div>
    ${u.alerts.length ? html`<div class="notices" style="margin:0 0 10px">${u.alerts.map((a) => html`<article class="note red"><h3>${raw(icon('alert', '1.1em'))} ${a.roomName} – nghi rò rỉ ${a.kind === 'elec' ? 'điện' : 'nước'}</h3><dl><dt>Cảnh báo</dt><dd>${a.text.split(': ')[1]}</dd></dl></article>`)}</div>` : ''}
    <div class="notices" style="margin-top:0">${u.rooms.map((r) => html`<article class="card ucard"><h3>${r.roomName} <span class="muted small">· ${ymLabel(r.label)}</span></h3>${line('Điện', 'số', r.elec)}${line('Nước', 'khối', r.water)}${r.monthsInAvg ? '' : html`<div class="muted small">Chưa đủ dữ liệu để tính trung bình.</div>`}</article>`)}
    ${u.owner ? html`<article class="card ucard owner"><h3>${raw(icon('home', '1.1em'))} Chủ Nhà <span class="muted small">· ${ymLabel(u.owner.label)} · chốt ngày ${dmy(u.owner.completedOn)}</span></h3>${line('Điện', 'số', u.owner.elec)}${line('Nước', 'khối', u.owner.water)}${u.owner.elec?.avg == null && u.owner.water?.avg == null ? html`<div class="muted small">Chưa đủ dữ liệu để tính trung bình.</div>` : ''}</article>` : ''}
    ${u.ownerPending ? html`<article class="card ucard owner"><h3>${raw(icon('home', '1.1em'))} Chủ Nhà <span class="badge orange">Đang chờ chốt</span></h3><p class="muted small" style="margin:6px 0 0">Tháng ${Number(u.ownerPending.ym.slice(5))}/${u.ownerPending.ym.slice(0, 4)} sẽ có kết quả chính xác và cảnh báo rò rỉ khi phòng ghi chỉ số cuối cùng xong: ${u.ownerPending.waiting.map((w) => `${w.room}${w.expected ? ` (dự kiến ${dmy(w.expected)})` : ''}`).join(', ')}.</p></article>` : ''}
    ${!u.owner && !u.ownerPending ? html`<article class="card ucard owner"><h3>${raw(icon('home', '1.1em'))} Chủ Nhà</h3><p class="muted small" style="margin:6px 0 0">Chưa có số liệu: cần Số Đồng Hồ Tổng Cũ và số mới hàng tháng (nhập ở thẻ Chủ Nhà).</p></article>` : ''}</div>
    <p class="muted small" style="margin:8px 4px 0">Cảnh báo khi mức dùng mới nhất tăng quá ${u.threshold}% so với trung bình các tháng trước trong năm. Đơn vị: số điện (kWh), nước (khối = m³).</p>`;
}
