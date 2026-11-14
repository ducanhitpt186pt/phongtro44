# Phiên bản 2026-11-30-a
- **CT01**: ô "Ý KIẾN CỦA CHỦ SỞ HỮU CHỖ Ở HỢP PHÁP" để trống phần tên (chỉ còn tên ở chủ hộ và người kê khai = khách thuê); dòng ngày tháng cuối tờ khai chỉ còn "ngày … tháng … năm …", không ghi tên phường. Ô "Kính gửi" vẫn lấy từ Công An Quản Lý.
- **Nhắc Nợ** chia hai mục: **Cần Thu** (người khác mượn/thiếu mình) và **Cần Trả** (mình nợ người khác). Mỗi mục có thống kê riêng; Tổng quan nhắc cả hai (nút "Thu nợ" / "Trả nợ"); trang chủ công khai chỉ hiện Cần Thu. Khoản nợ cũ tự tính là Cần Thu.
- Tab mới **Thu Chi** (Quản Lý Thu Chi): thêm/sửa/xóa khoản thu, chi; thống kê theo ngày (chọn tháng), theo tháng (chọn năm), theo năm; **Xóa theo năm** có cảnh báo và phải gõ lại đúng năm. Sổ riêng, không hiện ra ngoài, không tạo thông báo; có trong Excel sao lưu.

# Phiên bản 2026-11-29-a
- **Bản Khai CT01 - Lưu Trú**: nút trong "Người ở cùng" (trang phòng và Hồ sơ khách) → tải PDF A4 đúng mẫu CT01 (Thông tư 116/2026/TT-BCA). Mục 1–6 lấy từ khách thuê, 7–10 từ chủ nhà (Email, mối quan hệ để trống; nội dung đề nghị mặc định "Cho thuê phòng trọ"), mục 11 là những người ở cùng (luôn có dòng trống). "Kính gửi" và nơi ký lấy từ ô **Công An Quản Lý** trong phòng Chủ Nhà (ví dụ "Công An Phường Phú Thủy" → "Phú Thủy, ngày … tháng … năm …").
- **Thời gian thống nhất trong hợp đồng**: chọn "Kể từ ngày …" (mặc định) hoặc "Từ ngày … đến ngày …" (bắt buộc chọn ngày); hợp đồng chỉ in đúng lựa chọn này. Người ở cùng mặc định bắt đầu ở từ ngày nhập liệu (đổi được).
- **Nhắc Nợ** (tab mới): sổ nợ riêng không gắn phòng; danh sách đơn vị nợ; thông báo nợ ở Tổng quan (có nút **Trả nợ**: trả hết hoặc một phần, phần còn lại tiếp tục được nhắc) và ở trang chủ (chỉ tên + số còn nợ); thống kê theo đơn vị, theo tháng, theo năm; có trong file Excel sao lưu.

# Phiên bản 2026-11-28-a
- **Số Tiền Đặt Cọc** (mặc định 0) khi thêm khách; khi trả phòng, cọc được trừ vào hóa đơn quyết toán, phần dư hoàn lại cho khách (ghi rõ trong hóa đơn). Cọc và hình thức thanh toán giữ nguyên khi chuyển phòng.
- **Hình thức thanh toán tiền thuê**: Theo tháng (mặc định) / Theo quý / Theo năm – lưu và in vào hợp đồng (Điều 4). Hóa đơn trong phần mềm vẫn lập theo tháng.
- **Quê quán** của khách thuê (và người ở cùng); có trong hồ sơ và trong ảnh hồ sơ A4.
- Ô **Nơi cấp** có gợi ý "CỤC TRƯỞNG CỤC CẢNH SÁT QUẢN LÝ HÀNH CHÍNH VỀ TRẬT TỰ XÃ HỘI" (bấm nút xanh bên dưới ô để điền nhanh).
- Người ở cùng: chọn **Kể từ ngày** hoặc **Từ ngày … đến ngày …**.
- Phòng **Chủ Nhà**: thẻ "Thông tin Bên A" (họ tên, ngày sinh, CCCD, ngày cấp, nơi cấp, địa chỉ thường trú, số điện thoại, địa chỉ nhà trọ).
- Trong phòng có khách: nút **Xuất Hợp Đồng** → file Word (.docx) hoặc In / Lưu PDF, tự điền đủ 10 điều; số tiền đặt cọc và giá thuê có "Bằng chữ".

# Phiên bản 2026-11-27-a
- Thêm nút **Tải Ảnh Hồ Sơ Khách Theo Phòng** (trong trang phòng và trong Hồ sơ khách): ảnh JPG khổ A4 dọc gồm ngày sinh, giới tính, điện thoại, số CCCD, ngày cấp / nơi cấp, ngày vào ở, địa chỉ thường trú và ảnh căn cước 2 mặt của mọi người trong phòng. Mỗi trang tối đa 2 người; phòng đông hơn thì tải thêm trang.
- Thẻ phòng: khi đã thanh toán đủ kỳ hiện tại thì ẩn "Tổng cần thu" và "Đã thanh toán"; ghi điện nước kỳ mới thì hiện lại.
- Tổng quan: bỏ ô "Tổng tiền cần thu (kỳ hiện hành)"; "Tổng số phòng" kèm dòng "Phòng đang khóa: N".

# Phiên bản 2026-11-26-b
- Trang **Sao lưu**: thêm nút **Tải file Excel (để xem, dạng bảng)** – file .xlsx nhiều sheet (Phòng, Hóa đơn, Thanh toán, Khách thuê, Người ở cùng, Lượt thuê, Đồng hồ tổng, Sự kiện). Chỉ để xem; khôi phục vẫn dùng database.json.

# Phiên bản 2026-11-26-a
- Trang **Sao lưu**: thêm thẻ **Kiểm tra tất cả kết nối** ở cuối trang (cơ sở dữ liệu, kho ảnh, Google Sheet) kèm 1 câu kết luận.
- Sửa mô tả sao lưu: bản tự động nằm trong Upstash, không phải kho GitHub.

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
1. Mở `https://<tên-web-của-bạn>/kiemtra.html` → tất cả dòng ✅ và "phiên bản giao diện" là `2026-11-25-a`.
2. Mở trang chủ web (nên bấm Ctrl+F5 hoặc đóng hẳn tab rồi mở lại). Cuối trang có dòng "Phiên bản giao diện: 2026-11-25-a".
3. Bấm **Ghi Điện & Nước - Tính Tiền Phòng**, đăng nhập: các phòng, khách, hóa đơn của bạn còn nguyên; trong danh sách phòng có thêm thẻ **Chủ Nhà**.

## Phần 5. Việc cần làm 1 lần sau khi cập nhật
### 5.1. Khai báo đồng hồ tổng (điện nước Chủ Nhà)
1. Lấy số **đồng hồ tổng hiện tại** của điện và nước (đồng hồ chung của cả dãy trọ + nhà bạn).
2. Đăng nhập → ở danh sách phòng bấm thẻ **Chủ Nhà**.
3. Ô **Ngày ghi**: để ngày hôm nay. Ô **Chỉ số điện TỔNG** và **Chỉ số nước TỔNG**: gõ số đồng hồ hiện tại. Bấm **LƯU CHỈ SỐ ĐỒNG HỒ TỔNG**. Lần đầu chỉ lưu "mốc", chưa tính ra số nào.
4. **Mỗi tháng** (ví dụ ngày có hóa đơn điện nước nhà nước), vào thẻ **Chủ Nhà**, nhập số đồng hồ tổng mới → hệ thống hiện công thức:
   - Tổng cả dãy + nhà = số mới − số cũ.
   - Tổng các phòng đã dùng = cộng điện nước của từng phòng trong cùng khoảng ngày (phòng nào kỳ tính tiền lệch ngày thì hệ thống chia đều theo ngày).
   - **Chủ Nhà dùng = Tổng − Các phòng.** Tăng quá 20% so với trung bình các tháng trước thì có cảnh báo rò rỉ.
5. Nhập nhầm: ở mục "Lịch sử ghi đồng hồ tổng" bấm **Xóa (nhập nhầm)** (chỉ xóa được lần ghi mới nhất).

### 5.2. Người ở cùng đã nhập từ phiên bản cũ
Họ chưa có ảnh CCCD nên trong phòng hiện "THIẾU ẢNH CCCD". Cách bổ sung: vào phòng → bấm **Hồ sơ khách** → kéo xuống mục **Người ở cùng** → ở thẻ của người đó bấm **Thêm ảnh** (mặt trước), rồi **Thêm ảnh** (mặt sau) → chọn **CHỤP CCCD…** hoặc **Chọn từ thư viện** → **LƯU ẢNH**.

### 5.3. Hóa đơn gửi Zalo
Vào phòng → bấm tháng có hóa đơn (hoặc hóa đơn vừa lập) → bấm **Tải hóa đơn (ảnh JPG)** → ảnh lưu vào mục Tải xuống/Ảnh của điện thoại → mở Zalo, chọn khách, gửi ảnh. Trên điện thoại có thêm nút **Gửi Zalo / Chia sẻ** mở thẳng danh sách ứng dụng để chọn Zalo.

### 5.3b. Điện nước: ngày chốt số và cảnh báo Chủ Nhà
- Khi **Ghi điện nước & lập hóa đơn** có ô **Ngày chốt số**: mặc định hôm nay; nếu bạn đọc đồng hồ từ vài ngày trước, chọn đúng ngày đó.
- Cảnh báo rò rỉ của **từng phòng** hiện ngay khi bạn lập hóa đơn của phòng đó (tăng > 20% so với trung bình).
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

### 5.3f. Bản 2026-11-17: trả phòng và đồng hồ tổng
- **Hóa đơn trả phòng:** Tiền phòng = số ngày ở × (giá thuê ÷ 30). Ví dụ giá 1.200.000 → 40.000 đ/ngày. Số ngày = ngày trả − ngày bắt đầu kỳ (vào 11, trả 13 là 2 ngày). Dưới các khoản có dòng **Trừ: đã thu trước (tiền phòng đầu kỳ)** rồi mới ra số **Khách còn phải trả** hoặc **Chủ nhà hoàn lại khách**. **Nợ cũ** không có thì không hiện.
- **Ghi đồng hồ tổng hàng tháng:** trang chủ quản trị → thẻ **Chủ Nhà** (màu cam) → nút **Ghi đồng hồ tổng**. Cũng có thể bấm vào thẻ để xem chi tiết và sửa các lần ghi.
- Lịch chia 60% | 40%; báo cáo bỏ thống kê "Khoản phát sinh / điều chỉnh"; ô **Tổng công nợ** nền đỏ nhạt.

### 5.3g. Bản 2026-11-18: lời nhắc điện thoại, nợ cũ theo tháng, phát sinh khi thu tiền, xóa hóa đơn
- **Thêm vào lời nhắc điện thoại:** ở mỗi sự kiện bấm **Nhắc điện thoại** → chọn giờ (mặc định **06:00**) và các mốc (mặc định **trước 3 ngày, trước 1 ngày và đúng ngày**) → **TẠO LỜI NHẮC (.ics)**. iPhone/iPad: mở file → **Thêm tất cả** vào Lịch. Android: mở file bằng **Google Lịch** → Lưu. Sự kiện lặp hằng năm được tạo cho 3 năm tới (âm lịch tự đổi sang đúng ngày dương mỗi năm).
- **Nợ cũ:** mặc định 0. Chỉ là phần các tháng trước chưa trả hết, và hóa đơn ghi rõ **"Còn nợ tháng 10/2026: 200.000 đ"**. Hộp thoại **Tính tiền** cho biết trước nợ cũ tự động chuyển sang; ô **Nợ cũ** chỉ để nhập thêm khoản nợ chưa có trong hệ thống.
- **Bấm Đã nhận tiền:** có ô **Tiền phát sinh** và **Nội dung phát sinh** (nếu có). Khoản này được cộng vào hóa đơn mới nhất của khách và hiện trên hóa đơn; số cần thu tự cập nhật.
- **Xóa hóa đơn** (trang chi tiết phòng, cột cuối của bảng tháng): chỉ xóa được hóa đơn **mới nhất** của khách đang thuê (không phải hóa đơn đầu, không phải hóa đơn trả phòng/chuyển phòng). Có cảnh báo "dữ liệu quan trọng, không khôi phục được" và phải tích ô xác nhận. Xóa kèm các lần thu tiền và chỉ số điện nước của kỳ đó; nợ tháng trước trở lại như cũ. Muốn xóa tháng cũ hơn: xóa lùi dần từ tháng mới nhất. Nên **Tải database.json** trước khi xóa.

### 5.3h. Bản 2026-11-19
- **Chỉ tính là NỢ khi kỳ đó đã nhập điện nước.** Khách mới vào ở (hóa đơn đầu, chỉ có tiền phòng) chưa tính là nợ, chưa báo "quá hạn", không cộng vào Phòng cần thu / Tổng tiền cần thu / Tổng công nợ. Khi bạn ghi điện nước cho kỳ sau, nếu tiền phòng kỳ đầu vẫn chưa bấm **Đã nhận tiền** thì nó thành **Nợ cũ (ghi rõ tháng)**. Ví dụ vào ở 1/1: tới 1/2 (khi đã ghi điện nước) mới có thể hiện chữ **Quá hạn**.
- **Nút Zalo** có icon Zalo và màu xanh Zalo; bấm mở zalo.me/<số Zalo>.
- **Ảnh CCCD** ở hồ sơ khách hiện sẵn, bấm vào ảnh để phóng to.
- **Sửa ngày nhận phòng:** trang chi tiết phòng → "Vào ở … **Sửa ngày**". Chỉ sửa được khi khách mới có hóa đơn đầu tiên và chưa đổi giá; đã có tháng sau thì xóa các hóa đơn tháng sau trước.
- **Xóa dòng hóa đơn:** nút **Xóa** ở mọi dòng của khách đang thuê. Xóa một tháng thì xóa luôn các tháng sau nó (kèm thu tiền và chỉ số điện nước). Dòng đầu tiên = **xóa khách nhập nhầm** (xóa khách, người ở cùng, ảnh, hóa đơn; phòng về Trống), chỉ làm được khi chưa có tháng sau. Luôn có cảnh báo dữ liệu quan trọng và ô xác nhận.
- **Chuyển phòng** chỉ chọn được phòng đang Trống.
- Nút **Thu toàn bộ nợ** đổi thành **Thanh toán**.
- Chữ trong thẻ phòng to hơn (từ 1rem).

### 5.3i. Bản 2026-11-20: nút Gọi và tiền phòng kỳ đầu
- **Nút Gọi** (icon điện thoại, màu xanh lá) cho từng số điện thoại của khách và từng người ở cùng, nằm cạnh nút Zalo, ở trang chi tiết phòng và trang khách thuê. Bấm là gọi (`tel:`).
- **Nhận khách mới:** ô **"Đã thu đủ tiền phòng kỳ đầu"** được **tích sẵn**. Lưu khách là hệ thống tự ghi nhận đã thu tiền phòng đầu kỳ (ngày thu = ngày nhận phòng). Nên không còn thông báo "Chưa thanh toán T11". Bỏ tích nếu chưa nhận tiền.
- **Tháng sau (T12):** chỉ phát sinh nợ khi bạn nhập điện nước của phòng đó; **Nợ cũ = 0** nếu tháng đầu đã thu.
- **Khách đã nhập từ trước mà tháng đầu chưa ghi nhận thu:** trang chi tiết phòng có thẻ **"Tiền phòng kỳ đầu chưa ghi nhận đã thu"** với nút **Ghi nhận đã thu tiền phòng đầu kỳ**; bấm một lần là xong (thẻ này không phải thông báo nợ).

### 5.3j. Bản 2026-11-21: hiển thị phòng gọn và nhắc ghi điện nước
- **Tình trạng phòng** chỉ là **chữ màu** (không nền, không viền): *Đang cho thuê* (xanh dương), *Đang trống* (xanh nhạt), *Đang khóa* (xám), *Đang sửa chữa* (đỏ).
- **Phòng khóa/sửa** trên trang quản lý chỉ hiện "Phòng 5 · Đang khóa" và **ghi chú của phòng** (ví dụ "Đang Bán Trứng"); trang ngoài không hiện ghi chú riêng. Thẻ **Chủ Nhà** bỏ dòng chữ thừa.
- **Nhắc ghi điện nước** (khung màu cam): nằm phía trên **"DANH SÁCH PHÒNG"** (trang ngoài) và **"Các phòng"** (trang quản lý), liệt kê phòng **đã tới ngày ghi** (kèm "trễ n ngày") và phòng **sắp tới ngày ghi** (trong 5 ngày). Tính theo ngày nhận phòng của từng khách. Ví dụ khách ở từ 1/10: tới 1/11 là báo.
- **Đổi ngày nhận phòng sớm hơn** (ví dụ 1/11 → 1/10): hệ thống cập nhật ngay, nên nếu đã qua ngày ghi (1/11) mà chưa ghi điện nước thì báo liền, không còn "Không có việc cần xử lý".

### 5.3k. Bản 2026-11-22
- **Xóa dòng trong "Hóa đơn theo tháng":** mọi dòng (đã thanh toán, thanh toán 1 phần, trả phòng; khách đang thuê hay đã trả phòng) đều có nút **Xóa**. Xóa một dòng thì xóa luôn các dòng sau nó của cùng khách (kèm thu tiền, chỉ số điện nước, kết quả trả phòng). Tháng vừa xóa **quay về dòng trống "Chưa có hóa đơn"** để nhập mới, bảng vẫn đủ 12 tháng. Xóa dòng đầu của khách đã trả phòng = xóa toàn bộ lịch sử thuê và hồ sơ khách (nếu không còn lượt thuê khác). Tháng có 2 dòng (hai khách khác nhau) thì xóa riêng từng dòng. Luôn có cảnh báo và ô xác nhận; nên **Tải database.json** trước.
- **Sửa số liệu hóa đơn mới nhất:** mở hóa đơn → **Điều chỉnh** (có thể đưa về 0 hoặc xóa trống).
- **Tổng quan và Tổng quan cần xử lý:** nền **trắng**, chỉ chữ màu (xanh, cam, tím, đỏ…); thông báo cũng nền trắng.
- **iPhone/iPad:** nút **"Thêm icon trên iOS"** nằm ngay đầu trang (cạnh nút Đăng nhập), bấm mở hướng dẫn 4 bước có hình chỉ nút Chia sẻ. iOS **không cho trang web tự thêm icon** nên bắt buộc làm: Safari → Chia sẻ → Thêm vào Màn hình chính → Thêm. Android/máy tính: nút "Thêm icon" mở hộp thoại cài đặt của trình duyệt.

### 5.3l. Bản 2026-11-23
- **Lưu khách nhanh hơn:** lưu xong là vào phòng ngay; ảnh CCCD tải lên ở chế độ nền (2 ảnh tải song song, ảnh nhỏ hơn nên nhanh hơn); mỗi ảnh bớt một lần đọc dữ liệu; ghi Google Sheet không còn bắt chờ (chạy nền).
- **"Tiền phòng đầu kỳ đã nhận":** khách mới (đã tích thu tiền phòng kỳ đầu) hiện **Tiền phòng đầu kỳ đã nhận: <số tiền phòng>**, ở thẻ phòng và trang chi tiết phòng. Chỉ khi chưa tích mới ghi "chưa nhận".
- **Đồng hồ tổng Chủ Nhà** (làm đúng cách tính của bạn):
  - Bấm vào thẻ **Chủ Nhà** → thẻ **Số Đồng Hồ Tổng Cũ** (ngày chốt, số điện, số nước): nhập một lần, lưu lại như thông tin ngân hàng, bấm **Sửa** khi cần.
  - Hàng tháng khi thanh toán điện nước với nhà nước: bấm nút **Ghi đồng hồ tổng** (thẻ Chủ Nhà ngoài trang chủ, hoặc nút trong trang Chủ Nhà) → nhập **số MỚI**. Hệ thống tính **Số mới − Số cũ = cả dãy trọ và nhà dùng**, rồi **trừ tổng các phòng** ra **Chủ Nhà dùng**. Số mới tháng này tự là số cũ của tháng sau.
- **Ảnh QR ngân hàng:** thẻ thông tin ngân hàng có **Tải ảnh QR lên / Thay ảnh QR / Xóa ảnh QR**. QR chỉ hiện trên hóa đơn (màn hình và ảnh JPG) khi đã tải ảnh lên.
- **Lịch:** ngày dương in đậm, ngày âm không in đậm.
- **Thông báo cần xử lý:** có nút **Xem hóa đơn** để gửi khách. Hóa đơn của khách còn nợ hiện số điện nước cũ/mới, tiền phòng, **Đã thanh toán trước** và **Còn nợ** (màu đỏ).

### 5.3m. Bản 2026-11-24
- **Xem hóa đơn trước khi thanh toán:** bấm **Thanh toán / Thanh toán tháng N / Ghi nhận đã thu** → trong hộp thoại có nút **Xem hóa đơn** (bấm để hiện hóa đơn ngay trong hộp thoại), xem xong nhấn **ĐÃ NHẬN TIỀN** bên dưới. Mỗi tháng chưa thanh toán ở trang chi tiết phòng cũng có nút **Xem hóa đơn** riêng.
- **Dòng "Còn nợ" trên hóa đơn** to và đỏ hơn (cả màn hình lẫn ảnh JPG).
- **Nợ cộng dồn, ghi rõ từng tháng:** tháng nào chưa trả hết thì tháng sau cộng dồn; dòng **Nợ cũ** liệt kê "Còn nợ tháng 2: …, tháng 3: …". Trả riêng tháng nào thì chỉ còn các tháng kia.
- **Đồng hồ tổng Chủ Nhà tính theo THÁNG:** mỗi tháng có 1 số tổng MỚI, **ghi vào ngày nào trong tháng cũng được** (kể cả cùng ngày với số cũ). Quy tắc duy nhất: số mới **không nhỏ hơn** số cũ đã lưu. Tháng đó: **(số mới − số cũ) − tổng điện/nước các phòng đã ghi trong tháng = Chủ Nhà dùng**. Tháng được **chốt khi phòng cuối cùng đã ghi chỉ số** (ngày chốt = ngày phòng đó, hoặc ngày ghi số tổng nếu muộn hơn). Trước khi chốt hiện "Đang chờ: Phòng X".
- **Ảnh tải lên được nén nhỏ** (tối đa 1280px, thường dưới 450 KB) nên tải lên và hiển thị nhanh hơn; ảnh CCCD vẫn đọc rõ chữ.

### 5.3n. Bản 2026-11-25
- **Phòng đang khóa:** thẻ nền **xám nhạt** kèm **icon khóa lớn** phía dưới nền (phân biệt rõ với phòng sửa chữa màu đỏ), ở cả trang chủ quản trị và trang ngoài.
- **Trang ngoài:**
  - Bấm phòng còn nợ trong "Tổng quan cần xử lý" sẽ hỏi **đăng nhập để thanh toán**, đăng nhập xong vào thẳng phòng đó.
  - **Icon chuông + số thông báo** hiện ở đầu trang (cạnh nút Đăng nhập); bấm chuông cuộn tới phần thông báo.
- **Điện – nước các phòng so với tháng trước** luôn có thẻ **Chủ Nhà** (chưa có số đồng hồ tổng thì ghi hướng dẫn nhập).
- **Cảnh báo rò rỉ** khi mức dùng mới nhất tăng quá **20%** (trước là 30%), áp dụng cho từng phòng và Chủ Nhà.
- **Nhật ký thao tác gần đây** (tab Sao lưu) chỉ hiện **10 dòng mới nhất**; nút **Xem thêm (còn … dòng)** hiện thêm, **Thu gọn** về 10 dòng.

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
