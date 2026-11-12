# Giới hạn còn tồn tại & kết quả kiểm thử

## Cần bạn xác nhận (đang áp dụng giả định sau)
1. **Mô hình thu tiền**: tiền phòng thu TRƯỚC cho kỳ mới tại ngày đến hạn; điện nước là số tiêu thụ của kỳ vừa qua, chốt ở cùng ngày đến hạn. Kỳ đầu chỉ có tiền phòng.
2. **Chuyển phòng**: tiền phòng kỳ đã lập được giữ cho phòng mới đến hết kỳ; chu kỳ ngày thu không đổi; giá mới áp dụng từ kỳ sau; phòng cũ có hóa đơn "chốt phòng" riêng (điện nước + nợ còn lại).
3. **Hoàn tiền trả phòng**: hệ thống ghi "cần hoàn X đ" và nhắc ở màn hình ngoài cho tới khi bạn bấm xác nhận đã hoàn.
4. **Nợ của khách đã trả phòng** vẫn hiện ở thông báo cho tới khi thu đủ (để không bỏ sót nợ).

## Giới hạn kỹ thuật
- **Số liệu hạn mức Upstash hiển thị là ƯỚC TÍNH** theo bộ đếm của chính ứng dụng (mỗi lần đọc +3, mỗi lần ghi +4, cộng theo tháng giờ Việt Nam), không phải số liệu chính thức của Upstash; số chính xác xem ở bảng điều khiển Upstash. Dung lượng dữ liệu tính theo kích thước dữ liệu nén đã lưu. Cảnh báo cam từ 80%, đỏ từ 95%.
- **Nơi lưu dữ liệu: Upstash Redis gói miễn phí** (256 MB, 500.000 lệnh/tháng, 10 GB băng thông; theo trang giá của Upstash khi tôi tra cứu, không cần thẻ). Mỗi lần đọc tốn 1 lệnh, mỗi lần ghi ~2 lệnh; trang thông báo công khai được đệm ~20 giây nên 1 người mở liên tục cũng chỉ ~90.000 lệnh/tháng. Dung lượng dữ liệu thực tế chỉ vài trăm KB (đã nén gzip). Nếu chạm hạn mức, Upstash **chặn** chứ không tự tính tiền (trừ khi bạn tự thêm thẻ); web sẽ báo lỗi rõ và không lưu dở.
- **Chưa kiểm chứng với Upstash thật:** logic "so sánh rồi ghi" dùng một lệnh EVAL (Lua) ngắn; tôi chỉ chạy được với bản giả lập mô phỏng đúng ngữ nghĩa, chưa chạy script Lua trên Upstash thật. Nếu Upstash trả lỗi lạ ở lần lưu đầu tiên, báo tôi kèm nội dung lỗi.
- **Upstash có thể tạm lưu trữ/ngưng cơ sở dữ liệu miễn phí không hoạt động lâu** (chính sách có thể thay đổi). Nhà trọ dùng hằng ngày nên khó xảy ra, nhưng vẫn phải tải bản sao lưu về hằng tháng.
- **Bản sao lưu tự động nằm cùng nhà cung cấp** với dữ liệu: không thay thế được bản bạn tự tải về.
- **Trang ngoài đăng nhập là công khai:** ai biết địa chỉ web đều xem được tên phòng, kỳ, số tiền, còn nợ, họ tên khách và ghi chú (nếu bật), sự kiện (nếu bật). SĐT, CCCD, ngày sinh, địa chỉ **không bao giờ hiện**. Số tài khoản ngân hàng chỉ hiện trên hóa đơn (sau đăng nhập), không hiện ở trang ngoài. Dữ liệu cập nhật trễ tối đa ~20–30 giây.
- **Chống dò mật khẩu:** nhập sai **8 lần** thì **khóa 10 phút** (tính theo địa chỉ IP; sau 10 phút mới nhập lại được). Khi đã nối Upstash, bộ đếm dùng chung cho mọi máy chủ Vercel; nếu Upstash không dùng được thì đếm riêng trong từng máy chủ. Mật khẩu mạnh vẫn là lớp bảo vệ chính: nên dài từ 12 ký tự trở lên.
- **Phiên đăng nhập:** mỗi thao tác (bấm, gõ, cuộn) được giữ thêm **5 phút**; để yên quá 5 phút thì phải nhập lại mật khẩu (tối đa 12 giờ liên tục). Phiên không thu hồi riêng lẻ được; muốn hủy tất cả hãy đổi `SESSION_SECRET`.
- **Vercel Hobby** dành cho dự án cá nhân, phi thương mại theo điều khoản của Vercel; cho thuê trọ có thể bị xem là thương mại. Nếu lo ngại, nâng cấp Pro ($20/tháng) – mã nguồn không đổi.
- **Vercel Blob private** (kho ảnh CCCD) theo thông báo của Vercel đã ra mắt chính thức; hạn mức Hobby 1 GB, vượt thì bị chặn ~30 ngày, không tính phí.
- Ảnh gửi qua Function tối đa ~4,5 MB (ảnh đã nén ~1–2 MB nên đủ).
- Xuất báo cáo: **Excel dạng CSV**, JSON, in trình duyệt. Không có PDF/ảnh hóa đơn (theo yêu cầu: hóa đơn hiển thị HTML để chụp màn hình).
- Không hỗ trợ tiền thừa (không cho thu vượt số còn phải thu).
- Font **SVN-Avo** không đi kèm (có bản quyền riêng, tôi không có file); mặc định dùng Inter, thay được theo `public/fonts/HUONG-DAN-FONT.txt`.

## Chạy nhiều năm không cần chỉnh sửa – cái gì tự lo, cái gì bạn phải nhớ
**Hệ thống tự lo:** sao lưu mỗi tháng (tự hết hạn sau 2 năm); cảnh báo khi dung lượng ảnh ≥ 90% kèm nút dọn; cảnh báo khi mất kết nối Upstash/Blob hoặc chạm hạn mức; không dùng GitHub token và không có API key nào do bạn phải gia hạn (khóa kết nối Upstash/Blob do Vercel cấp và không có hạn dùng); không có máy chủ riêng cần bảo trì.
**Dung lượng thực tế:** dữ liệu JSON chỉ ~vài trăm KB sau nhiều năm (7 phòng ≈ 100 hóa đơn/năm). Thứ duy nhất tốn chỗ là ảnh CCCD: ~1–2 MB/ảnh. 1 GB đủ ~300 khách; với 7 phòng thì thường dùng được hàng chục năm, nút dọn dữ liệu chủ yếu là bảo hiểm.
**Việc bạn vẫn phải làm (không tránh được):**
1. (Không còn việc thay token GitHub nữa.) Nếu có thông báo đỏ về Upstash/Blob thì làm theo bảng "Khi gặp lỗi" trong hướng dẫn.
2. Mỗi tháng tải `database.json` về cất nơi khác (khuyến nghị) – bản tự động nằm cùng tài khoản GitHub nên không thay thế được bản của bạn.
3. Giữ tài khoản GitHub/Vercel hoạt động; nếu Vercel hoặc GitHub đổi điều khoản gói miễn phí, hoặc Vercel ngừng hỗ trợ phiên bản Node/SDK hiện dùng, có thể cần cập nhật mã. Không ai cam kết "vĩnh viễn" cho dịch vụ miễn phí của bên thứ ba.
4. Mật khẩu: đổi khi nghi bị lộ.

## Dọn dữ liệu cũ (quy tắc)
- Chỉ áp dụng cho khách **đã trả phòng từ 24 tháng trở lên**; khách đang thuê (dù vào ở bao lâu) **không bao giờ** bị xóa.
- Khách còn nợ hoặc chưa xác nhận hoàn tiền được **giữ lại** cho đến khi xử lý xong.
- Xóa: ảnh CCCD, họ tên, ngày sinh, giới tính, SĐT, CCCD, nơi cấp, địa chỉ, người ở cùng. Giữ: các con số hóa đơn/thanh toán (để báo cáo doanh thu không sai); tên trên hóa đơn cũ thành "(Đã xóa hồ sơ)".
- Trước khi xóa, trình duyệt tự tải về một bản sao lưu. Không thể hoàn tác trên hệ thống. Các bản sao lưu tự động trong GitHub vẫn chứa dữ liệu cũ cho đến khi bị tự xóa sau 24 tháng.

## Đã kiểm thử tự động (đạt)
- **Logic tính tiền – 30 ca** (gồm 2 ca dọn dữ liệu cũ) (`npm test`): ngày đến hạn (10/11→10/12→10/01; 31/01→28/02→31/03; năm nhuận), múi giờ VN, kỳ đầu thu đủ, điện nước và chỉ số âm bị từ chối, không lập trùng/bỏ kỳ, thanh toán một phần/nhiều lần/âm/vượt, **nợ cũ chuyển đúng không tính trùng (1.200.000+150.000+50.000+200.000 = 1.600.000)**, đổi giá không đổi hóa đơn cũ, hủy giao dịch, điều chỉnh có lịch sử, **trả phòng ví dụ chuẩn hoàn đúng 870.000đ**, trả phòng khi kỳ mới chưa thanh toán (không trừ tiền trả trước), chuyển phòng, thông báo theo từng trạng thái, API công khai không chứa tên/SĐT/CCCD/địa chỉ/ngày sinh.
- **Tích hợp API với Upstash Redis giả lập – 11 ca** (`tests/integration-redis.js`: chọn driver, nén gzip, xung đột ghi chen ngang, 2 ghi song song, lỗi 500, chạm hạn mức, đếm lệnh, sao lưu/khôi phục) và tương tự với Vercel Blob (9 ca) và GitHub (11 ca) – các nơi lưu phụ.
- **Tích hợp API (chung) – kiểm tra truy cập**: truy cập API riêng tư khi chưa đăng nhập bị 401; sai/đúng mật khẩu; thiếu CSRF bị 403; **xung đột SHA được xử lý không mất dữ liệu**; GitHub lỗi ghi → báo thất bại, không báo thành công; sao lưu/khôi phục có xác nhận và bản an toàn.
- **Dọn dữ liệu trong trình duyệt – 7 bước** (`tests/e2e3.cjs`): cảnh báo ≥ 90%, liệt kê khách đủ điều kiện, tự tải sao lưu, xóa, thông tin cá nhân biến mất, cảnh báo tắt, báo cáo doanh thu vẫn còn số liệu.
- **Trình duyệt thật (Chromium, khung hình điện thoại 390×844) – 16 bước**: màn hình ngoài, đăng nhập sai/đúng, thêm khách + người ở cùng, chặn khi thiếu ảnh CCCD, xem trước/xoay ảnh, trang ngoài hiển thị đúng "chưa thanh toán → một phần → hết thông báo" và không lộ thông tin khách, xem ảnh CCCD qua API đã xác thực, báo cáo, sao lưu, đăng xuất.

## CHƯA kiểm thử được (cần bạn thử trên thiết bị thật sau khi triển khai)
- Camera trên iPhone Safari, iPad Safari, Android Chrome (dùng `capture="environment"`; trên máy tính sẽ mở hộp chọn file).
- Kết nối thật tới GitHub và Vercel Blob (môi trường kiểm thử không có mạng ngoài; đã dùng bản giả lập).
- Các luồng: ghi điện nước nhiều kỳ, trả phòng, chuyển phòng, đổi giá, hủy thanh toán, khôi phục JSON **ở mức giao diện** mới được chạy bằng kiểm thử logic, chưa bấm từng nút trên trình duyệt.
- In hóa đơn, xuất CSV trên điện thoại.
