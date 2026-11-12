// XÓA TOÀN BỘ dữ liệu nhà trọ trong Upstash (để làm lại từ đầu).  Chạy:  node scripts/xoa-du-lieu-upstash.mjs
import readline from 'node:readline/promises';
const ask = async (q) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); try { return await rl.question(q); } finally { rl.close(); } };
const clean = (s) => String(s || '').trim().replace(/^["']|["']$/g, '');
const url = clean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || await ask('Dán REST URL: ')).replace(/\/$/, '');
const token = clean(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || await ask('Dán REST TOKEN (quyền ghi): '));
const cmd = async (...a) => { const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(a) }); const j = await r.json(); if (j.error) throw new Error(j.error); return j.result; };
const keys = []; let cur = '0';
do { const [n, ks] = await cmd('SCAN', cur, 'MATCH', 'nt44:*', 'COUNT', '200'); cur = String(n); keys.push(...ks); } while (cur !== '0');
console.log(`\nTìm thấy ${keys.length} mục dữ liệu của Nhà trọ 44 (khóa: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? ', …' : ''}).`);
if (!keys.length) { console.log('Không có gì để xóa.'); process.exit(0); }
console.log('⚠ Xóa là MẤT HẾT dữ liệu (phòng, khách, hóa đơn, bản sao lưu tự động). Hãy chắc bạn đã tải file sao lưu .json về máy.');
if ((await ask('Gõ đúng chữ XOA rồi Enter để xóa (Enter trống = hủy): ')).trim() !== 'XOA') { console.log('Đã hủy, không xóa gì.'); process.exit(0); }
for (let i = 0; i < keys.length; i += 100) await cmd('DEL', ...keys.slice(i, i + 100));
console.log(`✅ Đã xóa ${keys.length} mục. Lần mở web tiếp theo sẽ tạo lại 7 phòng trống.`);
