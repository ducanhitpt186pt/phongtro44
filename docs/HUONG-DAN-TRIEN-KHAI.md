# Hướng dẫn triển khai từ A đến Z (người mới, upload bằng "Upload files" trên GitHub)

## Hệ thống lưu dữ liệu 3 lớp (không cần thay token/API)
| Lớp | Việc của nó | Có giữ dữ liệu? |
|---|---|---|
| **GitHub** | Chỉ chứa mã nguồn (giao diện + chương trình). Sửa mã không ảnh hưởng dữ liệu | Không |
| **Vercel** | Đưa web ra Internet + chạy "cầu nối" nhỏ (thư mục `api`): kiểm tra mật khẩu rồi đọc/ghi kho dữ liệu | Không |
| **Upstash Redis** (miễn phí) | Nơi lưu dữ liệu thật: phòng, khách, hóa đơn, thanh toán… | **Có** |
| **Vercel Blob** (miễn phí, riêng tư) | Chỉ chứa ảnh CCCD | **Có (ảnh)** |

Thông tin kết nối Upstash và Blob do **Vercel tự tạo và tự điền** vào dự án khi bạn bấm "kết nối", nên bạn **không phải tạo/gia hạn GitHub token hay API key** nào.
Bạn chỉ tự đặt 2 thứ: `APP_PASSWORD` (mật khẩu) và `SESSION_SECRET` (chuỗi ngẫu nhiên).

Chuẩn bị: email, điện thoại nhận mã, ~30 phút. Mở sẵn Notepad để ghi nhớ.

## Bước 1. Tài khoản GitHub
1. https://github.com → **Sign up** → nhập email, mật khẩu, username → xác minh email.

## Bước 2. Tải mã nguồn lên GitHub
1. Giải nén `nha-tro-44-website.zip`. Mở thư mục `nha-tro-44-website`: phải thấy `api`, `lib`, `public`, `tests`, `docs`, `scripts`, `package.json`, `vercel.json`.
2. Dùng **Chrome hoặc Edge**. GitHub → dấu **+** → **New repository** → **Repository name**: `nha-tro-44-website` → chọn **Private** → **Create repository**.
3. Bấm **uploading an existing file**. Chọn **tất cả** thư mục + file BÊN TRONG thư mục đã giải nén (Ctrl+A) và kéo thả vào (đừng kéo cả thư mục bao ngoài, đừng upload file zip). Đợi 100%.
4. Cuộn xuống → **Commit changes**.
✔ Kiểm tra: trong repo có `api`, `lib`, `public`, `vercel.json`; bấm vào `public` thấy `index.html`.

## Bước 3. Tài khoản Vercel + nhập dự án
1. https://vercel.com → **Sign Up** → gói **Hobby** → **Continue with GitHub** → **Authorize**.
2. **Add New…** → **Project** → cạnh `nha-tro-44-website` bấm **Import** (nếu không thấy: **Adjust GitHub App Permissions** → thêm repo đó).
3. **Framework Preset**: **Other**. **Build Command**: để trống. Nếu có ô **Output Directory** thì nhập `public`.
4. Mở **Environment Variables**, thêm 2 dòng (Key → Value → **Add**):
   - `APP_PASSWORD` = mật khẩu đăng nhập của bạn (nên ≥ 12 ký tự, có chữ + số).
   - `SESSION_SECRET` = chuỗi ngẫu nhiên ≥ 32 ký tự (gõ bừa chữ + số, ví dụ `k8Qw2ZpL9xRt4VnB7mYc1HdJ6sGe3UfA` – đừng dùng đúng ví dụ này).
5. Bấm **Deploy**, đợi chữ **Congratulations**. Bấm **Continue to Dashboard**.

## Bước 4. Tạo cơ sở dữ liệu Upstash Redis (miễn phí)
1. Trong dự án Vercel → thẻ **Storage** → **Create Database** (hoặc **Browse Marketplace**) → chọn **Upstash** → **Redis**.
2. Chọn gói **Free**. **Region**: chọn gần Việt Nam nhất (ví dụ **Singapore / ap-southeast-1**). Đặt tên `nhatro44`. Bấm **Create**/**Continue**.
3. Khi hỏi kết nối vào dự án: chọn `nha-tro-44-website`, tick mọi môi trường (Production, Preview, Development) → **Connect**.
4. **KHÔNG nhập thẻ thanh toán** ở Upstash. Gói Free: 256 MB, 500.000 lệnh/tháng; chạm hạn mức thì Upstash chặn tạm chứ không tính tiền (chỉ tính khi bạn tự thêm thẻ).
✔ Kiểm tra: **Settings → Environment Variables** của dự án có thêm các biến bắt đầu bằng `KV_` hoặc `UPSTASH_` (Vercel tự thêm).

## Bước 5. Tạo kho ảnh CCCD (Vercel Blob – riêng tư)
1. **Storage** → **Create Database** → **Blob** → **Continue**.
2. Tên `cccd`. Mục **Access** chọn **Private** (không chọn Public) → **Create** → kết nối với `nha-tro-44-website` (mọi môi trường).
✔ Kiểm tra: có biến `BLOB_READ_WRITE_TOKEN` trong Environment Variables.

## Bước 6. Triển khai lại để nhận kết nối
**Deployments** → dòng trên cùng → dấu **⋯** → **Redeploy** → **Redeploy**. Đợi xong.

## Bước 7. Kiểm tra thực tế
1. Mở địa chỉ `https://nha-tro-44-website-xxxx.vercel.app` bằng điện thoại: thấy "NHÀ TRỌ 44 LÊ VĂN PHẤN", dòng **Lưu trữ ảnh: 0%**, nút **Ghi Điện & Nước - Tính Tiền Phòng**. Không có dòng cảnh báo đỏ nào.
2. Đăng nhập → thấy 7 phòng → **Phòng 1** → **+ Thêm khách thuê** → điền thông tin, chụp 2 mặt CCCD → **LƯU KHÁCH THUÊ**.
3. Mở web bằng cửa sổ ẩn danh (chưa đăng nhập): thấy "PHÒNG 1 – Chưa thanh toán", **không có tên khách**.
4. Tải lại trang, đăng xuất rồi đăng nhập, mở bằng thiết bị khác: dữ liệu vẫn còn.
5. Hồ sơ khách → **Xem ảnh**: ảnh hiện ra.
**Khách đã ở sẵn?** Chọn "Khách đã ở sẵn", nhập ngày vào ở thật, nợ cũ (nếu có), chỉ số điện nước hiện tại ở đầu kỳ đang chạy.
**Cài như ứng dụng:** iPhone/iPad Safari: nút Chia sẻ → **Thêm vào Màn hình chính**. Android Chrome: ⋮ → **Thêm vào màn hình chính**.

## Dữ liệu thử → bắt đầu thật
Muốn xóa sạch dữ liệu thử: **Sao lưu** → khôi phục một file `database.json` mới tinh (chọn file sao lưu trước khi thêm khách thử), hoặc xóa từng khách thử rồi dùng **Dọn dữ liệu**. Cách nhanh nhất: sau khi triển khai, **chưa nhập khách thật** cho đến khi thử xong, và tải một bản sao lưu lúc dữ liệu còn trống để dùng khôi phục.

## Các tính năng mới (bản 2026-11-12)
- **Phiên đăng nhập 5 phút:** hết hạn sau 5 phút KHÔNG thao tác; đang dùng (bấm, gõ, cuộn) thì tự gia hạn nên không phải nhập lại mật khẩu. Tối đa 12 giờ liên tục. Đổi số phút bằng biến `SESSION_IDLE_MINUTES` trên Vercel.
- **Người ở cùng:** vào phòng → **Thêm người ở cùng** (nút đỏ), phải có ảnh CCCD 2 mặt (trẻ em tick "Chưa có CCCD"). Số người tự đếm, không cần nhập.
- **Chuyển phòng:** vào phòng → **Chuyển phòng** (từ phòng A sang phòng B trống).
- **Trang ngoài:** danh sách phòng (ngày vào, họ tên khách, số người, nợ, ghi chú), điện nước so với tháng trước + cảnh báo rò rỉ khi tăng > 30% so với trung bình. Bật/tắt hiện họ tên + ghi chú ở **Sao lưu → Hiển thị trên trang ngoài**.
- **Phòng Chủ Nhà:** thẻ riêng trong danh sách phòng; nhập chỉ số đồng hồ tổng đều đặn; hệ thống tính điện nước Chủ Nhà dùng = tổng − các phòng và cảnh báo khi tăng > 30%.

## Dọn dữ liệu cũ & dung lượng
- Dòng dưới tiêu đề luôn hiện **% lưu trữ ảnh**. Từ 90% chuyển đỏ "sắp đầy" kèm nút **Dọn dữ liệu**.
- **Sao lưu → Dung lượng & dọn dữ liệu cũ** → liệt kê khách đã trả phòng từ 2 năm trở lên → **XÓA DỮ LIỆU…** → xác nhận (trình duyệt tự tải bản sao lưu trước khi xóa). Khách đang thuê không bao giờ bị xóa.

## Đổi mật khẩu
Vercel → dự án → **Settings** → **Environment Variables** → `APP_PASSWORD` → **⋯** → **Edit** → mật khẩu mới → **Save** → **Deployments** → **Redeploy**. Muốn đăng xuất mọi thiết bị: đổi `SESSION_SECRET` rồi Redeploy.

## Sao lưu & khôi phục
- **Sao lưu → Tải database.json** mỗi tháng và cất ở Google Drive/email (bản tự động nằm cùng nhà cung cấp nên không thay thế được).
- Hệ thống tự lưu thêm bản mỗi tháng trong Upstash, tự xóa sau 2 năm.
- **Khôi phục:** Sao lưu → chọn file `.json` → gõ `GHI DE` → **KIỂM TRA & KHÔI PHỤC** (tự tạo bản an toàn trước khi ghi đè).

## Cập nhật mã nguồn
GitHub → repo `nha-tro-44-website` → **Add file** → **Upload files** → thả file mới đúng đường dẫn → **Commit changes**. Vercel tự triển khai lại. **Dữ liệu không bị ảnh hưởng** vì nằm ở Upstash/Blob.

## Đổi font SVN-Avo (tùy chọn)
Xem `public/fonts/HUONG-DAN-FONT.txt`. Mặc định dùng font Inter (giống font iPhone).

## Phụ lục (tùy chọn): lưu dữ liệu ở GitHub hoặc Blob thay vì Upstash
Đặt biến `DB_DRIVER` = `github` (kèm `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`) hoặc `blob`. Không khuyến nghị: GitHub token có thể hết hạn.

## Tự kiểm tra bằng trang /kiemtra.html
Mở `https://<địa-chỉ-web>/kiemtra.html`: trang này tự kiểm tra từng mắt xích (giao diện, máy chủ Vercel, mật khẩu, Upstash, kho ảnh) và nói bạn sai ở đâu.

## Tự kiểm tra bằng trang /api/health
Mở `https://<địa-chỉ-web-của-bạn>/api/health`. Trang này chỉ hiện đúng/sai, không lộ mật khẩu:
- Thấy chữ JSON (`"api":"đang chạy"`) = phần máy chủ đã chạy. Nếu báo 404 = Vercel chưa nhận thư mục `api` (kiểm tra GitHub có `api/index.js` và `vercel.json`, rồi Redeploy).
- `daKetNoiNoiLuuDuLieu: true` và `kiemTraDocDuLieu: "ok"` = Upstash đã nối và đọc được.
- `daDatMatKhau`, `daDatSessionSecret`, `daKetNoiKhoAnh` đều phải là `true`.

## Khi gặp lỗi
| Thấy gì | Cách xử lý |
|---|---|
| Dòng đỏ "Lỗi máy chủ (404)" / "Không tìm thấy phần máy chủ" | Thiếu thư mục `api` hoặc `vercel.json` trên GitHub: upload lại, Redeploy, rồi mở `/api/health` |
| Web báo 404 | `index.html` không nằm trong `public/` – làm lại Bước 2 |
| Dòng đỏ "Chưa kết nối nơi lưu dữ liệu" | Làm Bước 4 rồi **Redeploy** |
| "Upstash từ chối truy cập" | Vercel → Storage → kiểm tra database còn nối với dự án; Redeploy |
| "Upstash báo đã chạm hạn mức" | Hết 500.000 lệnh/tháng: đợi sang tháng mới hoặc nâng gói Upstash (trả phí) |
| "Chưa kết nối kho ảnh Vercel Blob" | Làm Bước 5 + Redeploy |
| "Dữ liệu CHƯA được lưu" | Mạng/dịch vụ tạm lỗi: thử lại, không có dữ liệu nào bị ghi dở |
