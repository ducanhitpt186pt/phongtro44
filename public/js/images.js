// Chụp / chọn / xem trước / xoay / nén ảnh CCCD. Mỗi "ô ảnh" (slot) có tên riêng: khách = 'front'/'back'; người ở cùng = 'o1-front'...
import { html, $, toast } from './util.js';
import { api } from './api.js';
import { icon } from './icons.js';
import { acts, changes } from './ui.js';

const st = {}; // slot -> {file, rot, blob, url}
export const resetImages = () => { for (const k of Object.keys(st)) { if (st[k]?.url) URL.revokeObjectURL(st[k].url); delete st[k]; } };
export const getBlob = (slot) => st[slot]?.blob || null;

export function idBox(slot, { title = '', required = true } = {}) {
  const side = slot.endsWith('back') ? 'MẶT SAU' : 'MẶT TRƯỚC';
  return html`<div class="idcap"><strong>${title || `CCCD ${side.toLowerCase()}`}${required ? ' *' : ''}</strong>
    <div class="idprev" id="prev-${slot}"><span>Chưa có ảnh</span></div>
    <div class="row"><label class="btn primary sp">${icon('camera', '1.15em')} CHỤP CCCD ${side}<input type="file" accept="image/*" capture="environment" hidden data-change="id-file" data-slot="${slot}"></label>
    <label class="btn sp">${icon('photo', '1.15em')} Chọn từ thư viện<input type="file" accept="image/*" hidden data-change="id-file" data-slot="${slot}"></label></div>
    <div class="row" id="tools-${slot}" hidden><button type="button" class="btn sm" data-act="id-rot" data-slot="${slot}">${icon('rotate')} Xoay</button>
    <button type="button" class="btn sm" data-act="id-clear" data-slot="${slot}">Chụp lại</button><span class="muted small" id="info-${slot}"></span></div></div>`;
}
async function compress(file, rot) {
  const url = URL.createObjectURL(file);
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Không đọc được ảnh này. Hãy chọn ảnh JPG/PNG khác.')); i.src = url; });
  URL.revokeObjectURL(url);
  const scale = Math.min(1, 2200 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
  const swap = rot % 180 !== 0; const c = document.createElement('canvas'); c.width = swap ? h : w; c.height = swap ? w : h;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.translate(c.width / 2, c.height / 2); g.rotate((rot * Math.PI) / 180); g.drawImage(img, -w / 2, -h / 2, w, h);
  let q = 0.86, blob;
  do { blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', q)); q -= 0.06; } while (blob && blob.size > 3_300_000 && q > 0.5);
  if (!blob) throw new Error('Trình duyệt không nén được ảnh');
  return blob;
}
async function refresh(slot) {
  const s = st[slot]; const box = $(`#prev-${slot}`); if (!box) return;
  try {
    box.innerHTML = '<span>Đang xử lý ảnh…</span>';
    s.blob = await compress(s.file, s.rot);
    if (s.url) URL.revokeObjectURL(s.url); s.url = URL.createObjectURL(s.blob);
    box.innerHTML = html`<img alt="Xem trước CCCD" src="${s.url}">`.s;
    $(`#tools-${slot}`).hidden = false; $(`#info-${slot}`).textContent = `${(s.blob.size / 1048576).toFixed(2)} MB`;
  } catch (e) { box.innerHTML = '<span>Chưa có ảnh</span>'; delete st[slot]; toast(e.message, 'err'); }
}
changes['id-file'] = async (el) => { const f = el.files?.[0]; if (!f) return; const slot = el.dataset.slot; if (st[slot]?.url) URL.revokeObjectURL(st[slot].url); st[slot] = { file: f, rot: 0, blob: null, url: null }; el.value = ''; await refresh(slot); };
acts['id-rot'] = async (el) => { const s = st[el.dataset.slot]; if (!s) return; s.rot = (s.rot + 90) % 360; await refresh(el.dataset.slot); };
acts['id-clear'] = (el) => { const slot = el.dataset.slot; if (st[slot]?.url) URL.revokeObjectURL(st[slot].url); delete st[slot]; $(`#prev-${slot}`).innerHTML = '<span>Chưa có ảnh</span>'; $(`#tools-${slot}`).hidden = true; };
// Tải ảnh của ô `slot` lên cho chủ ảnh `ownerId` (khách hoặc người ở cùng), mặt `side` = front|back
export async function uploadImage(ownerId, slot, side = slot.endsWith('back') ? 'back' : 'front') {
  const blob = st[slot]?.blob; if (!blob) return null;
  return api('POST', `storage/upload?ownerId=${encodeURIComponent(ownerId)}&side=${side}`, blob, { headers: { 'Content-Type': 'image/jpeg' } });
}
