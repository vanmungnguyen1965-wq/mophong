import * as THREE from 'three';

const TIME_LIMIT = 90; // giây cho mỗi bài thi
const STOP_SPEED_THRESHOLD = 0.05; // m/s coi như đã dừng hẳn
const HEADING_TOLERANCE = THREE.MathUtils.degToRad(8); // sai số hướng cho phép khi đỗ xong

/**
 * ExamManager điều phối 2 bài thi sát hạch: Ghép xe dọc và Ghép xe ngang.
 * Theo dõi thời gian, kiểm tra điều kiện đạt (toàn bộ xe trong chuồng, đúng hướng, dừng hẳn),
 * phát hiện quá thời gian và làm bài sai thứ tự.
 */
export class ExamManager {
  constructor(environment, collisionSystem, scoring, hud) {
    this.environment = environment;
    this.collision = collisionSystem;
    this.scoring = scoring;
    this.hud = hud;

    this.currentExam = null; // 'vertical' | 'horizontal' | null
    this.completedExams = new Set();
    this.elapsedTime = 0;
    this.finished = false;
    this.stoppedInsideTimer = 0;
  }

  startExam(examKey) {
    if (this.currentExam === examKey) return;

    // Kiểm tra làm sai thứ tự: bài 2 phải làm sau khi đã hoàn thành (hoặc ít nhất bắt đầu) bài 1
    if (examKey === 'horizontal' && !this.completedExams.has('vertical')) {
      this.scoring.addFault('wrong_order', 'Làm bài Ghép ngang trước khi hoàn thành bài Ghép dọc');
    }

    this.currentExam = examKey;
    this.elapsedTime = 0;
    this.finished = false;
    this.stoppedInsideTimer = 0;

    const bay = this.environment.getBay(examKey);
    this.hud.setExamName(bay.name);
    this.hud.setInstruction(
      examKey === 'vertical'
        ? 'Tiến qua vạch dừng, lùi thẳng xe vào chuồng dọc, giữ xe thẳng hàng giữa 2 cọc.'
        : 'Tiến ngang qua chuồng, đánh lái lùi vuông góc vào chuồng ngang.'
    );
  }

  /** Gọi mỗi khung hình khi có bài thi đang diễn ra */
  update(dt, vehicleObject3D, physics, now) {
    if (!this.currentExam || this.finished) return;

    this.elapsedTime += dt;
    this.hud.setTimer(this.elapsedTime, TIME_LIMIT);

    // ----- Quá thời gian -----
    if (this.elapsedTime > TIME_LIMIT) {
      this.scoring.addFault('timeout', `Quá thời gian quy định cho bài ${this._examLabel()}`);
      this._finishExam(false, 'Quá thời gian làm bài');
      return;
    }

    // ----- Đè vạch chuồng -----
    const bay = this.environment.getBay(this.currentExam);
    const lineEvent = this.collision.checkLineTouch(vehicleObject3D, bay, now);
    if (lineEvent) this.scoring.addFault('line_touch', lineEvent.message);

    // ----- Kiểm tra điều kiện đạt: toàn bộ xe trong chuồng + đúng hướng + dừng hẳn -----
    const corners = this.collision.getVehicleCorners(vehicleObject3D);
    const allInside = corners.every((c) => this.collision.pointInBay(c, bay));

    let headingDiff = Math.abs(this._normalizeAngle(vehicleObject3D.rotation.y - bay.heading));
    if (headingDiff > Math.PI) headingDiff = 2 * Math.PI - headingDiff;
    // Chấp nhận cả trường hợp xe quay đầu 180 độ ngược chiều chuồng (do quy ước heading khác nhau) -> lấy khoảng cách góc nhỏ nhất tới 0 hoặc PI tuỳ bài
    const headingOk = headingDiff < HEADING_TOLERANCE || Math.abs(headingDiff - Math.PI) < HEADING_TOLERANCE;

    const stopped = Math.abs(physics.speed) < STOP_SPEED_THRESHOLD;

    if (allInside && headingOk && stopped) {
      this.stoppedInsideTimer += dt;
      if (this.stoppedInsideTimer > 1.2) {
        this._finishExam(true, 'Ghép xe thành công');
      }
    } else {
      this.stoppedInsideTimer = 0;
    }
  }

  _finishExam(success, message) {
    this.finished = true;
    if (success) this.completedExams.add(this.currentExam);
    this.hud.showCenterMessage(
      success ? `HOÀN THÀNH ${this._examLabel().toUpperCase()}` : `KHÔNG ĐẠT - ${message}`,
      success ? `Điểm hiện tại: ${this.scoring.score}` : message,
      success ? 'pass' : 'fail'
    );
    setTimeout(() => this.hud.hideCenterMessage(), 3500);
  }

  _examLabel() {
    return this.currentExam === 'vertical' ? 'Ghép xe dọc' : 'Ghép xe ngang';
  }

  _normalizeAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }
}
