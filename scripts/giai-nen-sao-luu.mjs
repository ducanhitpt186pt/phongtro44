// Khôi phục dữ liệu từ tab "SaoLuuDayDu" của Google Sheet.
// Cách dùng:  node scripts/giai-nen-sao-luu.mjs  duong-dan/SaoLuuDayDu.csv
// (Trong Google Sheet: chọn tab SaoLuuDayDu → Tệp → Tải xuống → Giá trị phân tách bằng dấu phẩy (.csv))
// Kết quả: file database-khoi-phuc.json → đưa vào web: Sao lưu → chọn file → gõ GHI DE → KIỂM TRA & KHÔI PHỤC.
import fs from 'node:fs'; import zlib from 'node:zlib';
const file = process.argv[2]; if (!file) { console.log('Cách dùng: node scripts/giai-nen-sao-luu.mjs SaoLuuDayDu.csv'); process.exit(1); }
function parseCsv(text) { const rows = []; let row = [], cell = '', q = false; for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; } else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c; } if (cell || row.length) { row.push(cell); rows.push(row); } return rows.filter((r) => r.some((x) => x !== '')); }
const rows = parseCsv(fs.readFileSync(file, 'utf8')).filter((r) => /^\d+$/.test(r[2] || '') && /^\d+$/.test(r[3] || '') && (r[4] || '') !== ''); if (!rows.length) { console.log('❌ Không thấy dòng bản sao lưu nào (các cột Phần / Tổng số phần phải là số). Kiểm tra bạn đã tải đúng tab SaoLuuDayDu.'); process.exit(1); }
const last = rows[rows.length - 1]; const total = Number(last[3]); const parts = rows.slice(-total);
if (parts.length !== total || parts.some((p, i) => Number(p[2]) !== i + 1)) { console.log(`❌ Bản sao lưu mới nhất thiếu phần (cần ${total} phần liên tiếp). Hãy bấm "Sao lưu đầy đủ ngay" trên web rồi tải lại CSV.`); process.exit(1); }
if (!parts[0][4].startsWith('gz:')) { console.log('❌ Dữ liệu không đúng định dạng (phần 1 phải bắt đầu bằng gz:).'); process.exit(1); }
const json = zlib.gunzipSync(Buffer.from(parts.map((p) => p[4]).join('').slice(3), 'base64')).toString('utf8'); const db = JSON.parse(json);
fs.writeFileSync('database-khoi-phuc.json', JSON.stringify(db, null, 1));
console.log(`✅ Đã tạo database-khoi-phuc.json từ bản sao lưu lúc ${last[0]} (phiên bản ${last[1]}): ${db.rooms.length} phòng, ${db.tenants.length} khách, ${db.invoices.length} hóa đơn, ${db.payments.length} giao dịch.`);
if (db.tenants.some((t) => t.cccd === '' && t.fullName)) console.log('ℹ️  Bản này không chứa SĐT/CCCD (bạn đã tắt gửi thông tin cá nhân vào Google Sheet).');
