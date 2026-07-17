# Mô Phỏng Sát Hạch Lái Xe Hạng B - 3D (Three.js)

## Cách chạy

Trình duyệt chặn ES Module (`import`) khi mở file trực tiếp bằng `file://`, nên bạn cần chạy qua
một local server đơn giản. Tại thư mục gốc dự án, chọn 1 trong các cách sau:

```bash
# Cách 1: dùng Python (có sẵn trên hầu hết máy)
python3 -m http.server 8080

# Cách 2: dùng Node.js
npx serve .

# Cách 3: VSCode -> cài extension "Live Server" -> Go Live
```

Sau đó mở trình duyệt tại: `http://localhost:8080`

## Điều khiển

| Phím | Chức năng |
|---|---|
| W / ↑ | Ga |
| S / ↓ | Phanh |
| A / ← , D / → | Đánh vô lăng |
| Space (giữ) | Đạp côn |
| 1 2 3 4 | Vào số 1-4 |
| R | Số lùi |
| N | Số Mo |
| E | Đề máy / Tắt máy |
| Q | Xi nhan trái |
| Z | Xi nhan phải |
| X | Phanh tay |

## Ghi chú kỹ thuật

- Toàn bộ texture (asphalt, cỏ, curb, biển số...) được sinh thủ tục bằng `CanvasTexture`
  (chỉ dùng để tạo dữ liệu ảnh nạp vào GPU qua WebGL - không phải render 2D).
- Xe được dựng bằng geometry Three.js thuần (procedural). `GLTFLoader` đã được tích hợp sẵn
  trong `js/vehicle.js`: nếu bạn đặt file model thật vào `assets/models/sedan.glb`, xe sẽ tự
  động nạp model đó thay cho xe procedural.
- Âm thanh (máy nổ, phanh, va chạm, xi-nhan, hoàn thành bài...) được tổng hợp trực tiếp bằng
  Web Audio API, không dùng file âm thanh nhị phân.
- Vật lý xe dùng mô hình Bicycle Model chuẩn (không phải arcade), có hộp số sàn với ly hợp,
  chết máy, đề máy và thắng động cơ mô phỏng theo đường cong mô-men xoắn động cơ.
