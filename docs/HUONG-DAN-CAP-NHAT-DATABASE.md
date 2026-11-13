# Cập nhật database lên bản mới & chuyển sang database mới (từng bước, nút bấm cụ thể)

Dữ liệu nhà trọ nằm ở **Upstash Redis** (chữ, hóa đơn, khách…) và **Vercel Blob** (ảnh CCCD). Mã nguồn nằm ở GitHub/Vercel và **không chứa dữ liệu**, nên cập nhật mã không làm mất dữ liệu.

## PHẦN A. Cập nhật lên bản mới, GIỮ NGUYÊN database hiện có (cách thường dùng)
Bản mới có thêm dữ liệu mới (đồng hồ tổng, sự kiện, Zalo, địa chỉ người ở cùng, thu tiền theo tháng…). Bạn **không phải tạo bảng hay sửa database**: lần đầu bản mới đọc dữ liệu, nó tự thêm phần mới và giữ nguyên dữ liệu cũ; lần lưu kế tiếp sẽ ghi dữ liệu đã nâng cấp vào Upstash.

**Bước 1 – Sao lưu (bắt buộc nên làm)**
1. Mở web, đăng nhập.
2. Bấm tab **Sao lưu** → nút xanh **Tải database.json**. Đổi tên file thành `sao-luu-truoc-cap-nhat.json`, cất vào Google Drive / gửi email cho chính bạn.

**Bước 2 – Đưa mã mới lên GitHub**
1. Giải nén `nha-tro-44-website.zip` mới.
2. GitHub → repo `nha-tro-44-website` → **Add file** → **Upload files**.
3. Mở thư mục giải nén, nhấn **Ctrl+A** chọn hết thư mục và file bên trong (không kéo thư mục bao ngoài), kéo thả vào khung. Đợi 100%.
4. Cuộn xuống → **Commit changes**.

**Bước 3 – Chờ Vercel triển khai**
1. Vercel → dự án → thẻ **Deployments**. Dòng trên cùng chuyển **Building** → **Ready** (~1 phút).
2. Nếu ghi **Error**: bấm vào dòng đó → **Build Logs** → chụp chữ đỏ gửi tôi.
3. Nếu bản mới ghi **Preview**: bấm **⋯** → **Promote to Production**.

**Bước 4 – Kiểm tra**
1. Mở `https://<tên-web>/kiemtra.html`: mọi dòng ✅, "phiên bản giao diện" là `2026-11-22-a`; dòng "Đọc dữ liệu từ Upstash: được".
2. Mở web (Ctrl+F5), bấm **Ghi Điện & Nước - Tính Tiền Phòng**, đăng nhập. Phòng, khách, hóa đơn cũ **còn nguyên**; trong danh sách phòng có thẻ **Chủ Nhà**.
3. Làm một thao tác lưu nhỏ (ví dụ vào Chủ Nhà → khai báo đồng hồ tổng, hoặc thêm một sự kiện). Lần lưu này ghi dữ liệu đã nâng cấp vào Upstash.

**Bước 5 – Việc làm một lần sau khi nâng cấp**
- Chủ Nhà → khai báo **đồng hồ tổng hiện tại** và **thông tin nhận tiền** (ngân hàng, số tài khoản, tên chủ tài khoản).
- Khách cũ chưa có số Zalo: nút Zalo tự dùng số điện thoại; muốn khác thì Hồ sơ khách → **Sửa thông tin**.
- Người ở cùng cũ chưa có địa chỉ: Hồ sơ khách → **Sửa** để bổ sung (không bắt buộc với dữ liệu cũ).

## PHẦN B. Chuyển dữ liệu sang DATABASE MỚI (đổi/tạo lại Upstash, hoặc đổi nhà cung cấp)
**Bước 1 – Xuất dữ liệu từ nơi cũ:** làm Phần A bước 1 (**Tải database.json**). Muốn giữ cả ảnh CCCD: ảnh nằm ở Vercel Blob (không đổi khi đổi Upstash). Chỉ khi đổi cả kho ảnh mới phải tải lại từng ảnh ở hồ sơ khách → **Tải về**.

**Bước 2 – Tạo database mới**
1. Vercel → dự án → thẻ **Storage** → **Create Database** → **Upstash** → **Redis** → gói **Free**, vùng **Singapore** → **Create** → tick cả 3 môi trường → **Connect**.
2. (Tùy chọn kiểm tra bằng CMD) trên máy: `node scripts\kiem-tra-upstash.mjs`, dán REST URL + REST TOKEN **có quyền ghi** (không phải READ_ONLY). Phải ra ✅.

**Bước 3 – Trỏ web sang database mới**
- Vercel tự đặt `KV_REST_API_URL` và `KV_REST_API_TOKEN` cho database vừa nối. Nếu còn biến cũ trỏ về database cũ: **Settings** → **Environment Variables** → xóa/sửa cho khớp database mới (bằng CMD: `vercel env rm KV_REST_API_TOKEN production`, rồi `vercel env add KV_REST_API_TOKEN production`).
- **Deployments** → **⋯** → **Redeploy**.

**Bước 4 – Nạp dữ liệu vào database mới**
1. Mở `/kiemtra.html` → mọi dòng ✅ (database mới còn trống là bình thường).
2. Đăng nhập → tab **Sao lưu** → ô chọn file → chọn `sao-luu-truoc-cap-nhat.json` → gõ đúng `GHI DE` → **KIỂM TRA & KHÔI PHỤC**.
3. Kiểm tra: phòng, khách, hóa đơn, công nợ giống như cũ. Dòng "Lưu trữ" ở cuối trang cho biết dung lượng dữ liệu.

**Bước 5 – Dọn dẹp:** sau vài ngày chạy ổn, mới xóa database cũ trong Upstash (Upstash console → database cũ → **Delete**).

## PHẦN C. Xem database trong Upstash (chỉ để xem, ĐỪNG sửa tay)
Upstash console → database → **Data Browser**. Các khóa của hệ thống:
- `nt44:db` – toàn bộ dữ liệu (đã nén, bắt đầu bằng `gz:` nên không đọc được bằng mắt).
- `nt44:ver` – số phiên bản để chống ghi đè.
- `nt44:cmd:AAAA-BB` – bộ đếm lệnh theo tháng.
- `nt44:x:backups/...` – bản sao lưu tự động (tự xóa sau 2 năm).
- `nt44:lf:...`, `nt44:lock:...` – bộ đếm đăng nhập sai / khóa 10 phút.
Muốn xóa SẠCH dữ liệu để làm lại: `node scripts\xoa-du-lieu-upstash.mjs` (gõ `XOA`) – chỉ làm khi đã có file sao lưu.

## PHẦN D. Nếu có sự cố
| Thấy gì | Làm gì |
|---|---|
| Web báo lỗi sau khi cập nhật | Mở `/kiemtra.html`, chụp màn hình gửi tôi |
| Muốn quay lại mã cũ | Vercel → **Deployments** → chọn bản cũ chạy tốt → **⋯** → **Promote to Production** |
| Mất/sai dữ liệu | **Sao lưu** → chọn file `.json` đã tải → `GHI DE` → **KIỂM TRA & KHÔI PHỤC** (hệ thống tự lưu bản an toàn trước khi ghi đè) |
| Có Google Sheet | Khôi phục từ tab `SaoLuuDayDu`: xem `docs/GOOGLE-SHEET.md` |
