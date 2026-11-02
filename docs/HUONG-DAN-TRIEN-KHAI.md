# Hướng dẫn triển khai từng bước (dành cho người mới)

Thời gian ~45 phút. Bạn cần: email, điện thoại nhận mã xác thực, máy tính.
Chuẩn bị sẵn một file ghi chú để dán các giá trị bên dưới (KHÔNG gửi cho ai, KHÔNG đăng lên mạng).

## Bước 1. Tạo tài khoản GitHub
1. Vào https://github.com → bấm **Sign up** → nhập email, mật khẩu, tên người dùng (ví dụ `nguyenvana`) → xác minh email.
2. Ghi lại **tên người dùng** (sẽ dùng làm `GITHUB_OWNER`).
✔ Kiểm tra: đăng nhập được, góc phải trên có ảnh đại diện.

## Bước 2. Tạo repository chứa website
1. Góc phải trên bấm dấu **+** → **New repository**.
2. **Repository name**: `nha-tro-44-website`. Chọn **Private**. Bấm **Create repository**.
3. Giải nén file `nha-tro-44-website.zip` trên máy. Trong trang repo vừa tạo bấm **uploading an existing file**.
4. Kéo **toàn bộ nội dung bên trong thư mục đã giải nén** (các thư mục `api`, `lib`, `public`, `tests`, `docs` và các file `package.json`, `vercel.json`, `README.md`…) thả vào khung. Đợi tải xong 100%.
   - Nếu máy ẩn file bắt đầu bằng dấu chấm (`.gitignore`, `.env.example`) thì bỏ qua cũng được.
5. Ở ô **Commit changes** bấm nút xanh **Commit changes**.
✔ Kiểm tra: trong repo thấy thư mục `api`, `lib`, `public` và file `vercel.json`.

## Bước 3. Tạo repository dữ liệu PRIVATE
1. **+** → **New repository**. Tên: `nha-tro-44-private-data`.
2. Chọn **Private** (bắt buộc). Tick **Add a README file**. Bấm **Create repository**.
✔ Kiểm tra: ở đầu trang có biểu tượng ổ khóa/chữ **Private**. (File `database.json` sẽ tự được tạo ở lần lưu đầu tiên.)

## Bước 4. Tạo GitHub Token (quyền tối thiểu)
1. Bấm ảnh đại diện → **Settings** → kéo xuống cuối menu trái → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Token name**: `nha-tro-44`. **Expiration**: chọn 1 năm (ghi lịch nhắc tạo lại trước khi hết hạn – hết hạn là web không lưu được).
3. **Repository access** → **Only select repositories** → chọn **nha-tro-44-private-data** (chỉ repo này).
4. **Permissions** → **Repository permissions** → **Contents** → chọn **Read and write**. Không bật quyền nào khác.
5. Bấm **Generate token** → **sao chép chuỗi bắt đầu bằng `github_pat_`** dán vào file ghi chú (chỉ hiện 1 lần).

## Bước 5. Tạo tài khoản Vercel và nhập dự án
1. Vào https://vercel.com → **Sign Up** → **Continue with GitHub** → chọn gói **Hobby**.
2. **Add New…** → **Project** → ở danh sách GitHub bấm **Import** cạnh `nha-tro-44-website` (nếu chưa thấy: **Adjust GitHub App Permissions** → cho phép repo đó).
3. **Framework Preset**: chọn **Other**. Để trống Build/Output Command.
4. Mở mục **Environment Variables** và thêm lần lượt (Key → Value → **Add**):
   | Key | Value |
   |---|---|
   | `APP_PASSWORD` | mật khẩu đăng nhập của bạn (khuyến nghị đặt dài hơn 8 chữ số – xem docs/GIOI-HAN) |
   | `SESSION_SECRET` | chuỗi ngẫu nhiên dài ≥ 32 ký tự (gõ bừa chữ+số, ví dụ `k8Qw2ZpL9xRt4VnB7mYc1HdJ6sGe3UfA`) |
   | `GITHUB_TOKEN` | chuỗi `github_pat_…` ở bước 4 |
   | `GITHUB_OWNER` | tên người dùng GitHub của bạn |
   | `GITHUB_REPO` | `nha-tro-44-private-data` |
   | `GITHUB_BRANCH` | `main` |
5. Bấm **Deploy**. Đợi ~1 phút đến khi có chữ **Congratulations**.
✔ Kiểm tra: bấm vào ảnh xem trước để mở website → thấy màn hình "NHÀ TRỌ 44 LÊ VĂN PHẤN" và nút **ĐĂNG NHẬP QUẢN LÝ**.

## Bước 6. Tạo kho ảnh CCCD riêng tư (Vercel Blob)
1. Trong Vercel mở dự án → thẻ **Storage** → **Create Database** → chọn **Blob** → **Continue**.
2. Đặt tên `cccd`, ở **Access** chọn **Private** (không chọn Public) → **Create** → đảm bảo đã kết nối với dự án `nha-tro-44-website` (mọi môi trường). Vercel tự thêm biến `BLOB_READ_WRITE_TOKEN`.
3. Thẻ **Deployments** → bấm dấu **⋯** ở dòng trên cùng → **Redeploy** → **Redeploy**.
✔ Kiểm tra (sau Bước 7): thêm khách, chụp ảnh CCCD, mở hồ sơ khách → **Xem ảnh** hiện ra.
Gói miễn phí: 1 GB (đủ khoảng 300 khách, mỗi khách 2 ảnh ~1,5 MB). Vượt hạn mức thì Vercel chặn ghi ảnh mới ~30 ngày chứ **không tính tiền** ở gói Hobby; xem `docs/GIOI-HAN-VA-KIEM-THU.md`.

## Bước 7. Kiểm tra website chạy thực tế
1. Mở địa chỉ `https://nha-tro-44-website-xxxx.vercel.app` (xem ở thẻ **Domains** của dự án) bằng điện thoại.
2. **ĐĂNG NHẬP QUẢN LÝ** → nhập mật khẩu → thấy 7 phòng.
3. Vào **Phòng 1** → **+ Thêm khách thuê** → điền thông tin, chụp 2 mặt CCCD → **LƯU KHÁCH THUÊ**.
4. Mở lại trang chủ ở cửa sổ ẩn danh (chưa đăng nhập) → thấy thông báo "PHÒNG 1 – Chưa thanh toán" **không có tên khách**.
5. Vào repo `nha-tro-44-private-data` trên GitHub → thấy file `database.json` mới được tạo.
**Khách đã ở sẵn từ trước?** Chọn "Khách đã ở sẵn (nhập vào hệ thống)", nhập ngày vào ở thật, nợ cũ (nếu có), và chỉ số điện nước hiện tại ở đầu kỳ đang chạy.
**Cài như ứng dụng:** iPhone/iPad Safari: nút Chia sẻ → **Thêm vào Màn hình chính**. Android Chrome: ⋮ → **Thêm vào màn hình chính**.

## Bước 8. Đổi mật khẩu
Vercel → dự án → **Settings** → **Environment Variables** → dòng `APP_PASSWORD` → **⋯** → **Edit** → nhập mật khẩu mới → **Save** → thẻ **Deployments** → **Redeploy**.
Muốn đăng xuất mọi thiết bị (mất điện thoại): đổi `SESSION_SECRET` rồi Redeploy.

## Bước 9. Sao lưu
- Trong web: **Sao lưu → Tải database.json** (mỗi tháng 1 lần, cất vào Google Drive/email).
- Hệ thống tự lưu `backups/YYYY-MM.json` mỗi tháng trong repo dữ liệu.
- Ảnh CCCD: hồ sơ khách → **Tải về** (khi cần bản dự phòng).

## Bước 10. Khôi phục
**Sao lưu** → ô chọn file → chọn file `.json` → gõ `GHI DE` → **KIỂM TRA & KHÔI PHỤC**. Hệ thống tự lưu bản an toàn `backups/truoc-khi-khoi-phuc-….json` trước khi ghi đè.

## Bước 11. Cập nhật mã nguồn
GitHub → repo `nha-tro-44-website` → **Add file** → **Upload files** → thả file mới (cùng đường dẫn) → **Commit changes**. Vercel tự triển khai lại sau ~1 phút.

## Khi gặp lỗi
| Thấy thông báo | Cách xử lý |
|---|---|
| "GitHub từ chối quyền truy cập" | Token hết hạn/thiếu quyền Contents: tạo lại ở Bước 4, sửa `GITHUB_TOKEN`, Redeploy |
| "Chưa tạo kho lưu trữ ảnh" | Làm Bước 6 và Redeploy |
| "Dữ liệu CHƯA được lưu" | Mạng/GitHub tạm lỗi: thử lại; không có dữ liệu nào bị ghi dở |
| Trang chỉ báo thiếu biến môi trường | Kiểm tra tên biến ở Bước 5 viết đúng chữ hoa/thường |
