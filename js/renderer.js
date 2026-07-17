import * as THREE from 'three';

/**
 * Khởi tạo và quản lý WebGLRenderer chính của ứng dụng.
 * Bật shadow map mềm (PCFSoftShadowMap), tone mapping điện ảnh (ACESFilmic)
 * và tự động responsive theo kích thước cửa sổ / thiết bị.
 */
export class RendererManager {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });

    // Giới hạn pixel ratio để tối ưu hiệu năng trên màn hình retina/mobile
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);

    // Shadow mềm PCF
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Tone mapping điện ảnh + exposure cho ánh sáng HDR
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.onResizeCallback) this.onResizeCallback(w, h);
  }

  setResizeCallback(cb) {
    this.onResizeCallback = cb;
  }

  getDomElement() {
    return this.renderer.domElement;
  }
}
