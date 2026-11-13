// Nút "Thêm vào màn hình chính": Android/PC có hộp thoại cài đặt; iPhone/iPad (Safari) chỉ làm được bằng tay nên hiện hướng dẫn từng bước.
import { html, raw, openModal } from './util.js';
import { icon } from './icons.js';
import { acts } from './ui.js';

let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
window.addEventListener('appinstalled', () => { deferred = null; document.querySelectorAll('.a2hs,.a2hs-chip').forEach((el) => (el.hidden = true)); });
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ua = () => navigator.userAgent || '';
const isIOS = () => /iPhone|iPad|iPod/.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inApp = () => /FBAN|FBAV|Zalo|Instagram|Line\/|MicroMessenger/i.test(ua());
const share = '<svg class="ic" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3.500M8 7l4-4 4 4"/><path d="M6 11H5.500A1.500 1.500 0 0 0 4 12.500v6A1.500 1.500 0 0 0 5.500 20h13a1.500 1.500 0 0 0 1.500-1.500v-6a1.500 1.500 0 0 0-1.500-1.500H18"/></svg>';
// Nút nhỏ ở đầu trang (dễ thấy, không cần kéo xuống cuối trang)
export function a2hsChip() {
  if (isStandalone()) return '';
  return html`<button class="a2hs-chip" data-act="a2hs" type="button"><img src="/icon-192.png" alt="" width="22" height="22"><span>${isIOS() ? 'Thêm icon trên iOS' : 'Thêm icon'}</span></button>`;
}
const barSvg = (ipad) => `<svg class="a2hs-fig" viewBox="0 0 300 74" role="img" aria-label="Vị trí nút Chia sẻ trong Safari"><rect x="2" y="${ipad ? 4 : 14}" width="296" height="${ipad ? 30 : 50}" rx="14" fill="none" stroke="#94a3b8" stroke-width="2"/>${ipad ? '' : '<g fill="#94a3b8"><circle cx="40" cy="39" r="6"/><circle cx="110" cy="39" r="6"/><circle cx="260" cy="39" r="6"/><rect x="198" y="33" width="14" height="12" rx="3"/></g>'}<g transform="translate(${ipad ? 250 : 144} ${ipad ? 9 : 22})" fill="none" stroke="#0a72e6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="${ipad ? 10 : 17}" r="${ipad ? 17 : 24}" stroke="#e5392b" stroke-width="3"/><path d="M11 ${ipad ? 16 : 22}V${ipad ? 3 : 8}M6 ${ipad ? 7 : 12}l5-5 5 5"/><path d="M5 ${ipad ? 12 : 18}H4a2 2 0 0 0-2 2v${ipad ? 5 : 6}a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v${ipad ? -5 : -6}a2 2 0 0 0-2-2h-1" transform="translate(0 ${ipad ? -4 : 0})"/></g><text x="${ipad ? 150 : 60}" y="${ipad ? 62 : 8}" fill="#e5392b" font-size="13" font-weight="700" font-family="sans-serif">${ipad ? 'iPad: nút Chia sẻ ở góc trên bên phải ↗' : 'iPhone: nút Chia sẻ ở giữa thanh dưới ↓'}</text></svg>`;
export function a2hsButton() {
  if (isStandalone()) return '';
  return html`<div class="a2hs-wrap"><button class="a2hs" data-act="a2hs" type="button"><img src="/icon-192.png" alt="" width="52" height="52"><span><b>Thêm vào màn hình chính</b><small>Mở nhanh như một ứng dụng trên điện thoại</small></span>${raw(icon('plus', '1.4em'))}</button></div>`;
}
acts.a2hs = async () => {
  if (deferred) { const d = deferred; deferred = null; d.prompt(); try { await d.userChoice; } catch { /* bỏ qua */ } return; }
  const ios = isIOS(); const step = (n, t) => html`<li><span class="stepn">${n}</span><div>${t}</div></li>`;
  openModal('Thêm vào màn hình chính', html`<div class="a2hs-guide"><div class="a2hs-icon"><img src="/icon-512.png" alt="Biểu tượng Nhà trọ 44" width="96" height="96"><div><b>Nhà trọ 44</b><br><span class="muted small">44 Lê Văn Phấn</span></div></div>
    ${ios ? html`<p class="a2hs-lead"><b>iPhone/iPad không cho trang web tự thêm icon</b> – bạn cần làm 4 bước dưới đây (khoảng 30 giây), chỉ làm một lần.</p><div>${raw(barSvg(/iPad/.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)))}</div>${inApp() ? html`<p class="warn-box">Bạn đang mở trong ứng dụng khác (Zalo, Facebook…). Hãy bấm <b>⋯</b> / <b>Mở bằng trình duyệt Safari</b> trước, vì iPhone/iPad chỉ cho thêm từ Safari.</p>` : ''}
      <ol class="steps">${step(1, html`Mở trang này bằng <b>Safari</b>.`)}${step(2, html`Bấm nút <b>Chia sẻ</b> ${raw(share)} (ô vuông có mũi tên hướng lên) ở thanh dưới (iPhone) hoặc góc trên bên phải (iPad).`)}${step(3, html`Kéo danh sách lên, chọn <b>Thêm vào Màn hình chính</b> (Add to Home Screen).`)}${step(4, html`Bấm <b>Thêm</b> ở góc trên bên phải. Biểu tượng <b>Nhà trọ 44</b> sẽ xuất hiện trên màn hình chính.`)}</ol>`
    : html`<ol class="steps">${step(1, html`Trên <b>Chrome</b> (Android): bấm dấu <b>⋮</b> ở góc trên bên phải.`)}${step(2, html`Chọn <b>Thêm vào màn hình chính</b> hoặc <b>Cài đặt ứng dụng</b>.`)}${step(3, html`Bấm <b>Cài đặt</b> / <b>Thêm</b>. Trên máy tính: bấm biểu tượng cài đặt ở thanh địa chỉ.`)}</ol>`}
    <p class="muted small" style="margin:8px 0 0">Sau khi thêm, bạn mở bằng biểu tượng trên màn hình chính, không cần gõ địa chỉ web.</p></div>`);
};
