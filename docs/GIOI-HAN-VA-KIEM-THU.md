# Giới hạn còn tồn tại & kết quả kiểm thử

## Cần bạn xác nhận (đang áp dụng giả định sau)
1. **Mô hình thu tiền**: tiền phòng thu TRƯỚC cho kỳ mới tại ngày đến hạn; điện nước là số tiêu thụ của kỳ vừa qua, chốt ở cùng ngày đến hạn. Kỳ đầu chỉ có tiền phòng.
2. **Chuyển phòng**: tiền phòng kỳ đã lập được giữ cho phòng mới đến hết kỳ; chu kỳ ngày thu không đổi; giá mới áp dụng từ kỳ sau; phòng cũ có hóa đơn "chốt phòng" riêng (điện nước + nợ còn lại).
3. **Hoàn tiền trả phòng**: hệ thống ghi "cần hoàn X đ" và nhắc ở màn hình ngoài cho tới khi bạn bấm xác nhận đã hoàn.
4. **Nợ của khách đã trả phòng** vẫn hiện ở thông báo cho tới khi thu đủ (để không bỏ sót nợ).

## Giới hạn kỹ thuật
- **GitHub JSON không phải CSDL thật.** Mỗi lần lưu mất ~1–3 giây. Khi hai thao tác trùng thời điểm, hệ thống đọc lại dữ liệu mới nhất rồi áp dụng lại (không ghi đè). Nếu thử 6 lần vẫn xung đột sẽ báo lỗi và KHÔNG lưu. Với 1 người dùng, 7 phòng, rủi ro này rất thấp.
- **Trang ngoài đăng nhập là công khai**: ai biết địa chỉ web đều thấy tên phòng, kỳ, số tiền, còn nợ (theo yêu cầu của bạn) nhưng không thấy thông tin khách. Dữ liệu cập nhật trễ tối đa ~15–30 giây do bộ nhớ đệm.
- **Chống dò mật khẩu** là nỗ lực tốt nhất (khóa 5 lần sai theo từng máy chủ Vercel, mỗi lần chờ 0,4 giây). Vì vậy mật khẩu 8 chữ số `20101963` (dạng ngày tháng) **dễ đoán**: nên đổi sang mật khẩu dài ≥ 12 ký tự có chữ + số.
- **Phiên đăng nhập** (14 ngày) không thu hồi riêng lẻ được; muốn hủy tất cả hãy đổi `SESSION_SECRET`.
- **Vercel Hobby** dành cho dự án cá nhân, phi thương mại theo điều khoản của Vercel; cho thuê trọ có thể bị xem là thương mại. Nếu lo ngại, nâng cấp Pro ($20/tháng) – mã nguồn không đổi.
- **Vercel Blob private** (kho ảnh) ghi nhận ở trạng thái beta khi tra cứu; hạn mức Hobby 1 GB, vượt thì bị chặn ~30 ngày, không tính phí.
- Ảnh gửi qua Function tối đa ~4,5 MB (ảnh đã nén ~1–2 MB nên đủ).
- Xuất báo cáo: **Excel dạng CSV**, JSON, in trình duyệt. Không có PDF/ảnh hóa đơn (theo yêu cầu: hóa đơn hiển thị HTML để chụp màn hình).
- Không hỗ trợ tiền thừa (không cho thu vượt số còn phải thu).
- Nếu GitHub trả lỗi 5xx sau khi thực tế đã ghi, lần thử lại có thể báo "trùng" (ví dụ tên phòng) – dữ liệu vẫn nguyên vẹn, chỉ cần tải lại trang.

## Đã kiểm thử tự động (đạt)
- **Logic tính tiền – 26 ca** (`npm test`): ngày đến hạn (10/11→10/12→10/01; 31/01→28/02→31/03; năm nhuận), múi giờ VN, kỳ đầu thu đủ, điện nước và chỉ số âm bị từ chối, không lập trùng/bỏ kỳ, thanh toán một phần/nhiều lần/âm/vượt, **nợ cũ chuyển đúng không tính trùng (1.200.000+150.000+50.000+200.000 = 1.600.000)**, đổi giá không đổi hóa đơn cũ, hủy giao dịch, điều chỉnh có lịch sử, **trả phòng ví dụ chuẩn hoàn đúng 870.000đ**, trả phòng khi kỳ mới chưa thanh toán (không trừ tiền trả trước), chuyển phòng, thông báo theo từng trạng thái, API công khai không chứa tên/SĐT/CCCD/địa chỉ/ngày sinh.
- **Tích hợp API với GitHub giả lập – 11 ca**: truy cập API riêng tư khi chưa đăng nhập bị 401; sai/đúng mật khẩu; thiếu CSRF bị 403; **xung đột SHA được xử lý không mất dữ liệu**; GitHub lỗi ghi → báo thất bại, không báo thành công; sao lưu/khôi phục có xác nhận và bản an toàn.
- **Trình duyệt thật (Chromium, khung hình điện thoại 390×844) – 16 bước**: màn hình ngoài, đăng nhập sai/đúng, thêm khách + người ở cùng, chặn khi thiếu ảnh CCCD, xem trước/xoay ảnh, trang ngoài hiển thị đúng "chưa thanh toán → một phần → hết thông báo" và không lộ thông tin khách, xem ảnh CCCD qua API đã xác thực, báo cáo, sao lưu, đăng xuất.

## CHƯA kiểm thử được (cần bạn thử trên thiết bị thật sau khi triển khai)
- Camera trên iPhone Safari, iPad Safari, Android Chrome (dùng `capture="environment"`; trên máy tính sẽ mở hộp chọn file).
- Kết nối thật tới GitHub và Vercel Blob (môi trường kiểm thử không có mạng ngoài; đã dùng bản giả lập).
- Các luồng: ghi điện nước nhiều kỳ, trả phòng, chuyển phòng, đổi giá, hủy thanh toán, khôi phục JSON **ở mức giao diện** mới được chạy bằng kiểm thử logic, chưa bấm từng nút trên trình duyệt.
- In hóa đơn, xuất CSV trên điện thoại.
