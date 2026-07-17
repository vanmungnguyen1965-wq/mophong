/**
 * InputController - đọc bàn phím và quy đổi thành tín hiệu điều khiển xe số sàn:
 * vô lăng (steer), chân ga (throttle), chân côn (clutch), chân phanh (brake),
 * cần số (R, N, 1, 2, 3, 4), đề máy, phanh tay, xi-nhan trái/phải.
 * Hỗ trợ cả bàn phím lẫn nút chạm ảo (virtual buttons) cho mobile/tablet.
 */
export class InputController {
  constructor() {
    this.keys = new Set();

    this.throttle = 0;
    this.brake = 0;
    this.clutch = 1; // mặc định đạp côn (an toàn khi khởi động)
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
    this.keys.add(k);

    if (k === 'e' && !this._ignitionKeyDown) {
      this._ignitionKeyDown = true;
      this.ignitionPressed = true; // xử lý xong sẽ bị main loop reset về false
    }
    if (['1', '2', '3', '4'].includes(k)) this.gear = k;
    if (k === 'r') this.gear = 'R';
    if (k === 'n') this.gear = 'N';
    if (k === 'q') this.turnSignalLeft = !this.turnSignalLeft, this.turnSignalRight = false;
    if (k === 'z') this.turnSignalRight = !this.turnSignalRight, this.turnSignalLeft = false;
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

    const wantThrottle = this.keys.has('w') || this.keys.has('arrowup');
    const wantBrake = this.keys.has('s') || this.keys.has('arrowdown');
    const wantClutch = this.keys.has(' ');
    const wantLeft = this.keys.has('a') || this.keys.has('arrowleft');
    const wantRight = this.keys.has('d') || this.keys.has('arrowright');
    this.handbrake = this.keys.has('x');

    this.throttle = this._approach(this.throttle, wantThrottle ? 1 : 0, rate * dt);
    this.brake = this._approach(this.brake, wantBrake ? 1 : 0, rate * dt);
    this.clutch = this._approach(this.clutch, wantClutch ? 1 : 0, rate * 1.4 * dt);

    // Vô lăng: quay dần về 0 khi không giữ phím (tự trả lái)
    let steerTarget = 0;
    if (wantLeft) steerTarget = -1;
    if (wantRight) steerTarget = 1;
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
      clutch: this.clutch,
      steer: this.steer,
      handbrake: this.handbrake,
      gear: this.gear,
    };
  }
}
