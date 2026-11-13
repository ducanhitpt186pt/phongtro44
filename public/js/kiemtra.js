// Trang tự kiểm tra: không phụ thuộc phần còn lại của ứng dụng nên vẫn chạy được khi API/giao diện chính lỗi.
const out = document.getElementById('out');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const row = (ok, title, detail = '') => `<div class="li" style="align-items:flex-start"><span><b>${ok === null ? '➖' : ok ? '✅' : '❌'} ${esc(title)}</b>${detail ? `<br><span class="small muted">${detail}</span>` : ''}</span></div>`;
async function get(u) { try { const r = await fetch(u, { cache: 'no-store' }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* không phải JSON */ } return { status: r.status, json: j, text: t }; } catch (e) { return { status: 0, json: null, text: String(e) }; } }
async function run() {
  out.innerHTML = '<div class="boot">Đang kiểm tra…</div>'; const rows = [];
  const v = await get('/js/version.js'); const ver = /'([^']+)'/.exec(v.text || '')?.[1];
  rows.push(row(v.status === 200 && !!ver, `Giao diện (file trên GitHub → Vercel): ${ver ? 'phiên bản ' + ver : 'không đọc được'}`, v.status === 200 ? 'Phiên bản mới nhất khi tôi viết là 2026-11-20-a. Nếu cũ hơn hoặc không có: Vercel chưa triển khai bản mới (xem Deployments).' : 'Thiếu file public/js/version.js → bạn chưa upload bản mới lên GitHub hoặc Vercel chưa triển khai.'));
  const a = await get('/api/health'); const b = await get('/api/index?path=health'); const h = (a.json && a.json.ok ? a.json : b.json && b.json.ok ? b.json : null);
  rows.push(row(!!h, `Phần máy chủ Vercel (/api): ${h ? 'đang chạy' : 'KHÔNG chạy'}`, `/api/health → ${a.status || 'không kết nối'} · /api/index?path=health → ${b.status || 'không kết nối'}.${h ? '' : ' Cả hai không trả JSON = Vercel chưa chạy thư mục api (thiếu api/index.js, vercel.json hoặc triển khai lỗi).'}`));
  if (h) {
    rows.push(row(true, `Phiên bản máy chủ: ${h.phienBanMayChu || 'bản cũ (chưa có)'}`));
    rows.push(row(h.daDatMatKhau, 'Biến APP_PASSWORD (mật khẩu đăng nhập)', h.daDatMatKhau ? '' : 'Chưa có: Vercel → Settings → Environment Variables → thêm APP_PASSWORD → Redeploy.'));
    rows.push(row(h.daDatSessionSecret, 'Biến SESSION_SECRET (≥ 32 ký tự)', h.daDatSessionSecret ? '' : 'Chưa có hoặc quá ngắn: thêm/sửa SESSION_SECRET (≥ 32 ký tự) → Redeploy.'));
    rows.push(row(h.daKetNoiNoiLuuDuLieu, `Nơi lưu dữ liệu: ${h.noiLuuDuLieu || '?'}${h.dungBienUpstash ? ' (dùng biến ' + h.dungBienUpstash + ')' : ''}`, h.daKetNoiNoiLuuDuLieu ? '' : 'Chưa nối Upstash: Vercel → Storage → tạo/kết nối Upstash Redis cho dự án (tick cả 3 môi trường) → Redeploy. Cần có KV_REST_API_URL và KV_REST_API_TOKEN.'));
    const ok = h.kiemTraDocDuLieu === 'ok';
    rows.push(row(ok, `Đọc dữ liệu từ Upstash: ${ok ? 'được' : 'LỖI'}`, ok ? '' : esc(h.kiemTraDocDuLieu || '') + '<br>Hay gặp: token sai/đã đổi → vào Vercel xem KV_REST_API_TOKEN (khóa có quyền GHI, không phải READ_ONLY); hoặc hết hạn mức; hoặc database đã bị xóa.'));
    rows.push(row(h.daKetNoiKhoAnh, 'Kho ảnh CCCD (Vercel Blob)', h.daKetNoiKhoAnh ? '' : 'Chưa nối: Vercel → Storage → Blob (Private) → kết nối dự án → Redeploy. (Không ảnh hưởng xem thông báo, chỉ ảnh hưởng lưu ảnh CCCD.)'));
    const p = await get('/api/public/reminders'); rows.push(row(p.status === 200 && p.json?.ok, `Trang thông báo ngoài đăng nhập (/api/public/reminders) → ${p.status}`, p.json?.error ? esc(p.json.error) : ''));
  }
  out.innerHTML = rows.join('');
}
document.getElementById('again').addEventListener('click', run); run();
