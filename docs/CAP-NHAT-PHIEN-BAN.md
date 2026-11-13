# Cập nhật phiên bản mới – KHÔNG mất dữ liệu (hướng dẫn từng bước)

## Điều quan trọng cần biết trước
1. **Bạn KHÔNG phải sửa database bằng tay.** Dữ liệu nhà trọ nằm trong Upstash dưới dạng một khối nén (khóa `nt44:db`). Khi bản mới mở lên, phần mềm **tự nâng cấp** dữ liệu cũ: thêm danh sách "đồng hồ tổng", thêm thẻ **Chủ Nhà**, thêm trường ảnh cho người ở cùng, … và **giữ nguyên** phòng, khách, hóa đơn, thanh toán. Lần lưu đầu tiên sau khi cập nhật sẽ ghi dữ liệu đã nâng cấp.
2. **Không có biến môi trường BẮT BUỘC mới.** Vẫn chỉ cần: `APP_PASSWORD`, `SESSION_SECRET`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `BLOB_READ_WRITE_TOKEN`.
3. Biến **tùy chọn** (không thêm cũng chạy; thêm ở Vercel → dự án → Settings → Environment Variables → Add):

| Biến | Công dụng | Mặc định |
|---|---|---|
| `SESSION_IDLE_MINUTES` | số phút không thao tác thì phải đăng nhập lại | 5 |
| `STORAGE_LIMIT_MB` | hạn mức kho ảnh để tính % (nếu nâng gói Blob) | 1024 |
| `UPSTASH_COMMAND_LIMIT` | hạn mức lệnh/tháng để tính % (nếu nâng gói Upstash) | 500000 |
| `UPSTASH_DB_LIMIT_MB` | hạn mức dung lượng Upstash để tính % | 256 |
| `GOOGLE_SHEET_WEBHOOK_URL` + `GOOGLE_SHEET_SECRET` | bật sao lưu vào Google Sheet (xem docs/GOOGLE-SHEET.md) | chưa bật |

## Phần 1. Sao lưu trước khi cập nhật (2 phút, bắt buộc nên làm)
1. Mở web, đăng nhập.
2. Bấm tab **Sao lưu** (thanh dưới cùng trên điện thoại).
3. Bấm nút xanh **Tải database.json**. File tải về máy (mục Tải xuống). Đổi tên thành `sao-luu-truoc-cap-nhat.json` rồi cất vào Google Drive hoặc gửi email cho chính bạn.

## Phần 2. Đưa mã nguồn mới lên (chọn MỘT cách)
### Cách A – qua GitHub (như lúc đầu)
1. Giải nén file `nha-tro-44-website.zip` mới.
2. Mở GitHub → repo `nha-tro-44-website` → bấm **Add file** → **Upload files**.
3. Mở thư mục đã giải nén, nhấn **Ctrl+A** chọn tất cả thư mục và file bên trong (`api`, `lib`, `public`, `tests`, `docs`, `scripts`, `package.json`, `vercel.json`…), kéo thả vào khung GitHub. Đợi tải xong 100%. (Đừng kéo cả thư mục bao ngoài.)
4. Cuộn xuống bấm nút xanh **Commit changes**.
5. Mở Vercel → dự án → thẻ **Deployments**: dòng trên cùng chuyển **Building** rồi **Ready** (khoảng 1 phút). Nếu **Error**: bấm vào dòng đó → **Build Logs** → chụp màn hình các dòng chữ đỏ gửi tôi.

### Cách B – bằng CMD (nếu GitHub ↔ Vercel không tự cập nhật)
1. Mở CMD, gõ: `cd C:\nhatro44\nha-tro-44-website` (thư mục bạn đã giải nén bản mới, ghi đè lên bản cũ).
2. Gõ `vercel --prod` rồi Enter. Chờ hiện dòng `Production: https://...`.

## Phần 3. Bảo đảm tên chính cũng chạy bản mới
1. Vercel → dự án → **Deployments**.
2. Nếu bản mới nhất ghi **Preview** thay vì **Production**: bấm dấu **⋯** ở dòng đó → **Promote to Production** → xác nhận.

## Phần 4. Kiểm tra
1. Mở `https://<tên-web-của-bạn>/kiemtra.html` → tất cả dòng ✅ và "phiên bản giao diện" là `2026-11-16-b`.
2. Mở trang chủ web (nên bấm Ctrl+F5 hoặc đóng hẳn tab rồi mở lại). Cuối trang có dòng "Phiên bản giao diện: 2026-11-16-b".
3. Bấm **Ghi Điện & Nước - Tính Tiền Phòng**, đăng nhập: các phòng, khách, hóa đơn của bạn còn nguyên; trong danh sách phòng có thêm thẻ **Chủ Nhà**.

## Phần 5. Việc cần làm 1 lần sau khi cập nhật
### 5.1. Khai báo đồng hồ tổng (điện nước Chủ Nhà)
1. Lấy số **đồng hồ tổng hiện tại** của điện và nước (đồng hồ chung của cả dãy trọ + nhà bạn).
2. Đăng nhập → ở danh sách phòng bấm thẻ **Chủ Nhà**.
3. Ô **Ngày ghi**: để ngày hôm nay. Ô **Chỉ số điện TỔNG** và **Chỉ số nước TỔNG**: gõ số đồng hồ hiện tại. Bấm **LƯU CHỈ SỐ ĐỒNG HỒ TỔNG**. Lần đầu chỉ lưu "mốc", chưa tính ra số nào.
4. **Mỗi tháng** (ví dụ ngày có hóa đơn điện nước nhà nước), vào thẻ **Chủ Nhà**, nhập số đồng hồ tổng mới → hệ thống hiện công thức:
   - Tổng cả dãy + nhà = số mới − số cũ.
   - Tổng các phòng đã dùng = cộng điện nước của từng phòng trong cùng khoảng ngày (phòng nào kỳ tính tiền lệch ngày thì hệ thống chia đều theo ngày).
   - **Chủ Nhà dùng = Tổng − Các phòng.** Tăng quá 30% so với trung bình các tháng trước thì có cảnh báo rò rỉ.
5. Nhập nhầm: ở mục "Lịch sử ghi đồng hồ tổng" bấm **Xóa (nhập nhầm)** (chỉ xóa được lần ghi mới nhất).

### 5.2. Người ở cùng đã nhập từ phiên bản cũ
Họ chưa có ảnh CCCD nên trong phòng hiện "THIẾU ẢNH CCCD". Cách bổ sung: vào phòng → bấm **Hồ sơ khách** → kéo xuống mục **Người ở cùng** → ở thẻ của người đó bấm **Thêm ảnh** (mặt trước), rồi **Thêm ảnh** (mặt sau) → chọn **CHỤP CCCD…** hoặc **Chọn từ thư viện** → **LƯU ẢNH**.

### 5.3. Hóa đơn gửi Zalo
Vào phòng → bấm tháng có hóa đơn (hoặc hóa đơn vừa lập) → bấm **Tải hóa đơn (ảnh JPG)** → ảnh lưu vào mục Tải xuống/Ảnh của điện thoại → mở Zalo, chọn khách, gửi ảnh. Trên điện thoại có thêm nút **Gửi Zalo / Chia sẻ** mở thẳng danh sách ứng dụng để chọn Zalo.

### 5.3b. Điện nước: ngày chốt số và cảnh báo Chủ Nhà
- Khi **Ghi điện nước & lập hóa đơn** có ô **Ngày chốt số**: mặc định hôm nay; nếu bạn đọc đồng hồ từ vài ngày trước, chọn đúng ngày đó.
- Cảnh báo rò rỉ của **từng phòng** hiện ngay khi bạn lập hóa đơn của phòng đó (tăng > 30% so với trung bình).
- Cảnh báo **Chủ Nhà** chỉ chốt vào ngày **phòng tính tiền trễ nhất** ghi xong điện nước (ví dụ các phòng chốt ngày 1, 5, 10, 15, 20 → chốt ngày 20). Trước đó thẻ Chủ Nhà ghi "Đang chờ chốt" và liệt kê phòng còn thiếu.

### 5.3c. Thông tin nhận tiền trên hóa đơn
Đăng nhập → danh sách phòng → bấm thẻ **Chủ Nhà** → khung **Thông tin nhận tiền (hiện trên hóa đơn)** → nhập **Tên ngân hàng**, **Số tài khoản** (chỉ số), **Tên chủ tài khoản** (tự viết hoa) → **LƯU THÔNG TIN NHẬN TIỀN**. Từ đó mọi hóa đơn có số tiền cần thu (kể cả ảnh JPG gửi Zalo) có khối **THÔNG TIN CHUYỂN KHOẢN**. Muốn bỏ: bấm **Xóa**.

### 5.3d. Giao diện mới (bản 2026-11-15)
- **Đầu trang** chỉ còn tiêu đề (2rem), ngày dương/âm (1rem) và **1 thanh màu** cho biết % bộ nhớ đã dùng (xanh → cam → đỏ khi ≥ 90%). Dòng chi tiết "Lưu trữ ảnh / Upstash" nằm ở **cuối trang**, dưới cùng là "Cập nhật lúc…" và "Phiên bản giao diện".
- **Thêm vào màn hình chính** (cuối trang): bấm nút có icon Nhà trọ 44.
  - iPhone/iPad: mở bằng **Safari** → bấm **Chia sẻ** (ô vuông mũi tên) → **Thêm vào Màn hình chính** → **Thêm**. (Web hiện sẵn hướng dẫn 4 bước khi bạn bấm nút.)
  - Android/PC (Chrome/Edge): bấm nút là hiện hộp thoại cài đặt.
  - Đã cài xong thì nút tự ẩn. Icon nằm ở `public/*.png` (tạo bằng `scripts/tao-icon.py`).
- **Lịch** chia 70% | 30% trên iPad/máy tính; bên phải là **Danh sách sự kiện cần nhớ**; có 2 nút **Thêm sự kiện** (tiêu đề lịch và danh sách). Chỉ **Chủ nhật** màu đỏ.
- Tông màu tươi trẻ: đầu trang gradient xanh – tím, ô thống kê nhiều màu.
- Muốn đổi icon: thay các file `public/apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (cùng tên). Nếu đã thêm icon cũ vào màn hình chính, xóa icon cũ rồi thêm lại để iPhone nhận icon mới.

### 5.3e. Bản 2026-11-16: giao diện mới + thu tiền theo tháng
- **Nền xanh nhạt** `rgb(9 128 255 / 10%)`, góc bo nhỏ, ô nhập nền xanh nhạt, nút nhiều màu, icon Material Design Icons (miễn phí, Apache 2.0, giấy phép trong `public/vendor/`).
- **Đăng nhập:** phiên hết sau 5 phút không thao tác; **đóng tab/trình duyệt rồi mở lại là phải nhập lại mật khẩu**.
- **Trang chủ quản trị:** thẻ phòng có "Vào dd/mm/yyyy" + nút đỏ **Tính tiền**; **+ Thêm phòng** ở góc phải; lịch + danh sách sự kiện nằm ngay dưới "Các phòng"; sự kiện 2 tháng tới ở đầu trang. Không còn tab Lịch.
- **Màu phòng:** đỏ = sửa chữa, xám = chưa sẵn sàng (khóa), xanh biển = đang ở, xanh lá = trống, cam nhạt = Chủ Nhà. Bấm phòng đang sửa/chưa sẵn sàng sẽ hiện lý do + nút **Sửa Tình Trạng Phòng**; đổi sang Phòng trống mới xem được.
- **Tính tiền:** chọn tháng; đi vắng bỏ tháng nào thì chọn tháng sau (tháng bị bỏ chỉ có tiền phòng, điện nước tính gộp). Có **2 dòng**: **Nợ cũ** và **Chi phí khác** – có nhập mới hiện trong hóa đơn, để trống thì hóa đơn không hiện.
- **Chi tiết phòng:** nút **Zalo** (khách + từng người ở cùng; trống thì dùng số điện thoại), mục **Chưa thanh toán** từng tháng với nút **Thanh toán tháng N** → **ĐÃ NHẬN TIỀN** thì tháng đó hết thông báo.
- **Người ở cùng:** thêm **địa chỉ thường trú**; ảnh CCCD (khách và người ở cùng) **không bắt buộc**.
- **Xóa phòng** (chỉ phòng chưa có lịch sử) trong hộp thoại **Sửa Tình Trạng Phòng**.
- **Chủ Nhà:** khai báo đồng hồ tổng hiện tại, mọi lần ghi đều **Sửa** được; thông tin ngân hàng xem được và bấm **Sửa** khi đổi ngân hàng.
- Dữ liệu cũ **tự được nâng cấp**, không cần sửa database (xem mục "Nếu có thêm bảng dữ liệu mới" bên dưới).

### Nếu có thêm bảng dữ liệu mới trong các bản sau
Bạn không phải làm gì với Upstash. Khi bản mới mở lên, phần mềm tự thêm các phần mới vào dữ liệu cũ (hàm nâng cấp `migrateDb`), giữ nguyên dữ liệu hiện có. Sau khi cập nhật chỉ cần: mở `/kiemtra.html` (phiên bản đúng, các dòng ✅), đăng nhập và kiểm tra dữ liệu còn nguyên. Luôn **Sao lưu → Tải database.json** trước khi cập nhật.

### Trang chủ bị chuyển sang trang đăng nhập Vercel?
Vercel → dự án → **Settings** → **Deployment Protection** → **Vercel Authentication** chọn **Disabled** (hoặc chỉ Preview) → **Save**.

### 5.4. Lịch & sự kiện (mới)
Tab **Lịch** (thanh dưới cùng): lịch tháng dương + âm, ngày lễ, thêm/sửa/xóa sự kiện. Trang chủ phía dưới nút "Ghi Điện & Nước - Tính Tiền Phòng" cũng có lịch (xem được, không sửa được khi chưa đăng nhập). Bật/tắt hiện sự kiện ở trang ngoài tại **Sao lưu → Hiển thị trên trang ngoài**.

### 5.5. Sao lưu Google Sheet (mới, tùy chọn)
Làm theo `docs/GOOGLE-SHEET.md` (khoảng 10 phút). Dữ liệu cũ không bị ảnh hưởng; không bật cũng chạy bình thường.

## Phần 6. Xem dữ liệu trong Upstash (chỉ để xem, đừng sửa)
Upstash console → database → **Data Browser**. Bạn sẽ thấy: `nt44:db` (toàn bộ dữ liệu, dạng nén bắt đầu bằng `gz:` nên không đọc được bằng mắt), `nt44:ver` (số phiên bản để chống ghi đè), `nt44:cmd:AAAA-BB` (bộ đếm lệnh tháng) và các khóa `nt44:x:backups/...` (bản sao lưu tự động, tự xóa sau 2 năm). **Đừng sửa hoặc xóa tay** các khóa này.

## Phần 7. Nếu có sự cố sau khi cập nhật
1. Chụp màn hình lỗi + trang `/kiemtra.html` gửi tôi.
2. Muốn quay về dữ liệu cũ: tab **Sao lưu** → ô chọn file → chọn file `sao-luu-truoc-cap-nhat.json` → gõ `GHI DE` → **KIỂM TRA & KHÔI PHỤC**.
3. Muốn quay về mã nguồn cũ: Vercel → **Deployments** → chọn bản cũ chạy tốt → **⋯** → **Promote to Production**.

## Ghi nhớ cho các lần cập nhật sau
Luôn làm theo thứ tự: **Sao lưu (Phần 1) → Đưa mã mới lên (Phần 2) → Promote (Phần 3) → Kiểm tra (Phần 4)**. Dữ liệu nằm ở Upstash và Vercel Blob nên việc đổi mã nguồn không làm mất dữ liệu.
