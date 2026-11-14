// Bản khai CT01 – Tờ khai thay đổi thông tin cư trú (lưu trú): vẽ đúng mẫu khổ A4 dọc bằng canvas rồi đóng gói thành file PDF.
import { GENDER } from './util.js';
import { D, S, today } from './api.js';

const FONT = 'Arial,"Liberation Sans",Helvetica,"Segoe UI",Roboto,sans-serif';
const PT = 0.3528; // 1pt = 0.3528 mm
const DPI = 250, PXMM = DPI / 25.4, PW = 210, PH = 297, ML = 18, MR = 18, TW = PW - ML - MR;
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// "Công An Phường Phú Thủy" -> "Phú Thủy" (dùng cho dòng "…, ngày … tháng … năm …")
export function placeFromPolice(s) {
  let t = String(s || '').trim().replace(/\s+/g, ' ');
  t = t.replace(/^(c[oô]ng\s*an|ca)\s+/i, '').replace(/^(ph[uư][oơ]ng|x[aã]|th[iị]\s*tr[aấ]n|đ[aặ]c\s*khu)\s+/i, '');
  return t.trim();
}
const F = (ctx, pt, o = {}) => { ctx.font = `${o.i ? 'italic ' : ''}${o.b ? 'bold ' : ''}${(pt * PT).toFixed(3)}px ${FONT}`; };
const text = (ctx, s, x, y, o = {}) => { F(ctx, o.pt || 12, o); ctx.textAlign = o.al || 'left'; ctx.fillStyle = o.c || '#000'; ctx.fillText(s, x, y); return ctx.measureText(s).width; };
function dots(ctx, x1, x2, y) { ctx.save(); ctx.strokeStyle = '#000'; ctx.lineWidth = 0.18; ctx.setLineDash([0.18, 0.95]); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y + 0.9); ctx.lineTo(x2, y + 0.9); ctx.stroke(); ctx.restore(); }
// nhãn + giá trị trên đường chấm; trả về x sau nhãn
function field(ctx, label, x, y, x2, val, sup) {
  let w = text(ctx, label, x, y); let sx = x + w; if (sup) { text(ctx, sup, sx + 0.2, y - 1.6, { pt: 8 }); sx += ctx.measureText(sup).width + 0.5; }
  sx += 1.5; dots(ctx, sx, x2, y); if (val) { let v = val; F(ctx, 12); while (ctx.measureText(v).width > x2 - sx - 1 && v.length > 4) v = v.slice(0, -2); if (v !== val) v += '…'; text(ctx, v, sx + 1, y - 0.3); } return sx;
}
function boxes(ctx, x, y, digits) { const n = 12, w = 6.4, h = 7.2; ctx.save(); ctx.strokeStyle = '#000'; ctx.lineWidth = 0.22; for (let i = 0; i < n; i++) { ctx.strokeRect(x + i * w, y - h + 1.2, w, h); const d = (digits || '')[i]; if (d) text(ctx, d, x + i * w + w / 2, y - 1.3, { pt: 12.5, al: 'center' }); } ctx.restore(); return x + n * w; }
const dmySplit = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse() : ['', '', '']);

export function ct01Model(roomId) {
  const rental = D().rentals.find((x) => x.roomId === roomId && x.status === 'active'); if (!rental) return null;
  const t = D().tenants.find((x) => x.id === rental.tenantId); if (!t) return null;
  return { room: D().rooms.find((x) => x.id === roomId), rental, tenant: t, occ: D().occupants.filter((o) => o.tenantId === t.id), L: S.snap.settings?.landlord || {} };
}

function drawPage(ctx, m, rows, pageNo, pages, first) {
  const { tenant: T, L } = m; const place = placeFromPolice(L.police); const now = today().split('-'); // yyyy-mm-dd (giờ Việt Nam)
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PW, PH);
  // dòng ghi mẫu: cỡ chữ nhỏ ở góc trên bên phải
  text(ctx, 'Mẫu CT01 ban hành kèm theo Thông tư số 116/2026/TT-BCA', PW - MR, 13, { pt: 8.5, al: 'right' }); text(ctx, 'ngày 29 tháng 6 năm 2026 của Bộ trưởng Bộ Công an', PW - MR, 17.2, { pt: 8.5, al: 'right' });
  text(ctx, 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', PW / 2, 31, { pt: 13, b: 1, al: 'center' }); text(ctx, 'Độc lập – Tự do – Hạnh phúc', PW / 2, 37, { pt: 13, b: 1, al: 'center' });
  ctx.save(); ctx.strokeStyle = '#000'; ctx.lineWidth = 0.25; ctx.beginPath(); ctx.moveTo(PW / 2 - 26, 39.5); ctx.lineTo(PW / 2 + 26, 39.5); ctx.stroke(); ctx.restore();
  text(ctx, first ? 'TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ' : 'TỜ KHAI THAY ĐỔI THÔNG TIN CƯ TRÚ (tiếp theo)', PW / 2, 52, { pt: 13.5, b: 1, al: 'center' });
  let y = 64;
  if (first) {
    const xr = PW - MR; const sx = field(ctx, 'Kính gửi', ML + 22, y, xr, L.police || '', '(1)'); void sx; y += 11;
    const g = (GENDER[T.gender] || '').trim(); const d = dmySplit(T.dob);
    field(ctx, '1. Họ, chữ đệm và tên khai sinh:', ML, y, xr, (T.fullName || '').toUpperCase()); y += 8.4;
    let x = ML + text(ctx, '2. Ngày, tháng, năm sinh: ', ML, y); const seg = (v, w) => { dots(ctx, x, x + w, y); if (v) text(ctx, v, x + w / 2, y - 0.3, { al: 'center' }); x += w; };
    seg(d[0], 12); text(ctx, '/', x + 1.2, y); x += 2.4; seg(d[1], 12); text(ctx, '/', x + 1.2, y); x += 2.4; seg(d[2], 18);
    field(ctx, '3. Giới tính:', 112, y, xr, g); y += 10.2;
    const bx = ML + text(ctx, '4. Số định danh cá nhân: ', ML, y); boxes(ctx, bx + 1, y, (T.cccd || '').replace(/\D/g, '')); y += 8.8;
    field(ctx, '5. Số điện thoại liên hệ:', ML, y, 108, T.phone || ''); field(ctx, '6. Email:', 112, y, xr, ''); y += 8.4;
    field(ctx, '7. Họ, chữ đệm và tên chủ hộ', ML, y, 122, (L.fullName || '').toUpperCase(), '(2)'); ctx.save(); F(ctx, 12); ctx.restore(); field(ctx, '8. Mối quan hệ với chủ hộ:', 126, y, xr, ''); y += 10.2;
    const b9 = ML + text(ctx, '9. Số định danh cá nhân của chủ hộ: ', ML, y); boxes(ctx, b9 + 1, y, (L.cccd || '').replace(/\D/g, '')); y += 8.8;
    field(ctx, '10. Nội dung đề nghị', ML, y, xr, 'Cho thuê phòng trọ', '(3)'); y += 7.6; dots(ctx, ML, xr, y); y += 9.6;
  } else y = 62;
  text(ctx, first ? '11. Những thành viên trong hộ gia đình cùng thay đổi:' : '11. Những thành viên trong hộ gia đình cùng thay đổi (tiếp):', ML, y); y += 3.4;
  // bảng
  const cw = [11, 53, 31, 15, 37, 27]; const tw = cw.reduce((a, b) => a + b, 0); const k = TW / tw; const cols = cw.map((c) => c * k); const hh = 13; const rh = rows.rh;
  const heads = ['TT', 'Họ, chữ đệm và tên', 'Ngày, tháng, năm sinh', 'Giới tính', 'Số định danh cá nhân', 'Mối quan hệ với chủ hộ'];
  ctx.save(); ctx.strokeStyle = '#000'; ctx.lineWidth = 0.28; let cx = ML; const ty = y;
  heads.forEach((h, i) => { ctx.strokeRect(cx, ty, cols[i], hh); const lines = wrapText(ctx, h, cols[i] - 2, 11, true); lines.forEach((l, j) => text(ctx, l, cx + cols[i] / 2, ty + hh / 2 + 1.3 - (lines.length - 1) * 2.4 + j * 4.8, { pt: 11, b: 1, al: 'center' })); cx += cols[i]; });
  rows.items.forEach((r, ri) => { cx = ML; const ry = ty + hh + ri * rh; cols.forEach((w, i) => { ctx.strokeRect(cx, ry, w, rh); const v = r ? r[i] : ''; if (v) { let s = String(v); F(ctx, 11); while (ctx.measureText(s).width > w - 2 && s.length > 4) s = s.slice(0, -2); text(ctx, s === String(v) ? s : s + '…', i === 1 ? cx + 1.2 : cx + w / 2, ry + rh / 2 + 1.3, { pt: 11, al: i === 1 ? 'left' : 'center' }); } cx += w; }); });
  ctx.restore(); y = ty + hh + rows.items.length * rh + 7;
  if (pageNo === pages) signatures(ctx, y, place, now, L, T);
  if (pages > 1) text(ctx, `Trang ${pageNo}/${pages}`, PW / 2, PH - 8, { pt: 9, al: 'center', c: '#444' });
}
function wrapText(ctx, s, maxW, pt, b) { F(ctx, pt, { b }); const out = []; let line = ''; for (const w of s.split(' ')) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; }
function signatures(ctx, y, place, now, L, T) {
  const w = TW / 4; const heads = [['Ý KIẾN CỦA CHỦ HỘ', '(4)'], ['Ý KIẾN CỦA CHỦ SỞ HỮU CHỖ Ở HỢP PHÁP', '(5)'], ['Ý KIẾN CỦA CHA HOẶC MẸ HOẶC NGƯỜI GIÁM HỘ', '(6)'], ['NGƯỜI KÊ KHAI', '(7)']];
  const names = [L.fullName || '', '', '', T.fullName || ''];
  const dateTxt = `ngày ${Number(now[2])} tháng ${Number(now[1])} năm ${now[0]}`;
  heads.forEach(([h, sup], i) => {
    const cx = ML + w * i + w / 2; let yy = y;
    let pt = 9.5; F(ctx, pt, { i: 1 }); while (ctx.measureText(dateTxt).width > w - 1 && pt > 7) { pt -= 0.25; F(ctx, pt, { i: 1 }); } text(ctx, dateTxt, cx, yy, { pt, i: 1, al: 'center' }); yy += 5.4;
    const lines = wrapText(ctx, h, w - 3, 10.5, true); lines.forEach((l, j) => { const last = j === lines.length - 1; const wd = text(ctx, l, cx, yy, { pt: 10.5, b: 1, al: 'center' }); if (last) text(ctx, sup, cx + wd / 2 + 0.3, yy - 1.5, { pt: 7.5, b: 1, al: 'left' }); yy += 4.7; });
    text(ctx, '(Ký, ghi rõ họ tên)', cx, yy + 0.2, { pt: 9, i: 1, al: 'center', c: '#333' });
    if (names[i]) text(ctx, names[i], cx, y + 52, { pt: 10.5, b: 1, al: 'center' });
  });
}
function chunk(m) {
  const occRows = m.occ.map((o, i) => [String(i + 1), o.fullName, (() => { const d = dmySplit(o.dob); return d[0] ? d.join('/') : ''; })(), GENDER[o.gender] || '', o.noId ? '' : o.cccd || '', '']);
  const MINROWS = 8, FIRST_AVAIL = 297 - 20 - 191, REST_AVAIL = 297 - 20 - 78; // chiều cao dành cho bảng (mm) ở trang đầu / các trang sau
  const hh = 13, rhMax = 8.4, rhMin = 5.6; const firstCap = Math.floor((FIRST_AVAIL - 62) / rhMin); // trang đầu chừa chỗ chữ ký
  const pages = []; let rest = occRows.slice();
  const fit = (n, avail) => Math.min(rhMax, Math.max(rhMin, (avail - hh) / n));
  // trang cuối luôn có chữ ký (cần ~62 mm); các trang trước chỉ chứa bảng
  const capFirstSig = Math.max(MINROWS, Math.floor((FIRST_AVAIL - 62) / 8.4));
  if (rest.length <= Math.floor((FIRST_AVAIL - 62 - hh) / rhMin) + 0) { const n = Math.max(MINROWS, rest.length); const items = Array.from({ length: n }, (_, i) => rest[i] || null); pages.push({ items, rh: Math.min(rhMax, Math.max(rhMin, (FIRST_AVAIL - 62 - hh) / n)) }); }
  else { const take = Math.floor((FIRST_AVAIL - hh) / rhMin); pages.push({ items: rest.splice(0, take), rh: rhMin }); while (rest.length) { const cap = Math.floor((REST_AVAIL - hh) / rhMin); const sigCap = Math.floor((REST_AVAIL - 62 - hh) / rhMin); if (rest.length <= sigCap) { const n = Math.max(MINROWS, rest.length); pages.push({ items: Array.from({ length: n }, (_, i) => rest[i] || null), rh: Math.min(rhMax, Math.max(rhMin, (REST_AVAIL - 62 - hh) / n)) }); rest = []; } else pages.push({ items: rest.splice(0, cap), rh: rhMin }); } }
  void firstCap; void capFirstSig; void fit; return pages;
}
async function pdfFromJpegs(jpegs) {
  const enc = new TextEncoder(); const parts = []; let len = 0; const offs = []; const push = (b) => { const u = typeof b === 'string' ? enc.encode(b) : b; parts.push(u); len += u.length; };
  const n = jpegs.length; const obj = (i, body) => { offs[i] = len; push(`${i} 0 obj\n`); push(body); push('\nendobj\n'); };
  push('%PDF-1.4\n%âãÏÓ\n'); obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, `<< /Type /Pages /Kids [${jpegs.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] /Count ${n} >>`);
  jpegs.forEach((j, i) => {
    const pg = 3 + i * 3, im = pg + 1, ct = pg + 2; const wpt = (PW / 25.4 * 72).toFixed(2), hpt = (PH / 25.4 * 72).toFixed(2);
    obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wpt} ${hpt}] /Resources << /XObject << /Im0 ${im} 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ${ct} 0 R >>`);
    offs[im] = len; push(`${im} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${j.w} /Height ${j.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${j.data.length} >>\nstream\n`); push(j.data); push('\nendstream\nendobj\n');
    const cs = `q ${wpt} 0 0 ${hpt} 0 0 cm /Im0 Do Q`; obj(ct, `<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
  });
  const total = 2 + n * 3; const xr = len; push(`xref\n0 ${total + 1}\n0000000000 65535 f \n`); for (let i = 1; i <= total; i++) push(`${String(offs[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`);
  const out = new Uint8Array(len); let p = 0; for (const u of parts) { out.set(u, p); p += u.length; } return new Blob([out], { type: 'application/pdf' });
}
export async function buildCt01(roomId) {
  const m = ct01Model(roomId); if (!m) throw new Error('Phòng này hiện không có khách đang thuê');
  try { await document.fonts.ready; } catch { /* dùng font hệ thống */ }
  const pages = chunk(m); const jpegs = [];
  for (let i = 0; i < pages.length; i++) {
    const cv = document.createElement('canvas'); cv.width = Math.round(PW * PXMM); cv.height = Math.round(PH * PXMM); const ctx = cv.getContext('2d'); ctx.scale(PXMM, PXMM); ctx.textBaseline = 'alphabetic';
    drawPage(ctx, m, pages[i], i + 1, pages.length, i === 0);
    const blob = await new Promise((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error('Không tạo được trang'))), 'image/jpeg', 0.93));
    jpegs.push({ w: cv.width, h: cv.height, data: new Uint8Array(await blob.arrayBuffer()) });
  }
  return { blob: await pdfFromJpegs(jpegs), name: `ban-khai-CT01-${slug(m.room.name)}-${today()}.pdf`, pages: pages.length };
}
export async function downloadCt01(roomId) {
  const r = await buildCt01(roomId); const a = document.createElement('a'); a.href = URL.createObjectURL(r.blob); a.download = r.name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); return r;
}
