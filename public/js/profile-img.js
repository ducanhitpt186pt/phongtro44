// Ảnh "Hồ sơ khách theo phòng": khổ A4 dọc (1654 × 2339 px ≈ 200 dpi), vẽ bằng canvas, không cần thư viện ngoài.
// Mỗi trang tối đa 2 người; phòng có nhiều người hơn thì tạo thêm trang (mỗi trang một ảnh).
import { dmy, GENDER } from './util.js';
import { D, apiUrl, today } from './api.js';

const W = 1654, H = 2339, M = 90;
const FONT = '"SVN-Avo","Inter",-apple-system,"Segoe UI",Roboto,sans-serif';
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ratio = 85.6 / 53.98; // tỉ lệ thẻ căn cước
async function fonts() { try { await Promise.all(['400', '600', '700'].map((w) => document.fonts.load(`${w} 30px Inter`))); await document.fonts.ready; } catch { /* dùng font hệ thống */ } }

// Thu thập người trong phòng: chủ hợp đồng + người ở cùng
export function roomMembers(roomId) {
  const r = D().rentals.find((x) => x.roomId === roomId && x.status === 'active'); if (!r) return null;
  const t = D().tenants.find((x) => x.id === r.tenantId); if (!t) return null;
  const rm = D().rooms.find((x) => x.id === roomId);
  const people = [{ p: t, main: true }, ...D().occupants.filter((o) => o.tenantId === t.id).map((o) => ({ p: o, main: false }))];
  return { room: rm, rental: r, people };
}
const fields = (p, main, start) => ({
  dob: p.dob ? dmy(p.dob) : '—', gender: GENDER[p.gender] || '—', phone: p.phone || '—',
  cccd: p.noId ? 'Chưa có (trẻ em)' : p.cccd || '—',
  issue: main ? [p.cccdIssueDate ? dmy(p.cccdIssueDate) : '', p.cccdIssuePlace].filter(Boolean).join(' · ') || '—' : '—',
  start: dmy(start), address: p.address || '—', hometown: p.hometown || '—',
});
async function loadImg(meta) {
  if (!meta?.id) return null;
  try { const r = await fetch(apiUrl(`storage/${meta.id}`), { credentials: 'same-origin' }); if (!r.ok) return null; return await createImageBitmap(await r.blob()); } catch { return null; }
}
function rr(c, x, y, w, h, r, fill, stroke) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); } }
function wrap(c, text, maxW) { const out = []; let line = ''; for (const w of String(text).split(' ')) { const t = line ? `${line} ${w}` : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; }

// Vẽ 1 khung ảnh căn cước (giữ tỉ lệ ảnh, không méo)
function drawId(c, img, x, y, w, h, caption, noId) {
  c.textAlign = 'left'; c.fillStyle = '#6c6c70'; c.font = `600 26px ${FONT}`; c.fillText(caption, x, y + 26);
  const by = y + 40; rr(c, x, by, w, h, 18, '#eef1f5', '#d9dee5');
  if (img) {
    const sc = Math.min((w - 12) / img.width, (h - 12) / img.height); const dw = img.width * sc, dh = img.height * sc; const dx = x + (w - dw) / 2, dy = by + (h - dh) / 2;
    c.save(); c.beginPath(); c.roundRect ? c.roundRect(dx, dy, dw, dh, 10) : c.rect(dx, dy, dw, dh); c.clip(); c.drawImage(img, dx, dy, dw, dh); c.restore();
  } else { c.textAlign = 'center'; c.fillStyle = '#9aa0a8'; c.font = `500 28px ${FONT}`; c.fillText(noId ? 'Không có căn cước' : 'Chưa có ảnh', x + w / 2, by + h / 2 + 10); }
}
// Đo thẻ người: số dòng địa chỉ / quê quán và phần chiều cao cố định (chưa tính ảnh căn cước)
const PAD = 44;
function measure(c, o, w) {
  const iw = w - PAD * 2; c.font = `600 30px ${FONT}`;
  const addr = wrap(c, o.f.address, iw - 270).slice(0, 3); const home = wrap(c, o.f.hometown, iw - 270).slice(0, 2);
  const infoH = 4 * 56 + Math.max(1, addr.length) * 40 + 12 + Math.max(1, home.length) * 40 + 12;
  return { iw, addr, home, infoH, fixed: PAD + 70 + infoH + 26 + PAD - 6 };
}
// Vẽ 1 thẻ người với ảnh căn cước rộng imgW (cao imgH); trả về chiều cao đã dùng
function drawPerson(c, o, x, y, w, stacked, imgW, imgH, m) {
  const f = o.f; const { iw, addr, home } = m;
  const imgsH = stacked ? (imgH + 40 + 22) * 2 : imgH + 40; const total = m.fixed + imgsH;
  rr(c, x, y, w, total, 30, '#ffffff', '#e1e5eb');
  let cy = y + PAD; c.textAlign = 'left'; c.fillStyle = '#1c1c1e'; c.font = `700 44px ${FONT}`; let nm = o.name; while (c.measureText(nm).width > iw - 260 && nm.length > 6) nm = nm.slice(0, -2); if (nm !== o.name) nm += '…'; c.fillText(nm, x + PAD, cy + 44);
  const tag = o.main ? 'Chủ hợp đồng' : 'Người ở cùng'; c.font = `600 24px ${FONT}`; const tw = c.measureText(tag).width + 36; rr(c, x + w - PAD - tw, cy + 8, tw, 44, 22, o.main ? '#e4effc' : '#eef1f5'); c.fillStyle = o.main ? '#0a5bd6' : '#475569'; c.textAlign = 'center'; c.fillText(tag, x + w - PAD - tw / 2, cy + 38);
  cy += 70; c.strokeStyle = '#e8ebf0'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + PAD, cy - 8); c.lineTo(x + w - PAD, cy - 8); c.stroke();
  const colW = iw / 2; const kv = (k, v, col, row, full = false) => { const px = x + PAD + col * colW, py = cy + row * 56; const lw = full || col === 0 ? 270 : 190; c.textAlign = 'left'; c.fillStyle = '#8a8f98'; c.font = `400 26px ${FONT}`; c.fillText(k, px, py + 34); c.fillStyle = '#1c1c1e'; c.font = `600 30px ${FONT}`; let vv = v; const maxW = (full ? iw : colW - 30) - lw; while (c.measureText(vv).width > maxW && vv.length > 6) vv = vv.slice(0, -2); c.fillText(vv === v ? v : vv + '…', px + lw, py + 34); };
  kv('Ngày sinh', f.dob, 0, 0); kv('Giới tính', f.gender, 1, 0);
  kv('Điện thoại', f.phone, 0, 1); kv('Ngày vào ở', f.start, 1, 1);
  kv('Số CCCD', f.cccd, 0, 2, true); kv('Ngày cấp / Nơi cấp', f.issue, 0, 3, true);
  const block = (label, lines, top) => { c.textAlign = 'left'; c.fillStyle = '#8a8f98'; c.font = `400 26px ${FONT}`; c.fillText(label, x + PAD, top + 34); c.fillStyle = '#1c1c1e'; c.font = `600 30px ${FONT}`; lines.forEach((l, k) => c.fillText(l, x + PAD + 270, top + 34 + k * 40)); };
  const ay = cy + 4 * 56; block('Địa chỉ thường trú', addr, ay);
  const hy = ay + Math.max(1, addr.length) * 40 + 12; block('Quê quán', home, hy);
  cy += m.infoH + 26;
  if (stacked) { const ix = x + (w - imgW) / 2; drawId(c, o.front, ix, cy, imgW, imgH, 'CĂN CƯỚC – MẶT TRƯỚC', o.noId); drawId(c, o.back, ix, cy + imgH + 40 + 22, imgW, imgH, 'CĂN CƯỚC – MẶT SAU', o.noId); }
  else { const gap = iw - imgW * 2; drawId(c, o.front, x + PAD, cy, imgW, imgH, 'CĂN CƯỚC – MẶT TRƯỚC', o.noId); drawId(c, o.back, x + PAD + imgW + gap, cy, imgW, imgH, 'CĂN CƯỚC – MẶT SAU', o.noId); }
  return total;
}
async function renderPage(info, items, pageNo, pages) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); c.textBaseline = 'alphabetic';
  c.fillStyle = '#f2f5f9'; c.fillRect(0, 0, W, H);
  // đầu trang
  c.fillStyle = '#007aff'; c.textAlign = 'left'; c.font = `700 58px ${FONT}`; c.fillText('HỒ SƠ KHÁCH THUÊ', M, M + 58);
  c.fillStyle = '#6c6c70'; c.font = `400 30px ${FONT}`; c.fillText(`Nhà trọ 44 Lê Văn Phấn · Ngày xuất ${dmy(today())}${pages > 1 ? ` · Trang ${pageNo}/${pages}` : ''}`, M, M + 108);
  c.font = `700 46px ${FONT}`; const rt = info.room.name; const rw = c.measureText(rt).width + 80; rr(c, W - M - rw, M + 6, rw, 84, 42, '#007aff'); c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(rt, W - M - rw / 2, M + 64);
  c.strokeStyle = '#d3d9e1'; c.lineWidth = 2; c.beginPath(); c.moveTo(M, M + 142); c.lineTo(W - M, M + 142); c.stroke();
  const y0 = M + 176; const stacked = items.length === 1; const cw = W - M * 2; const GAP = 34;
  const ms = items.map((o) => measure(c, o, cw)); const avail = H - 110 - y0 - GAP * (items.length - 1);
  const room = avail - ms.reduce((a, m) => a + m.fixed, 0);
  let imgH; const maxW = stacked ? 860 : Math.floor((cw - PAD * 2 - 40) / 2);
  if (stacked) imgH = Math.min(Math.round(maxW / ratio), Math.floor(room / 2) - 62); else imgH = Math.min(Math.round(maxW / ratio), Math.floor(room / items.length) - 40);
  imgH = Math.max(imgH, 180); const imgW = Math.round(imgH * ratio);
  let y = y0; for (let i = 0; i < items.length; i++) y += drawPerson(c, items[i], M, y, cw, stacked, imgW, imgH, ms[i]) + GAP;
  c.textAlign = 'center'; c.fillStyle = '#9aa0a8'; c.font = `400 24px ${FONT}`; c.fillText('Tài liệu chứa thông tin cá nhân – chỉ dùng cho quản lý nhà trọ, không chia sẻ công khai.', W / 2, H - 56);
  return new Promise((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error('Không tạo được ảnh'))), 'image/jpeg', 0.93));
}
// Tạo danh sách ảnh (mỗi trang một ảnh JPG A4 dọc)
export async function buildRoomProfile(roomId) {
  const info = roomMembers(roomId); if (!info) throw new Error('Phòng này hiện không có khách đang thuê');
  await fonts();
  const items = await Promise.all(info.people.map(async ({ p, main }) => ({ main, name: p.fullName, noId: !!p.noId, f: fields(p, main, info.rental.startDate), front: await loadImg(p.idImages?.front), back: await loadImg(p.idImages?.back) })));
  const chunks = []; for (let i = 0; i < items.length; i += 2) chunks.push(items.slice(i, i + 2));
  const out = []; for (let i = 0; i < chunks.length; i++) out.push({ blob: await renderPage(info, chunks[i], i + 1, chunks.length), file: `ho-so-khach-${slug(info.room.name)}${chunks.length > 1 ? `-trang-${i + 1}` : ''}-${today()}.jpg` });
  return out;
}
export async function downloadRoomProfile(roomId) {
  const pages = await buildRoomProfile(roomId);
  for (const [i, pg] of pages.entries()) { const a = document.createElement('a'); a.href = URL.createObjectURL(pg.blob); a.download = pg.file; document.body.append(a); a.click(); await new Promise((r) => setTimeout(r, 700 * (i + 1 < pages.length ? 1 : 0) + 100)); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  return pages.length;
}
