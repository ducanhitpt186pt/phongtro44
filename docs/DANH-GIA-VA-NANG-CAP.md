# Đánh giá mã nguồn & việc nên làm thêm (cập nhật 2026-11-13)

## A. Đã kiểm tra bằng máy (đạt)
- 42 ca logic tiền/ngày/điện nước/lịch âm/sự kiện; 5 bộ kiểm thử API (Upstash, Blob, GitHub giả lập, Google Sheet giả lập); 11 bộ kiểm thử trình duyệt; rà soát tĩnh (`node tests/audit.mjs`): không có nút nào thiếu xử lý, không có API client gọi mà server không có, mọi biến môi trường đều có tài liệu.
- Lỗi thật tìm thấy trong đợt rà soát này và ĐÃ SỬA: (1) nút ✕ đóng hộp thoại không hoạt động; (2) hộp thoại đang mở vẫn nằm lại khi chuyển trang.

## B. CHƯA kiểm chứng được (cần bạn thử trên đồ thật – quan trọng nhất)
| # | Việc | Cách thử | Nếu lỗi |
|---|---|---|---|
| 1 | Kết nối Upstash + Blob thật | `/kiemtra.html` toàn ✅; thêm khách thử | gửi ảnh `/kiemtra.html` |
| 2 | Camera CCCD trên iPhone / iPad / Android | Thêm khách → CHỤP CCCD | ghi rõ máy + trình duyệt |
| 3 | Tải ảnh hóa đơn JPG + "Gửi Zalo / Chia sẻ" trên iPhone | Hóa đơn → Tải hóa đơn | ghi rõ máy |
| 4 | Google Sheet thật (Apps Script) | Sao lưu → Kiểm tra kết nối → Gửi dòng thử | gửi thông báo lỗi hiện ra |
| 5 | Phiên 5 phút trên máy thật | dùng liên tục 10 phút không bị đăng xuất; để yên 6 phút bị đăng xuất | báo lại |

## C. Việc BẠN nên làm (ưu tiên từ cao xuống)
1. **Đổi khóa Upstash đã lộ trong chat** (Upstash → database → Reset Password / Rotate token → cập nhật `KV_REST_API_TOKEN` trên Vercel → Redeploy). Chưa có dữ liệu thật thì làm ngay vì rất dễ.
2. **Đổi mật khẩu** trên Vercel (Settings → Environment Variables → `APP_PASSWORD` → ⋯ → Edit → Save → Redeploy). Nên dài ≥ 12 ký tự có chữ + số + ký hiệu.
3. **Kết nối Google Sheet** (docs/GOOGLE-SHEET.md hoặc hướng dẫn ngay trong web: tab Sao lưu).
4. Mỗi tháng bấm **Sao lưu → Tải database.json** cất ở Google Drive.
5. Nhập dữ liệu thật theo thứ tự: 7 phòng → khách → (khai báo đồng hồ tổng ở thẻ **Chủ Nhà**) → ngày chốt số điện nước đúng ngày đọc đồng hồ.
6. Mở `/kiemtra.html` sau MỖI lần cập nhật phiên bản để chắc mọi thứ ✅.

## D. Giới hạn kỹ thuật cần nhớ
- Mọi người biết địa chỉ web đều xem được trang ngoài (tên phòng, số tiền, họ tên khách, sự kiện nếu bật). SĐT/CCCD/ngày sinh/địa chỉ không bao giờ hiện.
- Chống dò mật khẩu: sai 8 lần → khóa 10 phút (theo IP; bộ đếm dùng chung qua Upstash khi có). Mỗi thao tác được giữ 5 phút, để yên quá 5 phút phải nhập lại mật khẩu. Mật khẩu mạnh vẫn là lớp bảo vệ chính.
- Số liệu hạn mức Upstash hiển thị là ước tính; số chính xác xem trong bảng điều khiển Upstash.
- Điện nước Chủ Nhà dùng nội suy theo ngày giữa các lần ghi chỉ số; chính xác nhất khi bạn nhập **ngày chốt số** đúng ngày đọc đồng hồ và nhập đồng hồ tổng đều đặn.
- Hóa đơn ảnh JPG chỉ tạo trên máy bạn khi bấm tải; không lưu lên máy chủ/Sheet.
- Dịch vụ miễn phí bên thứ ba (Vercel, Upstash, Google) có thể đổi chính sách; nên giữ bản sao lưu ngoài hệ thống.

## E. Nâng cấp có thể làm sau (chưa làm; nói tôi nếu bạn muốn)
1. **Gửi thông báo tự động** (Zalo OA / Telegram / email) khi có cảnh báo rò rỉ, quá hạn, sự kiện sắp đến – hiện chỉ hiển thị trên màn hình khi mở web.
2. **Lịch sử giá & hợp đồng**: màn hình xem lại lịch sử đổi giá từng phòng; ngày hết hạn hợp đồng + nhắc gia hạn.
3. **Xuất báo cáo PDF / Excel .xlsx thật** (hiện là CSV + in trình duyệt).
4. **Mã QR chuyển khoản** trên hóa đơn ảnh (cần số tài khoản ngân hàng của bạn).
5. **Nhiều người dùng / phân quyền** (hiện chỉ một chủ nhà, một mật khẩu).
6. **Tên miền riêng** (ví dụ nhatro44.vn) cho đẹp và dễ nhớ.
7. **Cài đặt PWA có chạy offline** (hiện cài được như ứng dụng nhưng cần mạng).
