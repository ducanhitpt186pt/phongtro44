// Chụp / chọn / xem trước / xoay / nén ảnh CCCD (đa số trình duyệt di động mở camera sau qua capture="environment").
import { html, $, toast } from './util.js';
import { api } from './api.js';
import { acts, changes } from './ui.js';

const st = { front: null, back: null }; // {file, rot, blob, url}
export const resetImages = () => { for (const k of Object.keys(st)) { if (st[k]?.url) URL.revokeObjectURL(st[k].url); st[k] = null; } };
export const getBlob = (side) => st[side]?.blob || null;
const LABEL = { front: 'MẶT TRƯỚC', back: 'MẶT SAU' };

export function idBox(side, { required = true } = {}) {
  return html`<div class="idcap" data-side="${side}"><strong>CCCD ${LABEL[side].toLowerCase()}${required ? ' *' : ''}</strong>
    <div class="idprev" id="prev-${side}"><span>Chưa có ảnh</span></div>
    <div class="row"><label class="btn primary sp">📷 CHỤP CCCD ${LABEL[side]}<input type="file" accept="image/*" capture="environment" hidden data-change="id-file" data-side="${side}"></label>
    <label class="btn sp">🖼 Chọn từ thư viện<input type="file" accept="image/*" hidden data-change="id-file" data-side="${side}"></label></div>
    <div class="row" id="tools-${side}" hidden><button type="button" class="btn sm" data-act="id-rot" data-side="${side}">⟳ Xoay</button>
    <button type="button" class="btn sm" data-act="id-clear" data-side="${side}">Chụp lại</button><span class="muted small" id="info-${side}"></span></div></div>`;
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
async function refresh(side) {
  const s = st[side]; const box = $(`#prev-${side}`); if (!box) return;
  try {
    box.innerHTML = '<span>Đang xử lý ảnh…</span>';
    s.blob = await compress(s.file, s.rot);
    if (s.url) URL.revokeObjectURL(s.url); s.url = URL.createObjectURL(s.blob);
    box.innerHTML = html`<img alt="Xem trước CCCD ${LABEL[side].toLowerCase()}" src="${s.url}">`.s;
    $(`#tools-${side}`).hidden = false; $(`#info-${side}`).textContent = `${(s.blob.size / 1048576).toFixed(2)} MB`;
  } catch (e) { box.innerHTML = '<span>Chưa có ảnh</span>'; st[side] = null; toast(e.message, 'err'); }
}
changes['id-file'] = async (el) => { const f = el.files?.[0]; if (!f) return; const side = el.dataset.side; if (st[side]?.url) URL.revokeObjectURL(st[side].url); st[side] = { file: f, rot: 0, blob: null, url: null }; el.value = ''; await refresh(side); };
acts['id-rot'] = async (el) => { const s = st[el.dataset.side]; if (!s) return; s.rot = (s.rot + 90) % 360; await refresh(el.dataset.side); };
acts['id-clear'] = (el) => { const side = el.dataset.side; if (st[side]?.url) URL.revokeObjectURL(st[side].url); st[side] = null; $(`#prev-${side}`).innerHTML = '<span>Chưa có ảnh</span>'; $(`#tools-${side}`).hidden = true; };
export async function uploadImage(tenantId, side) {
  const blob = st[side]?.blob; if (!blob) return null;
  return api('POST', `storage/upload?tenantId=${encodeURIComponent(tenantId)}&side=${side}`, blob, { headers: { 'Content-Type': 'image/jpeg' } });
}
