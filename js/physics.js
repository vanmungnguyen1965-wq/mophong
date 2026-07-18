import * as THREE from 'three';

/** Bảng tỉ số truyền các số: R, N, 1, 2, 3, 4 */
const GEAR_RATIOS = { R: -3.6, N: 0, '1': 3.9, '2': 2.3, '3': 1.5, '4': 1.05 };
const FINAL_DRIVE = 3.9;
const WHEEL_RADIUS = 0.34; // m

const IDLE_RPM = 850;
const MAX_RPM = 6200;
const REDLINE_RPM = 6500;

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

/** Giới hạn tốc độ tối đa cho từng số (km/h) - buộc người thi phải sang số đúng lúc.
 *  Số 1: dưới 20 km/h | Số 2: dưới 30 km/h | Số 3: dưới 40 km/h | Số 4: từ 40 km/h trở lên (không giới hạn). */
const GEAR_MAX_SPEED_KMH = { '1': 20, '2': 30, '3': 40, '4': Infinity };

/**
 * VehiclePhysics - mô phỏng động lực học xe theo mô hình Bicycle Model
 * kết hợp mô phỏng động cơ - hộp số KHÔNG CÔN (ly hợp luôn coi như ăn khớp hoàn toàn,
 * giống hộp số tự động hoá ly hợp / AMT): không có bàn đạp côn, không chết máy do côn.
 * Lực kéo phụ thuộc vòng tua động cơ qua đường cong mô-men xoắn, tỉ số truyền và tốc độ
 * bánh xe; xe xoay quanh trục sau theo công thức bicycle model chuẩn.
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
    this.throttleInput = 0;
    this.brakeInput = 0;
    this.handbrake = false;

    this.wheelRotation = 0; // góc lăn tích luỹ của bánh xe (dùng để animate mesh)
    this.lastDriveForce = 0;
    this.stalled = false; // giữ lại field để tương thích HUD, không còn cơ chế chết máy do côn
  }

  /** Bật/tắt đề máy. */
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
   * @param {object} input {throttle, brake, steer, handbrake, gear}
   */
  update(dt, input) {
    dt = Math.min(dt, 0.05); // tránh bước nhảy lớn khi tab mất focus
    this.throttleInput = input.throttle;
    this.brakeInput = input.brake;
    this.steerInput = input.steer;
    this.handbrake = input.handbrake;

    // ===== 1. Cập nhật góc đánh lái (tiệm cận mục tiêu theo tốc độ đánh lái giới hạn) =====
    const targetSteer = this.steerInput * MAX_STEER;
    const steerDelta = targetSteer - this.steerAngle;
    const maxDelta = STEER_RATE * dt;
    this.steerAngle += THREE.MathUtils.clamp(steerDelta, -maxDelta, maxDelta);

    // ===== 2. Cập nhật động cơ (không côn: coi như ly hợp luôn ăn khớp 100% khi có số) =====
    const gearRatio = GEAR_RATIOS[this.gear];
    const wheelAngularSpeed = this.speed / WHEEL_RADIUS; // rad/s
    const wheelDerivedRPM = Math.abs(wheelAngularSpeed * gearRatio * FINAL_DRIVE) * (60 / (2 * Math.PI));

    let driveForce = 0;

    if (this.isRunning) {
      const freeRevTarget = IDLE_RPM + this.throttleInput * (MAX_RPM - IDLE_RPM);

      if (this.gear === 'N') {
        // Số Mo: động cơ rú ga tự do, không truyền lực
        this.rpm = THREE.MathUtils.lerp(this.rpm, freeRevTarget, Math.min(1, dt * 5));
      } else {
        // Có số: vòng tua bám theo tốc độ bánh xe (giống ly hợp luôn ăn khớp hoàn toàn),
        // nhưng khi xe gần như đứng yên vẫn cho phép rú ga tự do lên đến mức tua theo ga
        // để việc khởi hành mượt mà (giống cách hộp số ly hợp kép/AMT xử lý điểm cắn côn).
        const targetRPM = Math.max(wheelDerivedRPM, IDLE_RPM);
        const blended = Math.max(targetRPM, Math.min(freeRevTarget, targetRPM + 1200));
        this.rpm = THREE.MathUtils.lerp(this.rpm, blended, Math.min(1, dt * 6));

        const torque = this._torqueCurve(this.rpm) * this.throttleInput;
        driveForce = torque * gearRatio * FINAL_DRIVE / WHEEL_RADIUS;

        // Thắng động cơ (engine braking): khi nhả ga mà còn gài số
        if (this.throttleInput < 0.05) {
          const engineBrake = ENGINE_BRAKE_COEFF * Math.abs(gearRatio);
          driveForce -= Math.sign(this.speed) * engineBrake;
        }

        // ----- Giới hạn tốc độ theo số (governor): số 1/2/3 không thể vượt trần tốc độ
        // quy định, buộc người thi phải lên số cao hơn. Chỉ chặn lực kéo THÊM (vẫn
        // giảm tốc bình thường khi phanh/nhả ga), không giới hạn khi lùi (số R). -----
        const gearCapKmh = GEAR_MAX_SPEED_KMH[this.gear];
        if (gearCapKmh !== undefined && Number.isFinite(gearCapKmh)) {
          const gearCapMs = gearCapKmh / 3.6;
          if (this.speed >= gearCapMs && driveForce > 0) {
            driveForce = 0;
          }
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

    // Chốt an toàn: không để tốc độ vượt trần cho phép của số hiện tại (tránh vọt lố do dt lớn)
    const capKmhSafety = GEAR_MAX_SPEED_KMH[this.gear];
    if (capKmhSafety !== undefined && Number.isFinite(capKmhSafety)) {
      const capMsSafety = capKmhSafety / 3.6;
      if (this.speed > capMsSafety) this.speed = capMsSafety;
    }

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
