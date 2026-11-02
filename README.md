# NHÀ TRỌ 44 LÊ VĂN PHẤN – Hệ thống quản lý nhà trọ

Website dùng thật cho **một chủ nhà**, ban đầu 7 phòng, mở rộng được. Chạy hoàn toàn trên gói miễn phí GitHub + Vercel.

## Kiến trúc (không dùng Supabase)
| Thành phần | Nơi chạy | Ghi chú |
|---|---|---|
| Giao diện (HTML/CSS/JS thuần, không cần build) | Vercel (thư mục `public/`) | Responsive, cài được như app (PWA nhẹ) |
| Backend API | Vercel Serverless Function duy nhất `api/[...path].js` | Gói Hobby giới hạn 12 Function nên dùng 1 router |
| Dữ liệu `database.json` | Repo GitHub **PRIVATE** `nha-tro-44-private-data` | Ghi qua GitHub Contents API, chống ghi đè bằng SHA |
| Ảnh CCCD | **Vercel Blob – kho Private** | Không nằm trong GitHub; chỉ xem qua API đã đăng nhập |
| Bí mật (mật khẩu, token) | Environment Variables của Vercel | Không có trong mã nguồn |

## Cấu trúc thư mục
```
api/[...path].js        Cổng vào API (1 Function)
lib/router.js           Định tuyến + kiểm tra đăng nhập/CSRF
lib/auth.js             Mật khẩu, phiên (cookie HttpOnly+Secure+SameSite=Strict, ký HMAC), CSRF, chống dò mật khẩu
lib/github-db.js        Đọc/ghi GitHub có SHA, thử lại khi xung đột, sao lưu tháng
lib/billing.js          LÕI TÍNH TIỀN: hóa đơn, nợ, thanh toán, đổi giá, trả phòng, chuyển phòng
lib/reminders.js        Tự tính thông báo + API công khai đã lọc
lib/schema.js           Cấu trúc dữ liệu + kiểm tra toàn vẹn
lib/handlers/index.js   Các thao tác nghiệp vụ gọi từ API
lib/blob.js             Kho ảnh riêng tư
public/                 Giao diện (index.html, css/, js/ và js/views/)
tests/                  Kiểm thử tự động
docs/                   Hướng dẫn triển khai, giới hạn
```
## Quy tắc nghiệp vụ đã chốt
- Tiền phòng **thu trước** mỗi kỳ; điện nước **thu sau** (số tiêu thụ của kỳ trước, chốt tại ngày đến hạn).
- Kỳ đầu thu đủ tiền phòng. Thêm người ở cùng phòng **không** tính thêm tiền.
- Ngày đến hạn tính từ ngày vào ở; tháng thiếu ngày thì lấy ngày cuối tháng (31/01 → 28/02 → 31/03).
- Nợ chỉ nằm ở hóa đơn mới nhất của khách; hóa đơn cũ có nợ được đánh dấu "đã chuyển nợ" → không bao giờ tính hai lần.
- Trả phòng: giá ngày = giá tháng ÷ 30; quyết toán = nợ còn lại − tiền phòng chưa dùng + tiền phòng thực tế (nếu kỳ chưa lập) + điện + nước + phát sinh. Kỳ chưa thanh toán không bị trừ "tiền trả trước".
- Không có tiền cọc, không có tài khoản khách.

## Kiểm thử
`npm test` (logic tính tiền, 26 ca) · `node tests/integration.js` (API + GitHub giả lập, 11 ca) · `tests/e2e.cjs` (trình duyệt thật, cần Playwright; chạy cùng `node tests/e2e-server.js`).

Hướng dẫn cho người không biết lập trình: **docs/HUONG-DAN-TRIEN-KHAI.md**.
