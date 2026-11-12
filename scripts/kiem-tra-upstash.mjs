// Kiểm tra kết nối Upstash ngay trên máy bạn.  Chạy:  node scripts/kiem-tra-upstash.mjs
// (sẽ hỏi địa chỉ REST URL và REST TOKEN; hoặc đặt sẵn biến KV_REST_API_URL / KV_REST_API_TOKEN)
import readline from 'node:readline/promises';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const clean = (s) => String(s || '').trim().replace(/^["']|["']$/g, '');
let url = clean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);
let token = clean(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN);
if (!url) url = clean(await rl.question('Dán REST URL (dạng https://xxxx.upstash.io): '));
if (!token) token = clean(await rl.question('Dán REST TOKEN (khóa có quyền GHI): '));
rl.close();
const ok = (m) => console.log('  ✅', m), no = (m) => console.log('  ❌', m);
if (/^rediss?:\/\//i.test(url)) { no('Bạn đã dán địa chỉ kiểu rediss://… (KV_URL/REDIS_URL). Cần địa chỉ bắt đầu bằng https:// (KV_REST_API_URL).'); process.exit(1); }
if (!/^https?:\/\//i.test(url)) { no('REST URL phải bắt đầu bằng https://'); process.exit(1); }
url = url.replace(/\/$/, '');
async function cmd(...a) {
  let res; try { res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(a) }); } catch (e) { return { err: `Không kết nối được tới ${url} (${e.cause?.code || e.message}). Sai địa chỉ hoặc mất mạng.` }; }
  const j = await res.json().catch(() => ({})); if (res.status === 401 || res.status === 403) return { err: 'Token bị từ chối (sai/đã đổi/đã reset). Lấy lại REST TOKEN trong Upstash.' };
  if (j.error) return { err: j.error }; return { r: j.result };
}
console.log(`\nĐang kiểm tra ${url} …\n`); let bad = 0;
let x = await cmd('PING'); if (x.err) { no(`PING: ${x.err}`); process.exit(1); } ok(`Kết nối được (PING → ${x.r})`);
x = await cmd('SET', 'nt44:kiemtra', 'ok', 'EX', '60'); if (x.err) { bad++; no(/NOPERM|read.?only|permission/i.test(x.err) ? 'Token này CHỈ ĐỌC, không ghi được. Dùng REST TOKEN thường (KV_REST_API_TOKEN, không phải READ_ONLY; trong Upstash bỏ tick "Read-Only Token").' : `Ghi thử lỗi: ${x.err}`); } else ok('Ghi được dữ liệu (quyền GHI đúng)');
x = await cmd('GET', 'nt44:kiemtra'); if (!x.err && x.r === 'ok') ok('Đọc lại đúng dữ liệu vừa ghi'); else if (!bad) { bad++; no(`Đọc thử lỗi: ${x.err || x.r}`); }
await cmd('DEL', 'nt44:kiemtra');
x = await cmd('STRLEN', 'nt44:db'); if (!x.err) console.log(Number(x.r) > 0 ? `  ℹ️  Đã có dữ liệu nhà trọ trong database (${Math.round(x.r / 1024 * 10) / 10} KB nén).` : '  ℹ️  Database còn trống (bình thường nếu chưa dùng; web sẽ tự tạo 7 phòng ở lần đầu).');
console.log(bad ? '\n❌ CHƯA ỔN – sửa theo dòng ❌ ở trên rồi chạy lại.\n' : '\n✅ ĐÃ ỔN: giá trị URL và TOKEN này dùng được. Đặt đúng hai giá trị này vào Vercel: KV_REST_API_URL và KV_REST_API_TOKEN.\n');
process.exit(bad ? 1 : 0);
