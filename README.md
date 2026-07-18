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

Xe dùng hộp số sàn KHÔNG CÔN (ly hợp luôn coi như ăn khớp hoàn toàn, giống hộp số tự động
hoá ly hợp / AMT) nên không có bàn đạp côn.

| Phím | Chức năng |
|---|---|
| ← (mũi tên trái) | Đánh vô lăng qua trái |
| → (mũi tên phải) | Đánh vô lăng qua phải |
| X | Chân ga |
| C | Chân phanh |
| Space (giữ) | Phanh tay |
| 1 2 3 4 | Vào số 1-4 |
| R | Số lùi |
| N | Số Mo |
| E | Đề máy / Tắt máy |
| A | Xi nhan trái |
| D | Xi nhan phải |

## Ghi chú kỹ thuật

- Toàn bộ texture (asphalt, cỏ, curb, biển số...) được sinh thủ tục bằng `CanvasTexture`
  (chỉ dùng để tạo dữ liệu ảnh nạp vào GPU qua WebGL - không phải render 2D).
- Xe được dựng bằng geometry Three.js thuần (procedural). `GLTFLoader` đã được tích hợp sẵn
  trong `js/vehicle.js`: nếu bạn đặt file model thật vào `assets/models/sedan.glb`, xe sẽ tự
  động nạp model đó thay cho xe procedural.
- Âm thanh (máy nổ, phanh, va chạm, xi-nhan, hoàn thành bài...) được tổng hợp trực tiếp bằng
  Web Audio API, không dùng file âm thanh nhị phân.
- Vật lý xe dùng mô hình Bicycle Model chuẩn (không phải arcade), có hộp số sàn KHÔNG CÔN
  (1 2 3 4, R, N), đề máy và thắng động cơ mô phỏng theo đường cong mô-men xoắn động cơ.
  Vòng tua máy được suy ra trực tiếp từ tốc độ bánh xe theo tỉ số truyền hiện tại (coi như
  ly hợp luôn ăn khớp hoàn toàn khi đã vào số), nên không còn hiện tượng chết máy do côn.
