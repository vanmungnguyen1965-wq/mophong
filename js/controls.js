/**
 * InputController - đọc bàn phím và quy đổi thành tín hiệu điều khiển xe số sàn KHÔNG CÔN
 * (ly hợp được coi như luôn ăn khớp hoàn toàn - kiểu số sàn "clutchless"):
 * vô lăng (steer), chân ga (throttle), chân phanh (brake),
 * cần số (1, 2, 3, 4, R, N), đề máy, phanh tay, xi-nhan trái/phải.
 *
 * Sơ đồ phím:
 *   Mũi tên Trái / Phải : đánh vô lăng (qua trái / qua phải, tự trả lái khi nhả)
 *   X                    : chân ga
 *   C                    : chân phanh
 *   A                    : xi-nhan trái
 *   D                    : xi-nhan phải
 *   Space                : phanh tay (giữ)
 *   1 2 3 4              : vào số 1-4
 *   R                     : số lùi
 *   N                     : số Mo
 *   E                     : đề máy / tắt máy
 */
export class InputController {
  constructor() {
    this.keys = new Set();

    this.throttle = 0;
    this.brake = 0;
    this.steer = 0;
    this.handbrake = false;
    this.gear = 'N';

    this.ignitionPressed = false; // sự kiện tức thời (edge) - đề máy
    this.turnSignalLeft = false;
    this.turnSignalRight = false;

    this._ignitionKeyDown = false;

    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this._onKeyUp(e));

    this._bindVirtualButtons();
  }

  _onKeyDown(e) {
    const k = e.key.toLowerCase();
    // Ngăn trình duyệt cuộn trang khi giữ Space (phanh tay) hoặc mũi tên (vô lăng)
    if ([' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault();
    this.keys.add(k);

    if (k === 'e' && !this._ignitionKeyDown) {
      this._ignitionKeyDown = true;
      this.ignitionPressed = true; // xử lý xong sẽ bị main loop reset về false
    }
    if (['1', '2', '3', '4'].includes(k)) this.gear = k;
    if (k === 'r') this.gear = 'R';
    if (k === 'n') this.gear = 'N';
    if (k === 'a') { this.turnSignalLeft = !this.turnSignalLeft; this.turnSignalRight = false; }
    if (k === 'd') { this.turnSignalRight = !this.turnSignalRight; this.turnSignalLeft = false; }
  }

  _onKeyUp(e) {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
    if (k === 'e') this._ignitionKeyDown = false;
  }

  /** Gắn sự kiện cho các nút bấm ảo (nếu có phần tử HTML tương ứng) - phục vụ mobile */
  _bindVirtualButtons() {
    const map = {
      'vbtn-throttle': () => (this._vThrottle = true),
      'vbtn-brake': () => (this._vBrake = true),
    };
    // Không bắt buộc phải tồn tại các nút này trong DOM; nếu không có sẽ bỏ qua an toàn.
    Object.keys(map).forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', map[id]);
    });
  }

  /** Gọi mỗi khung hình để tính toán giá trị pedal mượt (tăng/giảm dần thay vì bật/tắt tức thời) */
  update(dt) {
    const rate = 3.2; // tốc độ tăng/giảm pedal mỗi giây

    const wantThrottle = this.keys.has('x');
    const wantBrake = this.keys.has('c');
    const wantLeft = this.keys.has('arrowleft');
    const wantRight = this.keys.has('arrowright');
    this.handbrake = this.keys.has(' ');

    this.throttle = this._approach(this.throttle, wantThrottle ? 1 : 0, rate * dt);
    this.brake = this._approach(this.brake, wantBrake ? 1 : 0, rate * dt);

    // Vô lăng: quay dần về 0 khi không giữ phím (tự trả lái)
    // Lưu ý dấu: do quy ước hệ trục của xe (heading tăng => xe quay sang trái),
    // nên phím Trái phải cho steerTarget dương và phím Phải cho steerTarget âm.
    let steerTarget = 0;
    if (wantLeft) steerTarget = 1;
    if (wantRight) steerTarget = -1;
    this.steer = this._approach(this.steer, steerTarget, 2.6 * dt);
  }

  _approach(current, target, maxDelta) {
    if (current < target) return Math.min(current + maxDelta, target);
    if (current > target) return Math.max(current - maxDelta, target);
    return current;
  }

  /** Lấy và reset sự kiện đề máy (tránh giữ phím E gây bật/tắt liên tục) */
  consumeIgnitionEvent() {
    const v = this.ignitionPressed;
    this.ignitionPressed = false;
    return v;
  }

  getInputState() {
    return {
      throttle: this.throttle,
      brake: this.brake,
      steer: this.steer,
      handbrake: this.handbrake,
      gear: this.gear,
    };
  }
}
