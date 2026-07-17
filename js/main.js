import * as THREE from 'three';
import { createScene } from './scene.js';
import { RendererManager } from './renderer.js';
import { CameraRig } from './camera.js';
import { setupLights } from './lights.js';
import { EnvironmentBuilder } from './environment.js';
import { Vehicle } from './vehicle.js';
import { VehiclePhysics } from './physics.js';
import { InputController } from './controls.js';
import { CollisionSystem } from './collision.js';
import { ExamManager } from './parking.js';
import { HUD, ScoringSystem } from './hud.js';
import { MinimapManager } from './minimap.js';
import { AudioEngine } from './audio.js';
import { EffectsManager } from './effects.js';

/**
 * Application - lớp điều phối trung tâm, khởi tạo toàn bộ module và chạy vòng lặp mô phỏng.
 * Không dùng biến toàn cục: mọi trạng thái được đóng gói trong instance của lớp này.
 */
class Application {
  constructor() {
    this.clock = new THREE.Clock();
    this._prevSpeedAbs = 0;
    this._noSignalTimer = 0;

    this._initLoadingScreen();
    this._initCore();
    this._initWorld();
    this._initSystems();
    this._bindUI();

    this._finishLoading();
    this.clock.start();
    requestAnimationFrame((t) => this._loop(t));
  }

  _initLoadingScreen() {
    this.loadingScreen = document.getElementById('loading-screen');
    this.loadingBar = document.getElementById('loading-bar-fill');
    this.loadingPercent = document.getElementById('loading-percent');
    let p = 0;
    this._loadingInterval = setInterval(() => {
      p = Math.min(96, p + Math.random() * 18);
      this.loadingBar.style.width = `${p}%`;
      this.loadingPercent.textContent = `${Math.round(p)}%`;
    }, 120);
  }

  _finishLoading() {
    clearInterval(this._loadingInterval);
    this.loadingBar.style.width = '100%';
    this.loadingPercent.textContent = '100%';
    setTimeout(() => {
      this.loadingScreen.style.opacity = '0';
      setTimeout(() => (this.loadingScreen.style.display = 'none'), 650);
    }, 250);
  }

  /** Renderer, Scene, Camera, Lights */
  _initCore() {
    this.canvas = document.getElementById('main-canvas');
    this.scene = createScene();
    this.rendererManager = new RendererManager(this.canvas);
    this.cameraRig = new CameraRig(this.canvas, window.innerWidth / window.innerHeight);
    this.lights = setupLights(this.scene);

    this.effects = new EffectsManager(
      this.rendererManager.renderer, this.scene, this.cameraRig.camera,
      window.innerWidth, window.innerHeight
    );

    this.rendererManager.setResizeCallback((w, h) => {
      this.cameraRig.setAspect(w / h);
      this.effects.setSize(w, h);
    });
  }

  /** Sân sát hạch + xe */
  _initWorld() {
    this.environment = new EnvironmentBuilder(this.scene);
    this.vehicle = new Vehicle(this.scene);
    this.vehicle.tryLoadGLTF(); // sẽ tự fallback nếu không tìm thấy model thật
    this.physics = new VehiclePhysics(new THREE.Vector3(0, 0, 55), Math.PI);
  }

  /** Điều khiển, va chạm, bài thi, điểm số, HUD, minimap, âm thanh */
  _initSystems() {
    this.input = new InputController();
    this.collision = new CollisionSystem(this.environment);
    this.hud = new HUD();
    this.scoring = new ScoringSystem(this.hud);
    this.exam = new ExamManager(this.environment, this.collision, this.scoring, this.hud);
    this.minimap = new MinimapManager(document.getElementById('minimap-canvas'), this.environment);
    this.audio = new AudioEngine();

    // AudioContext của trình duyệt chỉ được phép khởi tạo sau tương tác đầu tiên của người dùng
    const startAudioOnce = () => { this.audio.start(); window.removeEventListener('keydown', startAudioOnce); window.removeEventListener('click', startAudioOnce); };
    window.addEventListener('keydown', startAudioOnce);
    window.addEventListener('click', startAudioOnce);
  }

  _bindUI() {
    document.getElementById('btn-exam-1').addEventListener('click', () => {
      this.exam.startExam('vertical');
      this.hud.setActiveExamButton('vertical');
      this._resetVehicleToStart('vertical');
    });
    document.getElementById('btn-exam-2').addEventListener('click', () => {
      this.exam.startExam('horizontal');
      this.hud.setActiveExamButton('horizontal');
      this._resetVehicleToStart('horizontal');
    });
  }

  /** Đưa xe về điểm xuất phát phù hợp với bài thi được chọn */
  _resetVehicleToStart(examKey) {
    const bay = this.environment.getBay(examKey);
    this.physics.position.copy(bay.approachPoint);
    this.physics.heading = examKey === 'vertical' ? 0 : Math.PI / 2;
    this.physics.speed = 0;
    this.physics.rpm = 0;
    this.physics.isRunning = false;
    this.physics.stalled = false;
    this.physics.gear = 'N';
  }

  _loop(timeMs) {
    requestAnimationFrame((t) => this._loop(t));
    const dt = Math.min(this.clock.getDelta(), 0.06);
    const now = timeMs / 1000;

    this._update(dt, now);
    this._render(dt);
  }

  _update(dt, now) {
    // ----- Input -----
    this.input.update(dt);
    if (this.input.consumeIgnitionEvent()) {
      this.physics.toggleIgnition();
      if (this.physics.isRunning) this.audio.playIgnition();
    }
    const inputState = this.input.getInputState();

    // ----- Vật lý xe (bicycle model + động cơ) -----
    const wasRunning = this.physics.isRunning;
    const wasStalled = this.physics.stalled;
    this.physics.setGear(inputState.gear);
    this.physics.update(dt, inputState);

    if (!wasStalled && this.physics.stalled) {
      this.scoring.addFault('stall', 'Xe bị chết máy');
    }

    // ----- Đồng bộ Object3D xe theo vật lý -----
    const obj = this.vehicle.getObject3D();
    obj.position.set(this.physics.position.x, 0, this.physics.position.z);
    obj.rotation.y = this.physics.heading;

    // ----- Animate bánh xe + vô lăng -----
    const wheelDelta = (this.physics.speed / 0.34) * dt;
    this.vehicle.updateWheelAnimation(wheelDelta, this.physics.steerAngle);
    this.vehicle.setBrakeLight(inputState.brake > 0.05 || inputState.handbrake);
    this.vehicle.setTurnSignal('left', this.input.turnSignalLeft);
    this.vehicle.setTurnSignal('right', this.input.turnSignalRight);

    // ----- Phanh gấp: phát tiếng rít nếu giảm tốc đột ngột -----
    const speedAbs = Math.abs(this.physics.speed);
    if (this._prevSpeedAbs - speedAbs > 3.2 * dt && inputState.brake > 0.5) {
      this.audio.playBrakeScreech(inputState.brake);
    }
    this._prevSpeedAbs = speedAbs;

    // ----- Va chạm -----
    const events = this.collision.checkCollisions(obj, now);
    events.forEach((ev) => {
      this.scoring.addFault(ev.type, ev.message);
      this.audio.playCollision();
    });

    // ----- Bài thi -----
    this.exam.update(dt, obj, this.physics, now);

    // ----- Kiểm tra lỗi "không xi nhan" khi đang đánh lái mạnh trong lúc thi -----
    if (this.exam.currentExam && !this.exam.finished) {
      const turning = Math.abs(inputState.steer) > 0.5 && speedAbs > 0.3;
      const signaling = this.input.turnSignalLeft || this.input.turnSignalRight;
      if (turning && !signaling) {
        this._noSignalTimer += dt;
        if (this._noSignalTimer > 1.0) {
          this._noSignalTimer = -3.0; // cooldown ~3s sau khi đã trừ điểm 1 lần
          this.scoring.addFault('no_signal', 'Đánh lái không bật xi nhan');
        }
      } else if (this._noSignalTimer < 0) {
        this._noSignalTimer += dt;
      } else {
        this._noSignalTimer = 0;
      }
    }

    // ----- Nếu điểm dưới 80 khi đang thi -> báo không đạt ngay -----
    if (this.exam.currentExam && !this.exam.finished && !this.scoring.isPassing()) {
      this.exam.finished = true;
      this.hud.showCenterMessage('KHÔNG ĐẠT', `Điểm còn lại ${this.scoring.score} (dưới 80)`, 'fail');
      this.audio.playFailBuzz();
      setTimeout(() => this.hud.hideCenterMessage(), 3500);
    }

    // ----- HUD -----
    this.hud.updateDashboard(this.physics, inputState);
    this.hud.updateSignals(this.input.turnSignalLeft, this.input.turnSignalRight, dt);

    // ----- Camera -----
    this.cameraRig.update(obj.position, this.physics.heading, dt);

    // ----- Minimap -----
    this.minimap.update(obj.position, this.physics.heading);

    // ----- Âm thanh động cơ + xi nhan -----
    this.audio.updateEngine(this.physics.rpm, this.physics.isRunning, inputState.throttle);
    this.audio.updateTurnSignal(this.input.turnSignalLeft || this.input.turnSignalRight, dt);
  }

  _render(dt) {
    this.effects.render(dt);
    this.minimap.render();
  }
}

// Khởi động ứng dụng khi DOM sẵn sàng
window.addEventListener('DOMContentLoaded', () => new Application());
