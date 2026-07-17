import * as THREE from 'three';

/** Bảng tỉ số truyền các số: R, N, 1, 2, 3, 4 */
const GEAR_RATIOS = { R: -3.6, N: 0, '1': 3.9, '2': 2.3, '3': 1.5, '4': 1.05 };
const FINAL_DRIVE = 3.9;
const WHEEL_RADIUS = 0.34; // m

const IDLE_RPM = 850;
const MAX_RPM = 6200;
const REDLINE_RPM = 6500;
const STALL_RPM = 380;

const MASS = 1250; // kg
const WHEELBASE = 2.7; // m (khoảng cách trục trước - trục sau)
const MAX_STEER = THREE.MathUtils.degToRad(34); // góc đánh lái tối đa của bánh trước
const STEER_RATE = 2.6; // rad/s tốc độ đánh lái tối đa

const MAX_ENGINE_TORQUE = 175; // Nm
const ROLLING_RESISTANCE = 260; // N (ma sát lăn cơ bản)
const DRAG_COEFF = 0.55; // hệ số cản gió (bậc 2 theo vận tốc)
const BRAKE_FORCE = 8200; // N khi đạp hết phanh
const HANDBRAKE_FORCE = 9500; // N
const ENGINE_BRAKE_COEFF = 380; // hệ số thắng động cơ (engine braking) khi nhả ga, còn số

/**
 * VehiclePhysics - mô phỏng động lực học xe theo mô hình Bicycle Model
 * kết hợp mô phỏng động cơ - hộp số sàn: ly hợp (côn), chết máy, đề máy, thắng động cơ.
 * Đây KHÔNG phải mô hình arcade: lực kéo phụ thuộc vòng tua động cơ qua đường cong mô-men xoắn,
 * tỉ số truyền, độ đóng ly hợp, và xe xoay quanh trục sau theo công thức bicycle model chuẩn.
 */
export class VehiclePhysics {
  constructor(startPosition = new THREE.Vector3(0, 0, 40), startHeading = Math.PI) {
    // ----- Trạng thái động học -----
    this.position = startPosition.clone();
    this.heading = startHeading; // radian, 0 = hướng +Z
    this.speed = 0; // m/s, dương = tiến, âm = lùi
    this.steerAngle = 0; // góc bánh trước hiện tại (rad)
    this.steerInput = 0; // -1..1 từ người chơi (mục tiêu)

    // ----- Trạng thái động cơ / hộp số -----
    this.rpm = 0;
    this.isRunning = false;
    this.gear = 'N';
    this.clutchInput = 1; // 0 = nhả hết côn (ăn khớp), 1 = đạp hết côn (ngắt ly hợp)
    this.throttleInput = 0;
    this.brakeInput = 0;
    this.handbrake = false;
    this._stallTimer = 0;

    this.wheelRotation = 0; // góc lăn tích luỹ của bánh xe (dùng để animate mesh)
    this.lastDriveForce = 0;
    this.stalled = false;
  }

  /** Bật/tắt đề máy. Chỉ khởi động được khi động cơ đang tắt và côn đang đạp hoặc số N */
  toggleIgnition() {
    if (this.isRunning) {
      this.isRunning = false;
      this.rpm = 0;
    } else {
      this.isRunning = true;
      this.rpm = IDLE_RPM;
      this.stalled = false;
    }
  }

  setGear(g) {
    if (GEAR_RATIOS.hasOwnProperty(g)) this.gear = g;
  }

  /** Đường cong mô-men xoắn động cơ đơn giản hoá: đạt đỉnh quanh 3200 RPM */
  _torqueCurve(rpm) {
    const peak = 3200;
    const spread = 3200;
    const factor = Math.max(0.15, 1 - Math.abs(rpm - peak) / spread);
    return MAX_ENGINE_TORQUE * factor;
  }

  /**
   * Cập nhật vật lý mỗi khung hình.
   * @param {number} dt giây
   * @param {object} input {throttle, brake, steer, clutch, handbrake, gear}
   */
  update(dt, input) {
    dt = Math.min(dt, 0.05); // tránh bước nhảy lớn khi tab mất focus
    this.throttleInput = input.throttle;
    this.brakeInput = input.brake;
    this.steerInput = input.steer;
    this.clutchInput = input.clutch;
    this.handbrake = input.handbrake;

    // ===== 1. Cập nhật góc đánh lái (tiệm cận mục tiêu theo tốc độ đánh lái giới hạn) =====
    const targetSteer = this.steerInput * MAX_STEER;
    const steerDelta = targetSteer - this.steerAngle;
    const maxDelta = STEER_RATE * dt;
    this.steerAngle += THREE.MathUtils.clamp(steerDelta, -maxDelta, maxDelta);

    // ===== 2. Cập nhật động cơ =====
    const clutchEngagement = 1 - this.clutchInput; // 0 = ngắt hoàn toàn, 1 = ăn khớp hoàn toàn
    const gearRatio = GEAR_RATIOS[this.gear];
    const wheelAngularSpeed = this.speed / WHEEL_RADIUS; // rad/s
    const wheelDerivedRPM = Math.abs(wheelAngularSpeed * gearRatio * FINAL_DRIVE) * (60 / (2 * Math.PI));

    let driveForce = 0;

    if (this.isRunning) {
      const freeRevTarget = IDLE_RPM + this.throttleInput * (MAX_RPM - IDLE_RPM);

      if (this.gear === 'N' || clutchEngagement < 0.03) {
        // Ly hợp ngắt hoàn toàn hoặc số Mo: động cơ rú ga tự do, không truyền lực
        this.rpm = THREE.MathUtils.lerp(this.rpm, freeRevTarget, Math.min(1, dt * 5));
      } else {
        // Ly hợp ăn khớp (toàn phần hoặc bán phần): vòng tua bị "kéo" theo cả ga và tốc độ bánh xe
        const blendedTarget = THREE.MathUtils.lerp(freeRevTarget, wheelDerivedRPM, clutchEngagement);
        this.rpm = THREE.MathUtils.lerp(this.rpm, Math.max(blendedTarget, IDLE_RPM * 0.35), Math.min(1, dt * 6));

        const torque = this._torqueCurve(this.rpm) * this.throttleInput;
        driveForce = (torque * gearRatio * FINAL_DRIVE / WHEEL_RADIUS) * clutchEngagement;

        // Thắng động cơ (engine braking): khi nhả ga mà còn gài số và côn ăn khớp
        if (this.throttleInput < 0.05) {
          const engineBrake = ENGINE_BRAKE_COEFF * Math.abs(gearRatio) * clutchEngagement;
          driveForce -= Math.sign(this.speed) * engineBrake;
        }

        // ----- Kiểm tra chết máy: côn ăn khớp mạnh, gài số, tua quá thấp -----
        const nearlyStopped = Math.abs(this.speed) < 0.6;
        const lowRPM = this.rpm < STALL_RPM + 150;
        if (clutchEngagement > 0.6 && nearlyStopped && lowRPM && this.throttleInput < 0.25) {
          this._stallTimer += dt;
          if (this._stallTimer > 0.35) {
            this.isRunning = false;
            this.rpm = 0;
            this.stalled = true;
            driveForce = 0;
          }
        } else {
          this._stallTimer = 0;
        }
      }
      this.rpm = THREE.MathUtils.clamp(this.rpm, 0, REDLINE_RPM);
    } else {
      this.rpm = THREE.MathUtils.lerp(this.rpm, 0, Math.min(1, dt * 4));
    }

    this.lastDriveForce = driveForce;

    // ===== 3. Lực cản: ma sát lăn + cản gió (bậc 2) =====
    const rollingResistance = ROLLING_RESISTANCE * Math.sign(this.speed);
    const dragForce = DRAG_COEFF * this.speed * Math.abs(this.speed);
    let resistiveForce = rollingResistance + dragForce;

    // ===== 4. Lực phanh =====
    let brakeForce = 0;
    if (this.brakeInput > 0.01) {
      brakeForce = BRAKE_FORCE * this.brakeInput * Math.sign(this.speed);
    }
    if (this.handbrake) {
      brakeForce += HANDBRAKE_FORCE * Math.sign(this.speed);
    }

    // ===== 5. Tổng hợp lực -> gia tốc (F = m.a) =====
    let netForce = driveForce - resistiveForce - brakeForce;

    // Nếu xe gần như đứng yên và không có lực kéo đáng kể, chặn trôi số thập phân (numeric drift)
    if (Math.abs(this.speed) < 0.03 && Math.abs(driveForce) < 50) {
      netForce = 0;
      this.speed = 0;
    }

    const accel = netForce / MASS;
    this.speed += accel * dt;

    // Không cho phanh/lực cản làm xe chạy giật lùi ngoài ý muốn khi gần như đã dừng
    if (Math.abs(this.speed) < 0.02) this.speed = 0;

    // ===== 6. Bicycle Model: cập nhật hướng và vị trí theo trục sau =====
    let headingRate = 0;
    if (Math.abs(this.steerAngle) > 0.0005) {
      headingRate = (this.speed / WHEELBASE) * Math.tan(this.steerAngle);
    }
    this.heading += headingRate * dt;
    this.position.x += this.speed * Math.sin(this.heading) * dt;
    this.position.z += this.speed * Math.cos(this.heading) * dt;

    // Góc lăn bánh xe tích luỹ (dùng để animate quay bánh)
    this.wheelRotation += (this.speed / WHEEL_RADIUS) * dt;
  }

  /** Bán kính quay vòng hiện tại (m). Infinity khi đi thẳng */
  getTurningRadius() {
    if (Math.abs(this.steerAngle) < 0.001) return Infinity;
    return WHEELBASE / Math.tan(Math.abs(this.steerAngle));
  }

  getSpeedKmh() {
    return this.speed * 3.6;
  }
}

export { GEAR_RATIOS, WHEEL_RADIUS, WHEELBASE };
