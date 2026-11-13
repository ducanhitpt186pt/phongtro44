# Sao lưu vào Google Sheet (trong Gmail của bạn) – CHỈ THÊM, KHÔNG XÓA

> **Mẹo:** không cần mở file này. Trên web: tab **Sao lưu → thẻ Sao lưu vào Google Sheet → "Hướng dẫn kết nối 4 bước"** có sẵn nút **Tạo mã bí mật** và **Sao chép mã Apps Script** (mã đã kèm mã bí mật của bạn, chỉ việc dán).
> **Lưu ý:** bạn KHÔNG cần gửi link Sheet hay cấp quyền cho ai (kể cả tôi). Web tự ghi vào Sheet của bạn thông qua đoạn mã bạn dán; Sheet vẫn riêng tư.

## Hỏi nhanh
**File Google Sheet nằm ở đâu?** Do chính bạn tạo, nằm trong **Google Drive của tài khoản Gmail bạn dùng để tạo**. Muốn mở: vào https://drive.google.com → **Drive của tôi** → file tên `Nhà trọ 44 - sao lưu` (hoặc vào https://sheets.google.com, file xuất hiện ở danh sách "Gần đây"). Trên web quản lý: tab **Sao lưu** → **Kiểm tra kết nối** → bấm liên kết **Mở Sheet**.
**Kết nối ra sao?** 3 mảnh nối với nhau: (1) Google Sheet của bạn, (2) đoạn mã Apps Script dán vào Sheet đó (cho ra một địa chỉ `https://script.google.com/.../exec`), (3) hai biến `GOOGLE_SHEET_WEBHOOK_URL` (địa chỉ ở bước 2) và `GOOGLE_SHEET_SECRET` (mã bí mật) khai báo trên nơi chạy web (Vercel hoặc Render). Mỗi lần bạn lưu dữ liệu trên web, web gọi địa chỉ đó để thêm dòng vào Sheet.

## Nó hoạt động thế nào (rất đơn giản)
- Bạn tạo 1 file **Google Sheet** trong Gmail, dán vào đó một đoạn mã nhỏ (Apps Script) do tôi cung cấp. Đoạn mã này **chỉ có việc thêm dòng mới**, không có lệnh xóa hay sửa dòng cũ.
- Mỗi khi bạn lưu dữ liệu trên web (thêm khách, lập hóa đơn, thu tiền, đồng hồ tổng, sự kiện…), web tự **thêm dòng** vào Sheet. Mỗi ngày còn thêm **1 bản sao lưu đầy đủ** (tab `SaoLuuDayDu`).
- Nếu Google Sheet bị lỗi/mất mạng, việc lưu dữ liệu chính **vẫn thành công**; web chỉ hiện dòng cảnh báo cam dưới tiêu đề.
- Không cần thẻ, không mất phí. Không cần Google Cloud, không có token hết hạn.

Các tab tự tạo: `NhatKy`, `HoaDon`, `ThanhToan`, `Khach`, `NguoiOCung`, `LuotThue`, `DongHoTong`, `SuKien`, `SaoLuuDayDu`. Ảnh CCCD **không** gửi vào Sheet.

## Bước 1. Tạo Google Sheet
1. Mở trình duyệt, đăng nhập Gmail của bạn → vào https://sheets.google.com
2. Bấm **Trống** (Blank spreadsheet).
3. Bấm vào chữ "Bảng tính không có tiêu đề" ở góc trái trên → đổi tên thành `Nhà trọ 44 - sao lưu` → Enter.

## Bước 2. Dán đoạn mã (Apps Script)
1. Trong Sheet, bấm menu **Tiện ích** (Extensions) → **Apps Script**. Một tab mới mở ra.
2. Bấm vào khung code, nhấn **Ctrl+A** rồi **Delete** để xóa hết code mẫu.
3. Mở file `docs/google-apps-script.gs` trong thư mục dự án, nhấn **Ctrl+A**, **Ctrl+C**, rồi dán (**Ctrl+V**) vào khung Apps Script.
4. Ở dòng 7: `const SECRET = 'THAY-CHUOI-BI-MAT-CUA-BAN';` → thay phần trong dấu nháy bằng **mã bí mật do bạn tự đặt** (ví dụ `nt44-Kx92LmQ7pRt3`, ít nhất 16 ký tự, chỉ dùng chữ và số). **Ghi lại mã này**, ở Bước 4 cần nhập y hệt.
5. Bấm biểu tượng đĩa mềm **Lưu dự án** (hoặc Ctrl+S).

## Bước 3. Triển khai thành "Ứng dụng web" và lấy địa chỉ
1. Góc phải trên bấm nút xanh **Triển khai** (Deploy) → **Tùy chọn triển khai mới** (New deployment).
2. Cạnh chữ "Chọn loại" bấm **bánh răng ⚙** → chọn **Ứng dụng web** (Web app).
3. **Mô tả**: gõ `nhatro44`. **Thực thi dưới dạng** (Execute as): chọn **Tôi** (Me). **Người có quyền truy cập** (Who has access): chọn **Bất kỳ ai** (Anyone).
4. Bấm **Triển khai** (Deploy).
5. Hộp thoại **Cho phép quyền truy cập** → bấm **Cấp quyền truy cập** → chọn tài khoản Gmail của bạn.
6. Nếu Google báo "Google chưa xác minh ứng dụng này": bấm **Nâng cao** (Advanced) → **Đi tới … (không an toàn)** (Go to … (unsafe)) → **Cho phép** (Allow). (Đây là đoạn mã do chính bạn dán nên an toàn.)
7. Hiện **URL ứng dụng web** dạng `https://script.google.com/macros/s/AKfy.../exec` → bấm **Sao chép**. **Dán vào Notepad** để dùng ở bước sau.

## Bước 4. Khai báo 2 biến trên Vercel
Cách A – trên web Vercel:
1. Vercel → dự án → **Settings** → **Environment Variables**.
2. **Key**: `GOOGLE_SHEET_WEBHOOK_URL` – **Value**: dán URL ở Bước 3 → tick **Production** (và Preview) → **Save**.
3. **Key**: `GOOGLE_SHEET_SECRET` – **Value**: đúng mã bí mật ở Bước 2.4 → **Save**.
4. **Deployments** → dòng trên cùng → **⋯** → **Redeploy** → **Redeploy**.

Cách B – bằng CMD (thư mục dự án):
```
vercel env add GOOGLE_SHEET_WEBHOOK_URL production
vercel env add GOOGLE_SHEET_SECRET production
vercel --prod
```

## Bước 5. Kiểm tra kết nối (làm trên web quản lý)
1. Đăng nhập → tab **Sao lưu** → thẻ **Sao lưu vào Google Sheet** phải ghi "Đã cấu hình kết nối".
2. Bấm **Kiểm tra kết nối** → hiện ✅ "Thành công. Google Sheet: Nhà trọ 44 - sao lưu" kèm nút **Mở Sheet**.
   - Báo "Sai mã bí mật" → `GOOGLE_SHEET_SECRET` trên Vercel khác `SECRET` trong Apps Script. Sửa cho khớp, Redeploy.
   - Báo "Google không trả JSON / quyền Anyone" → làm lại Bước 3 (chọn **Bất kỳ ai**) hoặc dán sai URL (URL phải kết thúc bằng `/exec`).
3. Bấm **Gửi dòng thử** → mở Sheet, tab `NhatKy` có dòng "Kiểm tra kết nối".
4. Bấm **Sao lưu đầy đủ ngay** → tab `SaoLuuDayDu` có thêm dòng.
5. **Chỉ 1 lần** khi mới kết nối: bấm **Gửi toàn bộ chi tiết** để đưa dữ liệu cũ (hóa đơn, thanh toán, khách…) vào các tab. (Bấm lại sẽ thêm dòng trùng vì Sheet chỉ thêm, không xóa.)

## Thông tin cá nhân khách
Thẻ Google Sheet có ô **"Gửi cả thông tin cá nhân khách…"** (mặc định BẬT, để sao lưu đủ). Tắt đi thì SĐT, CCCD, ngày sinh, địa chỉ để trống trong Sheet. **Hãy giữ Sheet ở chế độ riêng tư, không chia sẻ cho ai.**

## Khôi phục dữ liệu từ Google Sheet (khi mất dữ liệu ở web)
1. Mở Sheet → bấm tab **SaoLuuDayDu** → menu **Tệp** (File) → **Tải xuống** → **Giá trị phân tách bằng dấu phẩy (.csv)**. Đổi tên file thành `SaoLuuDayDu.csv`.
2. Mở CMD tại thư mục dự án (`cd C:\nhatro44\nha-tro-44-website`), gõ:
```
node scripts\giai-nen-sao-luu.mjs C:\duong-dan\SaoLuuDayDu.csv
```
3. Thấy ✅ và file `database-khoi-phuc.json` được tạo ra.
4. Trên web: **Sao lưu** → ô chọn file → chọn `database-khoi-phuc.json` → gõ `GHI DE` → **KIỂM TRA & KHÔI PHỤC**.
(Ảnh CCCD không nằm trong Sheet; bản sao lưu ảnh làm riêng từ hồ sơ khách → Tải về.)

## An toàn & giới hạn
- Ai có **URL + mã bí mật** mới ghi được vào Sheet của bạn. Hãy giữ kín cả hai; nếu lộ: đổi `SECRET` trong Apps Script → **Triển khai** → **Quản lý bản triển khai** → ✏ → **Phiên bản mới** → **Triển khai**, rồi sửa biến trên Vercel và Redeploy.
- Mỗi lần lưu có thể chậm thêm 1–3 giây khi Google phản hồi chậm; tối đa chờ 9 giây rồi bỏ qua (dữ liệu chính vẫn lưu). Dòng bị lỡ sẽ có trong bản sao lưu đầy đủ hằng ngày và nút "Gửi toàn bộ chi tiết".
- Google Sheet có giới hạn ~10 triệu ô; với nhà trọ 7 phòng dùng được rất nhiều năm.
- Đoạn mã Apps Script tôi chỉ chạy thử bằng bản mô phỏng; hãy bấm **Kiểm tra kết nối** và **Gửi dòng thử** ngay sau khi cài để chắc chắn.
