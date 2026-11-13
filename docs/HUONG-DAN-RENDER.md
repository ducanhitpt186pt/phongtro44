# Chạy trang web trên Render (khắc phục lỗi `Running '0'` / `0: command not found`)

## Vì sao bị lỗi?
Log của bạn có dòng `Running '0'`: ô **Start Command** trên Render đang bị đặt thành `0` nên Render chạy lệnh "0" và báo `command not found`. Ngoài ra bản mã cũ trong GitHub chưa có chương trình để Render khởi động (dự án ban đầu viết cho Vercel). Bản mới có sẵn `server.js` và lệnh `npm start`.

## Cách sửa (từng bước)
1. **Đưa mã mới lên GitHub** (repo đang nối với Render): Add file → Upload files → kéo thả toàn bộ file bên trong thư mục giải nén `nha-tro-44-website` (phải có `server.js` và `package.json` mới) → Commit changes.
2. Mở **Render** → bấm dịch vụ web của bạn → **Settings**.
3. Mục **Build & Deploy**:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`  (xóa chữ `0` cũ)
   - Bấm **Save Changes**.
4. Mục **Health Check Path** (cũng trong Settings): gõ `/healthz` → Save.
5. Thẻ **Environment** → **Add Environment Variable**, thêm lần lượt (Key → Value):
   - `APP_PASSWORD` → mật khẩu quản trị
   - `SESSION_SECRET` → chuỗi ngẫu nhiên từ 32 ký tự trở lên
   - `KV_REST_API_URL` và `KV_REST_API_TOKEN` → lấy ở Upstash console → database → **REST API** (dùng token **ghi**, không phải READ ONLY)
   - `BLOB_READ_WRITE_TOKEN` → chỉ cần nếu muốn lưu ảnh CCCD (lấy trong Vercel → Storage → Blob → token)
   - (tùy chọn) `GOOGLE_SHEET_WEBHOOK_URL`, `GOOGLE_SHEET_SECRET` nếu dùng sao lưu Google Sheet
   Bấm **Save Changes**.
6. Thẻ **Manual Deploy** (góc trên phải) → **Deploy latest commit**. Đợi trạng thái **Live**.
7. Kiểm tra: mở `https://<tên-dịch-vụ>.onrender.com/healthz` phải hiện `ok`; mở `/kiemtra.html` mọi dòng ✅.

## Lưu ý
- Gói **Free** của Render tự "ngủ" sau ~15 phút không có người truy cập; lần mở đầu tiên có thể chờ 30–60 giây. Dữ liệu vẫn an toàn vì nằm ở Upstash (không nằm trên Render).
- Có thể chạy song song Vercel và Render cùng một database Upstash, nhưng nên dùng **một địa chỉ chính** để khỏi nhầm.
- Dịch vụ phải là loại **Web Service** (không phải Static Site / Background Worker).
