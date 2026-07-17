/**
 * ScoringSystem - hệ thống chấm điểm bài thi sát hạch.
 * Điểm khởi đầu 100, mỗi lỗi trừ điểm theo mức quy định. Dưới 80 điểm = không đạt.
 */
const FAULT_PENALTIES = {
  line_touch: 5,      // đè vạch
  out_of_bounds: 10,  // ra ngoài
  no_signal: 5,       // không xi nhan
  stall: 5,           // chết máy
  timeout: 15,        // quá thời gian
  hit_curb: 8,        // đâm curb
  hit_pole: 10,       // đâm cọc
  hit_sign: 8,        // đâm biển báo (tương tự va chạm vật cản)
  hit_vehicle: 20,    // đâm xe
  wrong_order: 10,    // sai thứ tự bài thi
};

const FAULT_LABELS = {
  line_touch: 'Đè vạch',
  out_of_bounds: 'Ra ngoài ranh giới',
  no_signal: 'Không xi nhan',
  stall: 'Chết máy',
  timeout: 'Quá thời gian',
  hit_curb: 'Đâm curb',
  hit_pole: 'Đâm cọc tiêu',
  hit_sign: 'Đâm biển báo',
  hit_vehicle: 'Đâm xe',
  wrong_order: 'Sai thứ tự bài thi',
};

export class ScoringSystem {
  constructor(hud) {
    this.hud = hud;
    this.score = 100;
    this.faultHistory = [];
  }

  addFault(type, customMessage) {
    const penalty = FAULT_PENALTIES[type] ?? 5;
    this.score = Math.max(0, this.score - penalty);
    const label = customMessage || FAULT_LABELS[type] || 'Lỗi không xác định';
    this.faultHistory.push({ type, label, penalty, time: Date.now() });
    this.hud.logFault(`-${penalty}đ: ${label}`);
    this.hud.setScore(this.score);
  }

  isPassing() {
    return this.score >= 80;
  }

  reset() {
    this.score = 100;
    this.faultHistory = [];
    this.hud.setScore(this.score);
    this.hud.clearFaultLog();
  }
}

/**
 * HUD - quản lý toàn bộ giao diện đồng hồ táp lô, bảng điểm, thông báo trên màn hình.
 * Toàn bộ phần tử được lấy từ DOM tạo sẵn trong index.html.
 */
export class HUD {
  constructor() {
    this.el = {
      examName: document.getElementById('exam-name'),
      examInstruction: document.getElementById('exam-instruction'),
      scoreValue: document.getElementById('score-value'),
      timerValue: document.getElementById('timer-value'),
      faultLog: document.getElementById('fault-log'),
      rpmArc: document.getElementById('rpm-arc'),
      rpmValue: document.getElementById('rpm-value'),
      speedValue: document.getElementById('speed-value'),
      gearDisplay: document.getElementById('gear-display'),
      throttleBar: document.getElementById('throttle-bar'),
      brakeBar: document.getElementById('brake-bar'),
      clutchBar: document.getElementById('clutch-bar'),
      engineStatus: document.getElementById('engine-status'),
      signalLeft: document.getElementById('signal-left'),
      signalRight: document.getElementById('signal-right'),
      centerMessage: document.getElementById('center-message'),
      btnExam1: document.getElementById('btn-exam-1'),
      btnExam2: document.getElementById('btn-exam-2'),
    };
    this._blinkPhase = 0;
  }

  setExamName(name) {
    this.el.examName.textContent = name;
  }

  setInstruction(text) {
    this.el.examInstruction.textContent = text;
  }

  setActiveExamButton(key) {
    this.el.btnExam1.classList.toggle('active', key === 'vertical');
    this.el.btnExam2.classList.toggle('active', key === 'horizontal');
  }

  setScore(score) {
    this.el.scoreValue.textContent = Math.round(score);
    this.el.scoreValue.classList.remove('warn', 'fail');
    if (score < 80) this.el.scoreValue.classList.add('fail');
    else if (score < 90) this.el.scoreValue.classList.add('warn');
  }

  logFault(text) {
    const div = document.createElement('div');
    div.textContent = text;
    this.el.faultLog.prepend(div);
    while (this.el.faultLog.children.length > 6) {
      this.el.faultLog.removeChild(this.el.faultLog.lastChild);
    }
  }

  clearFaultLog() {
    this.el.faultLog.innerHTML = '';
  }

  setTimer(elapsed, limit) {
    const remain = Math.max(0, limit - elapsed);
    const m = String(Math.floor(remain / 60)).padStart(2, '0');
    const s = String(Math.floor(remain % 60)).padStart(2, '0');
    this.el.timerValue.textContent = `${m}:${s}`;
    this.el.timerValue.style.color = remain < 15 ? '#ff3b3b' : '';
  }

  /** Cập nhật toàn bộ đồng hồ táp lô mỗi khung hình dựa trên trạng thái vật lý xe */
  updateDashboard(physics, input) {
    const speedKmh = Math.abs(physics.getSpeedKmh());
    this.el.speedValue.textContent = Math.round(speedKmh);

    this.el.rpmValue.textContent = Math.round(physics.rpm);
    const ratio = Math.min(1, physics.rpm / 6500);
    const arcLength = 251;
    this.el.rpmArc.style.strokeDashoffset = String(arcLength * (1 - ratio));
    this.el.rpmArc.style.stroke = physics.rpm > 6000 ? '#ff3b3b' : '#ffb400';

    this.el.gearDisplay.textContent = physics.gear;

    this.el.throttleBar.style.width = `${Math.round(input.throttle * 100)}%`;
    this.el.brakeBar.style.width = `${Math.round(input.brake * 100)}%`;
    this.el.clutchBar.style.width = `${Math.round(input.clutch * 100)}%`;

    this.el.engineStatus.classList.remove('on', 'off', 'stall');
    if (physics.stalled) {
      this.el.engineStatus.textContent = 'CHẾT MÁY';
      this.el.engineStatus.classList.add('stall');
    } else if (physics.isRunning) {
      this.el.engineStatus.textContent = 'MÁY NỔ';
      this.el.engineStatus.classList.add('on');
    } else {
      this.el.engineStatus.textContent = 'MÁY TẮT';
      this.el.engineStatus.classList.add('off');
    }
  }

  /** Cập nhật đèn xi-nhan HUD với hiệu ứng nhấp nháy thực (dùng chung nhịp với âm thanh tích-tắc) */
  updateSignals(leftOn, rightOn, dt) {
    this._blinkPhase += dt;
    const blink = Math.floor(this._blinkPhase / 0.45) % 2 === 0;
    this.el.signalLeft.classList.toggle('on', leftOn && blink);
    this.el.signalRight.classList.toggle('on', rightOn && blink);
  }

  showCenterMessage(title, sub, type) {
    this.el.centerMessage.innerHTML = `${title}<span class="sub">${sub}</span>`;
    this.el.centerMessage.classList.remove('hidden', 'pass', 'fail');
    this.el.centerMessage.classList.add(type);
  }

  hideCenterMessage() {
    this.el.centerMessage.classList.add('hidden');
  }
}
