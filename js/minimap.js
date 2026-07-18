import * as THREE from 'three';

/**
 * MinimapManager render một scene thu nhỏ độc lập bằng WebGL (camera trực giao nhìn từ trên xuống)
 * lên canvas riêng (#minimap-canvas). Không dùng Canvas 2D để vẽ - toàn bộ là mesh Three.js.
 * Hiển thị: nền sân, 2 chuồng ghép xe, và một mũi tên đại diện xe luôn xoay theo hướng thực tế.
 */
export class MinimapManager {
  constructor(canvas, environment) {
    this.canvas = canvas;
    this.environment = environment;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1512);

    const viewSize = 90; // phạm vi hiển thị (mét) quanh tâm sân
    this.camera = new THREE.OrthographicCamera(-viewSize, viewSize, viewSize, -viewSize, 0.1, 200);
    this.camera.position.set(0, 100, 0);
    this.camera.lookAt(0, 0, 0);
    this.camera.up.set(0, 0, -1); // để "hướng lên trên" của minimap khớp với trục -Z của sân

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const light = new THREE.AmbientLight(0xffffff, 1.4);
    this.scene.add(light);

    this._buildStaticLayer();
    this._buildCarArrow();

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const size = this.canvas.clientWidth || 240;
    this.renderer.setSize(size, size, false);
  }

  /** Vẽ nền sân + 2 chuồng ghép xe dưới dạng mặt phẳng màu đơn giản */
  _buildStaticLayer() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(96, 140),
      new THREE.MeshBasicMaterial({ color: 0x2c3a34 })
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    const bayMat = new THREE.MeshBasicMaterial({ color: 0x00e6c8 });
    Object.values(this.environment.bays).forEach((bay) => {
      const geo = new THREE.PlaneGeometry(bay.width, bay.length);
      geo.rotateX(-Math.PI / 2); // bake phẳng xuống mặt đất
      const marker = new THREE.Mesh(geo, bayMat.clone());
      marker.rotation.y = -bay.heading; // xoay theo hướng chuồng quanh trục thẳng đứng
      marker.position.set(bay.center.x, 0.5, bay.center.z);
      this.scene.add(marker);
    });
  }

  /** Mũi tên đại diện xe (hình tam giác) để thấy rõ hướng đầu xe đang quay về đâu */
  _buildCarArrow() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 1.6);
    shape.lineTo(-0.9, -1.2);
    shape.lineTo(0.9, -1.2);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    // Bake sẵn phép xoay nằm ngang vào chính geometry, để rotation.y của object
    // chỉ còn dùng riêng cho việc biểu diễn hướng xe (heading), tránh chồng phép quay gây sai lệch.
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffb400 });
    this.carArrow = new THREE.Mesh(geo, mat);
    this.carArrow.position.y = 1;
    this.carArrow.scale.set(2.4, 2.4, 2.4);
    this.scene.add(this.carArrow);
  }

  update(vehiclePosition, vehicleHeading) {
    this.carArrow.position.x = vehiclePosition.x;
    this.carArrow.position.z = vehiclePosition.z;
    // Heading của xe (0 = hướng +Z) tương ứng phép xoay quanh trục Y thế giới
    this.carArrow.rotation.y = vehicleHeading;

    // Camera minimap luôn theo tâm là xe để không bị mất dấu khi xe đi xa
    this.camera.position.x = vehiclePosition.x;
    this.camera.position.z = vehiclePosition.z;
    this.camera.lookAt(vehiclePosition.x, 0, vehiclePosition.z);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
