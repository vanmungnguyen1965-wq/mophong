import * as THREE from 'three';

/**
 * Tạo và cấu hình THREE.Scene dùng chung cho toàn ứng dụng.
 * Bao gồm màu nền bầu trời và hiệu ứng sương mù (fog) để tăng chiều sâu không gian.
 */
export function createScene() {
  const scene = new THREE.Scene();

  // Bầu trời gradient đơn giản bằng màu nền + fog cùng tông
  const skyColor = new THREE.Color(0x9fc8e8);
  scene.background = skyColor;

  // Sương mù tuyến tính giúp giảm hiện tượng "pop-in" ở xa và tạo chiều sâu
  scene.fog = new THREE.Fog(skyColor, 80, 420);

  return scene;
}
