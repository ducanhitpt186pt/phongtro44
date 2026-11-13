// Nút "Thêm vào màn hình chính": Android/PC có hộp thoại cài đặt; iPhone/iPad (Safari) chỉ làm được bằng tay nên hiện hướng dẫn từng bước.
import { html, raw, openModal } from './util.js';
import { icon } from './icons.js';
import { acts } from './ui.js';

let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
window.addEventListener('appinstalled', () => { deferred = null; document.querySelectorAll('.a2hs').forEach((el) => (el.hidden = true)); });
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ua = () => navigator.userAgent || '';
const isIOS = () => /iPhone|iPad|iPod/.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inApp = () => /FBAN|FBAV|Zalo|Instagram|Line\/|MicroMessenger/i.test(ua());
const share = '<svg class="ic" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3.500M8 7l4-4 4 4"/><path d="M6 11H5.500A1.500 1.500 0 0 0 4 12.500v6A1.500 1.500 0 0 0 5.500 20h13a1.500 1.500 0 0 0 1.500-1.500v-6a1.500 1.500 0 0 0-1.500-1.500H18"/></svg>';
export function a2hsButton() {
  if (isStandalone()) return '';
  return html`<div class="a2hs-wrap"><button class="a2hs" data-act="a2hs" type="button"><img src="/icon-192.png" alt="" width="52" height="52"><span><b>Thêm vào màn hình chính</b><small>Mở nhanh như một ứng dụng trên điện thoại</small></span>${raw(icon('plus', '1.4em'))}</button></div>`;
}
acts.a2hs = async () => {
  if (deferred) { const d = deferred; deferred = null; d.prompt(); try { await d.userChoice; } catch { /* bỏ qua */ } return; }
  const ios = isIOS(); const step = (n, t) => html`<li><span class="stepn">${n}</span><div>${t}</div></li>`;
  openModal('Thêm vào màn hình chính', html`<div class="a2hs-guide"><div class="a2hs-icon"><img src="/icon-512.png" alt="Biểu tượng Nhà trọ 44" width="96" height="96"><div><b>Nhà trọ 44</b><br><span class="muted small">44 Lê Văn Phấn</span></div></div>
    ${ios ? html`${inApp() ? html`<p class="warn-box">Bạn đang mở trong ứng dụng khác (Zalo, Facebook…). Hãy bấm <b>⋯</b> / <b>Mở bằng trình duyệt Safari</b> trước, vì iPhone/iPad chỉ cho thêm từ Safari.</p>` : ''}
      <ol class="steps">${step(1, html`Mở trang này bằng <b>Safari</b>.`)}${step(2, html`Bấm nút <b>Chia sẻ</b> ${raw(share)} (ô vuông có mũi tên hướng lên) ở thanh dưới (iPhone) hoặc góc trên bên phải (iPad).`)}${step(3, html`Kéo danh sách lên, chọn <b>Thêm vào Màn hình chính</b> (Add to Home Screen).`)}${step(4, html`Bấm <b>Thêm</b> ở góc trên bên phải. Biểu tượng <b>Nhà trọ 44</b> sẽ xuất hiện trên màn hình chính.`)}</ol>`
    : html`<ol class="steps">${step(1, html`Trên <b>Chrome</b> (Android): bấm dấu <b>⋮</b> ở góc trên bên phải.`)}${step(2, html`Chọn <b>Thêm vào màn hình chính</b> hoặc <b>Cài đặt ứng dụng</b>.`)}${step(3, html`Bấm <b>Cài đặt</b> / <b>Thêm</b>. Trên máy tính: bấm biểu tượng cài đặt ở thanh địa chỉ.`)}</ol>`}
    <p class="muted small" style="margin:8px 0 0">Sau khi thêm, bạn mở bằng biểu tượng trên màn hình chính, không cần gõ địa chỉ web.</p></div>`);
};
