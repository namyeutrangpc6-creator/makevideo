# Remix Studio AI — tùy chọn số lượng

## Frontend Cloudflare Pages
Upload/replace các file `index.html`, `app.js`, `style.css`, `_headers` ở thư mục gốc của repo Pages.

## Worker
Cập nhật mã `worker.js` trên Cloudflare Workers rồi Deploy. Worker mới nhận `count` từ frontend, giới hạn 1–20 kịch bản. Nếu chỉ cập nhật frontend mà không cập nhật Worker thì Worker cũ vẫn sinh cố định 10 kịch bản.

## Cách dùng
Trong giao diện, nhập số lượng từ 1 đến 20. Mặc định là 5. Số lượng này được áp dụng cho kịch bản AI, kịch bản mẫu, tạo giọng hàng loạt và dựng video.

Lưu ý: `app.js` hiện dùng Kokoro ở `http://localhost:7860/tts/generate`, nên cần mở trang Remix trên chính máy có Kokoro và cấu hình Kokoro cho phép yêu cầu từ origin Pages (CORS/HTTPS mixed-content có thể cần xử lý).
