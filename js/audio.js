/**
 * AudioEngine - tổng hợp toàn bộ âm thanh mô phỏng bằng Web Audio API (không dùng file .mp3),
 * gồm: tiếng máy nổ biến thiên theo RPM, tiếng rú ga, tiếng nhả/đạp côn (click), tiếng phanh (rít),
 * tiếng tích tắc xi-nhan, tiếng va chạm (noise burst), và âm thanh hoàn thành bài thi.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null; // AudioContext chỉ khởi tạo sau tương tác đầu tiên của người dùng (yêu cầu trình duyệt)
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this._signalTimer = 0;
    this._started = false;
    this._lastLeft = false;
    this._lastRight = false;
  }

  /** Khởi tạo AudioContext + các node engine liên tục - gọi sau khi có tương tác người dùng (click/keydown) */
  start() {
    if (this._started) return;
    this._started = true;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Oscillator sóng vuông giả lập tiếng nổ động cơ 4 xi-lanh
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 40;

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 400;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
  }

  /** Cập nhật âm thanh máy mỗi khung hình theo RPM và trạng thái động cơ */
  updateEngine(rpm, isRunning, throttle) {
    if (!this._started) return;
    if (isRunning) {
      const freq = 30 + (rpm / 6500) * 130;
      this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
      this.engineFilter.frequency.setTargetAtTime(300 + throttle * 1800, this.ctx.currentTime, 0.08);
      this.engineGain.gain.setTargetAtTime(0.09 + throttle * 0.06, this.ctx.currentTime, 0.08);
    } else {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    }
  }

  /** Tiếng đề máy (starter motor) - âm rè ngắn trước khi máy nổ */
  playIgnition() {
    if (!this._started) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(90, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(140, this.ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.45);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  /** Tiếng rít phanh gấp - dùng buffer noise lọc dải cao */
  playBrakeScreech(intensity = 1) {
    if (!this._started) return;
    const buffer = this._createNoiseBuffer(0.35);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2200;
    filter.Q.value = 6;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18 * intensity, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.35);
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start();
  }

  /** Tiếng va chạm (cọc/curb/biển báo/xe khác) - noise burst trầm, ngắn, mạnh */
  playCollision() {
    if (!this._started) return;
    const buffer = this._createNoiseBuffer(0.25);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start();
  }

  /** Tiếng tích tắc xi-nhan, gọi mỗi khung hình - tự phát khi chuyển pha nhấp nháy */
  updateTurnSignal(active, dt) {
    if (!this._started || !active) { this._signalTimer = 0; return; }
    this._signalTimer += dt;
    if (this._signalTimer >= 0.45) {
      this._signalTimer = 0;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 1100;
      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.09);
    }
  }

  /** Chuông ngắn khi nhấn/nhả côn */
  playClutchClick() {
    if (!this._started) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 600;
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.07);
  }

  /** Giai điệu ngắn khi hoàn thành bài thi (đạt) */
  playSuccessJingle() {
    if (!this._started) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t0 = this.ctx.currentTime + i * 0.13;
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.14, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.25);
    });
  }

  /** Âm báo lỗi/không đạt - 2 nốt trầm ngắn */
  playFailBuzz() {
    if (!this._started) return;
    [220, 174.6].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const t0 = this.ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.12, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.22);
    });
  }

  _createNoiseBuffer(duration) {
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}
