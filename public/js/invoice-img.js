// Mẫu hóa đơn dùng chung cho màn hình (HTML) và ảnh JPG tải về/gửi Zalo (vẽ bằng canvas, không cần thư viện ngoài).
import { dmy } from './util.js';
import { apiUrl } from './api.js';
const n = (x) => (Number(x) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const vnd = (x) => `${n(Math.round(x))} đ`;
const slug = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// i = hóa đơn, x = {paid, remaining}
export function billModel(i, x, bank = null, qr = null) {
  const title = `Hóa Đơn ${i.roomName} - 44 Lê Văn Phấn`;
  const info = [['Ngày tính tiền', dmy(i.dueDate)]];
  if (i.kind === 'periodic') info.push(['Kỳ', `${dmy(i.periodStart)} – ${dmy(i.periodEnd)}`]);
  const meters = [];
  if (i.elec && i.water) meters.push([['Số nước cũ', n(i.water.old)], ['Số nước mới', n(i.water.new)]], [['Số điện cũ', n(i.elec.old)], ['Số điện mới', n(i.elec.new)]]);
  const calc = [];
  if (i.elec) calc.push({ label: 'Tiền điện', formula: `${n(i.elec.new)} − ${n(i.elec.old)} = ${n(i.elec.usage)} × ${n(i.elec.price)} đ`, amount: i.elec.amount });
  if (i.water) calc.push({ label: 'Tiền nước', formula: `${n(i.water.new)} − ${n(i.water.old)} = ${n(i.water.usage)} × ${n(i.water.price)} đ`, amount: i.water.amount });
  const co = i.kind === 'checkout' && i.actualRent !== undefined; // hóa đơn trả phòng (bản mới): Tiền phòng = số ngày ở × giá/ngày, không còn dòng âm "trừ tiền thuê"
  if (co) calc.push({ label: 'Tiền phòng', formula: `${n(i.daysUsed)} ngày × ${n(Math.round(i.rentPerDay))} đ/ngày (giá thuê ${n(i.monthRent)} đ ÷ 30 ngày)`, amount: i.actualRent });
  else if (i.rent) calc.push({ label: 'Tiền phòng', formula: i.kind === 'periodic' && !i.elec ? 'Kỳ đầu (chưa có điện nước)' : '', amount: i.rent });
  const debt = co ? Math.max(0, i.carryNet || 0) : (i.oldDebt || 0) + (i.manualDebt || 0); if (debt) { const months = (i.oldDebtMonths || []).map((x) => `Còn nợ tháng ${Number(x.ym.slice(5))}/${x.ym.slice(0, 4)}: ${n(x.amount)} đ`); const f = co ? ['Các khoản chưa thanh toán trước đó'] : [...(months.length ? months : i.oldDebt ? ['Các tháng trước chưa thanh toán'] : []), ...(i.manualDebt ? [`Nợ nhập thêm: ${n(i.manualDebt)} đ`] : [])]; calc.push({ label: 'Nợ cũ', formula: f.join('\n'), amount: debt }); }
  if (!co) for (const l of i.adjustLines || []) calc.push({ label: l.label, formula: '', amount: l.amount });
  for (const e of i.extras || []) calc.push({ label: e.label === 'Chi phí khác' ? 'Chi phí khác' : `Chi phí khác: ${e.label}`, formula: '', amount: e.amount }); // không có thì không hiện dòng nào
  const dep = co ? i.depositApplied || 0 : 0; if (co && ((i.carryNet || 0) < 0 || dep > 0)) { calc.push({ label: 'Cộng các khoản', formula: '', amount: i.total - Math.min(i.carryNet || 0, 0) + dep }); if ((i.carryNet || 0) < 0) calc.push({ label: 'Trừ: đã thu trước (tiền phòng đầu kỳ)', formula: '', amount: i.carryNet }); if (dep > 0) calc.push({ label: 'Trừ: tiền đặt cọc đã nhận', formula: 'Hoàn lại cho khách khi trả phòng: cọc dùng để bù các khoản trên, phần dư trả lại khách', amount: -dep }); }
  const totalLabel = co ? (i.total < 0 ? 'Chủ nhà hoàn lại cho khách' : 'Khách còn phải trả') : i.total < 0 ? 'Chủ nhà hoàn lại cho khách' : `Tổng tiền ${i.roomName.toLowerCase()} là`;
  const foot = []; if (i.total > 0 && (x.paid > 0 || x.remaining > 0)) foot.push(['Đã thanh toán trước', vnd(x.paid)], ['Còn nợ', vnd(x.remaining), true]);
  const pay = bank && i.total > 0 ? [['Ngân hàng', bank.bankName], ['Số tài khoản', bank.accountNumber], ['Chủ tài khoản', bank.accountName]] : null;
  const qrUrl = qr && i.total > 0 ? apiUrl(`storage/${qr.id}`) : null; // chỉ hiện khi đã tải ảnh QR lên
  return { pay, qr: qrUrl, title, info, meters, calc, total: { label: totalLabel, value: vnd(Math.abs(i.total)) }, foot, file: `hoa-don-${slug(i.roomName)}-${i.dueDate}.jpg`, room: i.roomName, money: vnd };
}

// ---- Vẽ ảnh JPG ----
const FONT = '"SVN-Avo","Inter",-apple-system,"Segoe UI",Roboto,sans-serif';
async function fonts() { try { await Promise.all(['400', '600', '700'].map((w) => document.fonts.load(`${w} 30px Inter`))); await document.fonts.ready; } catch { /* dùng font hệ thống */ } }
function rr(c, x, y, w, h, r, fill) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); c.fillStyle = fill; c.fill(); }
export async function renderBill(m) {
  await fonts();
  const W = 1080, P = 64, IW = W - P * 2;
  // bố cục: tính chiều cao trước
  let h = P + 130; h += m.info.length * 58 + 20; h += m.meters.length ? m.meters.length * 62 + 20 : 0; h += m.calc.reduce((s, r) => s + 78 + (r.formula ? r.formula.split(String.fromCharCode(10)).length * 38 - 4 : 0), 0) + 30; h += 150; h += m.foot.reduce((s, r) => s + (r[2] ? 84 : 58), 0); h += m.pay || m.qr ? (m.qr ? 340 : 250) : 0; h += 120;
  let qrImg = null; if (m.qr) { try { const r = await fetch(m.qr, { credentials: 'same-origin' }); qrImg = await createImageBitmap(await r.blob()); } catch { /* không tải được QR thì bỏ qua */ } }
  const cv = document.createElement('canvas'); cv.width = W; cv.height = h; const c = cv.getContext('2d');
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, h); rr(c, 24, 24, W - 48, h - 48, 40, '#f5f7fa');
  let y = P + 6; c.textBaseline = 'alphabetic';
  c.fillStyle = '#007aff'; c.font = `700 46px ${FONT}`; c.textAlign = 'center';
  // tiêu đề tự xuống dòng nếu dài
  const words = m.title.split(' '); let line = '', lines = []; for (const w of words) { const t = line ? `${line} ${w}` : w; if (c.measureText(t).width > IW) { lines.push(line); line = w; } else line = t; } lines.push(line);
  lines.forEach((l, k) => c.fillText(l, W / 2, y + 46 + k * 56)); y += 46 + lines.length * 56 + 24; if (lines.length > 1) h += 0;
  c.strokeStyle = '#d9dee5'; c.lineWidth = 2; c.beginPath(); c.moveTo(P, y); c.lineTo(W - P, y); c.stroke(); y += 22;
  const kv = (k, v, bold = false, red = false) => { const big = red ? 1.45 : 1; c.textAlign = 'left'; c.fillStyle = red ? '#c42a1d' : '#6c6c70'; c.font = `${red ? 800 : 400} ${Math.round(32 * big)}px ${FONT}`; c.fillText(k, P, y + 36 * big + (red ? 4 : 0)); c.textAlign = 'right'; c.fillStyle = red ? '#c42a1d' : '#1c1c1e'; c.font = `${red || bold ? 800 : 600} ${Math.round(34 * big)}px ${FONT}`; c.fillText(v, W - P, y + 36 * big + (red ? 4 : 0)); y += Math.round(58 * big); };
  for (const [k, v] of m.info) kv(k, v);
  if (m.meters.length) { y += 10; for (const [a, b] of m.meters) { c.textAlign = 'left'; c.fillStyle = '#6c6c70'; c.font = `400 32px ${FONT}`; c.fillText(a[0], P, y + 38); c.fillStyle = '#1c1c1e'; c.font = `700 36px ${FONT}`; c.fillText(a[1], P + 250, y + 38); c.fillStyle = '#6c6c70'; c.font = `400 32px ${FONT}`; c.fillText(b[0], P + 480, y + 38); c.fillStyle = '#1c1c1e'; c.font = `700 36px ${FONT}`; c.fillText(b[1], P + 730, y + 38); y += 62; } y += 10; }
  y += 8;
  for (const r of m.calc) {
    const fl = r.formula ? r.formula.split(String.fromCharCode(10)) : []; const hh = 66 + (fl.length ? fl.length * 38 - 4 : 0); rr(c, P - 16, y, IW + 32, hh, 14, r.info ? '#eef3fb' : '#ffffff');
    c.textAlign = 'left'; c.fillStyle = '#1c1c1e'; c.font = `600 33px ${FONT}`; let lab = r.label; while (c.measureText(lab).width > IW - 330 && lab.length > 6) lab = lab.slice(0, -2); if (lab !== r.label) lab += '…'; c.fillText(lab, P, y + 44);
    c.textAlign = 'right'; c.font = `700 36px ${FONT}`; c.fillStyle = r.info ? '#6c6c70' : r.amount < 0 ? '#1f8a3b' : '#1c1c1e'; c.fillText(r.info ? `(${m.money(r.amount)})` : m.money(r.amount), W - P, y + 44);
    fl.forEach((ln, k) => { c.textAlign = 'left'; c.fillStyle = '#6c6c70'; c.font = `400 28px ${FONT}`; let t = ln; while (c.measureText(t).width > IW - 20 && t.length > 8) t = t.slice(0, -2); c.fillText(t === ln ? t : t + '…', P, y + 82 + k * 38); });
    y += hh + 12;
  }
  y += 18; rr(c, P - 16, y, IW + 32, 124, 28, '#007aff'); c.textAlign = 'left'; c.fillStyle = '#ffffff'; c.font = `600 32px ${FONT}`; c.fillText(m.total.label, P + 8, y + 52); c.textAlign = 'right'; c.font = `700 52px ${FONT}`; c.fillText(m.total.value, W - P - 8, y + 100); y += 124 + 26;
  for (const [k, v, red] of m.foot) kv(k, v, red, red);
  if (m.pay || qrImg) {
    const hasQ = !!qrImg; const bh = hasQ ? 320 : 214; y += 8; rr(c, P - 16, y, IW + 32, bh, 14, '#ffffff'); c.textAlign = 'left'; c.fillStyle = '#007aff'; c.font = `700 28px ${FONT}`; c.fillText(m.pay ? 'THÔNG TIN CHUYỂN KHOẢN' : 'QUÉT MÃ QR ĐỂ CHUYỂN KHOẢN', P + 8, y + 46);
    const rightEdge = hasQ ? W - P - 8 - 250 : W - P - 8; let yy = y + 50;
    if (m.pay) for (const [k, v] of m.pay) { c.textAlign = 'left'; c.fillStyle = '#6c6c70'; c.font = `400 30px ${FONT}`; c.fillText(k, P + 8, yy + 42); c.textAlign = 'right'; c.fillStyle = '#1c1c1e'; c.font = `700 32px ${FONT}`; let vv = String(v); while (c.measureText(vv).width > rightEdge - P - 200 && vv.length > 6) vv = vv.slice(0, -2); if (vv !== String(v)) vv += '…'; c.fillText(vv, rightEdge, yy + 42); yy += 52; }
    if (hasQ) { const qs = 230; const qx = m.pay ? W - P - 8 - qs : Math.round((W - qs) / 2); const qy = y + 64; c.fillStyle = '#fff'; c.fillRect(qx - 6, qy - 6, qs + 12, qs + 12); const sc = Math.min(qs / qrImg.width, qs / qrImg.height); const dw = qrImg.width * sc, dh = qrImg.height * sc; c.drawImage(qrImg, qx + (qs - dw) / 2, qy + (qs - dh) / 2, dw, dh); }
    y += bh + 20;
  }
  c.textAlign = 'center'; c.fillStyle = '#8e8e93'; c.font = `400 26px ${FONT}`; c.fillText('Nhà trọ 44 Lê Văn Phấn – cảm ơn quý khách', W / 2, Math.min(h - 56, y + 56));
  return new Promise((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error('Không tạo được ảnh'))), 'image/jpeg', 0.92));
}
export async function saveBill(m, { share = false } = {}) {
  const blob = await renderBill(m); const file = new File([blob], m.file, { type: 'image/jpeg' });
  if (share && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: `Hóa đơn ${m.room}` }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = m.file; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); return 'downloaded';
}
