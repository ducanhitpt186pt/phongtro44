# Triển khai & sửa lỗi bằng dòng lệnh (CMD) – không cần GitHub nối Vercel

Cách này đưa THẲNG thư mục trên máy bạn lên Vercel, mọi lỗi hiện ngay trong cửa sổ lệnh.
(Các lệnh `vercel ...` do Vercel cung cấp; thứ tự câu hỏi có thể khác chút tùy phiên bản – cứ chọn mặc định nếu không chắc.)

## 0. Chuẩn bị (1 lần)
1. Cài **Node.js** bản LTS từ https://nodejs.org (Next, Next, Finish).
2. Giải nén `nha-tro-44-website.zip` vào thư mục dễ nhớ, ví dụ `C:\nhatro44`.
3. Mở CMD: bấm Start, gõ `cmd`, Enter. Gõ:
```
cd C:\nhatro44\nha-tro-44-website
node -v
```
(`node -v` phải hiện số phiên bản, ví dụ v22.x. Nếu báo "không nhận ra lệnh": đóng CMD, mở lại sau khi cài Node.)

## 1. Kiểm tra database Upstash bằng 1 lệnh
Lấy từ trang Upstash của bạn: **REST URL** (dạng `https://xxxx.upstash.io`) và **REST TOKEN** (khóa có quyền ghi; ô "Read-Only Token" phải để TẮT).
```
node scripts\kiem-tra-upstash.mjs
```
Dán URL, Enter, dán TOKEN, Enter. Kết quả:
- ✅ ✅ ✅ ĐÃ ỔN → hai giá trị này dùng được. Chuyển bước 2.
- ❌ "CHỈ ĐỌC" → bạn dán nhầm khóa chỉ đọc. Lấy khóa thường.
- ❌ "Token bị từ chối" → khóa sai/đã reset. Lấy khóa mới trong Upstash.
- ❌ "Không kết nối được" → sai địa chỉ hoặc mất mạng.
- ❌ "dán địa chỉ rediss://" → dán nhầm; cần địa chỉ bắt đầu `https://`.

## 2. Cài Vercel CLI và đăng nhập
```
npm install -g vercel
vercel login
```
Chọn cách đăng nhập (GitHub/Email), làm theo trình duyệt mở ra, quay lại CMD thấy "Success".

## 3. Liên kết thư mục với dự án Vercel
```
vercel link
```
Trả lời: `Set up?` → **Y**; chọn tài khoản của bạn; `Link to existing project?` → nếu đã có dự án `nha-tro-44-website` thì **Y** rồi gõ tên đó, nếu muốn làm mới hoàn toàn thì **N** và đặt tên dự án mới; thư mục code → Enter (`./`).

## 4. Tạo các biến (mỗi lệnh sẽ hỏi giá trị, dán rồi Enter)
```
vercel env add APP_PASSWORD production
vercel env add SESSION_SECRET production
vercel env add KV_REST_API_URL production
vercel env add KV_REST_API_TOKEN production
```
- `APP_PASSWORD`: mật khẩu đăng nhập của bạn.  `SESSION_SECRET`: chuỗi ngẫu nhiên ≥ 32 ký tự.
- `KV_REST_API_URL` và `KV_REST_API_TOKEN`: đúng hai giá trị đã kiểm tra ✅ ở bước 1.
- Nếu hỏi "Mark as sensitive?" chọn Yes. Xem lại danh sách (chỉ hiện tên): `vercel env ls`
- Kho ảnh CCCD (Blob) tạo ở trang Vercel: Storage → Create Database → Blob → Private → kết nối dự án (chỉ ảnh CCCD cần; xem thông báo thì không cần).

## 5. Đưa lên mạng và xem lỗi ngay
```
vercel --prod
```
Chờ chạy xong. Cuối cùng hiện dòng `Production: https://....vercel.app`.
- Nếu có chữ **Error** màu đỏ: chụp cửa sổ CMD (không có khóa nào hiện ra) gửi tôi.
- Mở `https://<địa-chỉ>/kiemtra.html` → mọi dòng ✅ là xong.

## 6. Lệnh hữu ích khi lỗi
```
vercel ls                      (danh sách các lần triển khai và trạng thái)
vercel inspect <địa-chỉ>       (chi tiết một lần triển khai, thấy hàm máy chủ api/…)
vercel logs <địa-chỉ>          (nhật ký chạy thật khi web báo lỗi)
vercel env ls                  (xem tên biến đã có)
```

## 7. LÀM LẠI TỪ ĐẦU (xóa hết kết nối)
Làm theo thứ tự, chỉ làm những phần bạn cần:
1. **Xóa dữ liệu nhà trọ trong Upstash** (sau khi đã tải file sao lưu .json từ web):
```
node scripts\xoa-du-lieu-upstash.mjs
```
Gõ `XOA` để xác nhận. (Hoặc xóa hẳn database trong Upstash console rồi tạo lại, chọn vùng Singapore, rồi lấy REST URL/TOKEN mới.)
2. **Đổi một biến sai:** `vercel env rm KV_REST_API_TOKEN production` rồi `vercel env add KV_REST_API_TOKEN production`, sau đó `vercel --prod`.
3. **Ngắt/nối lại GitHub:** `vercel git disconnect` (ngắt) và `vercel git connect` (nối lại).
4. **Xóa cả dự án Vercel và làm lại:**
```
vercel project rm nha-tro-44-website
rmdir /s /q .vercel
vercel link
```
rồi làm lại từ bước 4 (tạo biến) và bước 5 (triển khai). (Cũng xóa được bằng giao diện web: Vercel → dự án → Settings → General → kéo xuống cuối → Delete Project.)

## Bảo mật
- Chỉ dán khóa vào CMD hoặc ô giá trị trên Vercel/Upstash; không gửi vào chat/email. Nếu lỡ lộ khóa: Upstash → Reset Password/Rotate token → chạy lại bước 1 với khóa mới → `vercel env rm KV_REST_API_TOKEN production` + `vercel env add ...` + `vercel --prod`.
