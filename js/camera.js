import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * CameraRig quản lý camera chính kiểu "flycam" luôn bám theo xe với góc nghiêng ~45°.
 * OrbitControls được gắn để người dùng có thể zoom / xoay / pan quanh xe,
 * trong khi target của OrbitControls được cập nhật liên tục theo vị trí xe (chase-cam).
 */
export class CameraRig {
  constructor(canvas, aspect) {
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 1000);

    // Offset ban đầu: phía sau xe, chếch lên trên ~45 độ
    this.followOffset = new THREE.Vector3(0, 7, -11);
    this.camera.position.set(0, 7, -11);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 40;
    this.controls.maxPolarAngle = Math.PI * 0.49; // không cho lật xuống dưới mặt đất
    this.controls.target.set(0, 1, 0);

    // Trạng thái: có đang bị người dùng thao tác thủ công (drag) hay không
    this._userInteracting = false;
    this.controls.addEventListener('start', () => { this._userInteracting = true; });
    this.controls.addEventListener('end', () => {
      // Sau khi thả chuột, đợi 2 giây rồi cho phép camera tự bám xe lại
      setTimeout(() => { this._userInteracting = false; }, 2000);
    });

    // Vector offset tương đối được người dùng điều chỉnh qua orbit, giữ nguyên khi xe di chuyển
    this._relativeOffset = this.camera.position.clone().sub(this.controls.target);
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Cập nhật camera mỗi khung hình: target luôn theo vị trí xe,
   * còn offset (khoảng cách/góc) do người dùng orbit quyết định, hoặc mặc định follow phía sau xe.
   */
  update(vehiclePosition, vehicleHeading, dt) {
    const desiredTarget = new THREE.Vector3(vehiclePosition.x, vehiclePosition.y + 1.0, vehiclePosition.z);

    if (!this._userInteracting) {
      // Chase-cam mặc định: vị trí camera nằm phía sau xe theo hướng heading, chếch 45 độ lên cao
      const behind = new THREE.Vector3(Math.sin(vehicleHeading), 0, Math.cos(vehicleHeading)).multiplyScalar(-11);
      const desiredPos = new THREE.Vector3(vehiclePosition.x + behind.x, vehiclePosition.y + 7, vehiclePosition.z + behind.z);
      this.camera.position.lerp(desiredPos, Math.min(1, dt * 2.2));
    }

    this.controls.target.lerp(desiredTarget, Math.min(1, dt * 4));
    this.controls.update();
  }
}
