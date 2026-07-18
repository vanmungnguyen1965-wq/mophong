import * as THREE from 'three';

/**
 * Thiết lập hệ thống ánh sáng cho sân sát hạch:
 * - DirectionalLight: giả lập ánh nắng mặt trời, đổ bóng chính
 * - AmbientLight: ánh sáng môi trường nền, tránh vùng tối tuyệt đối
 * - HemisphereLight: mô phỏng ánh sáng bầu trời/mặt đất (HDR lighting đơn giản)
 */
export function setupLights(scene) {
  const group = new THREE.Group();
  group.name = 'Lights';

  // Ánh nắng mặt trời chính - nguồn đổ bóng
  const sun = new THREE.DirectionalLight(0xfff2df, 2.4);
  sun.position.set(60, 90, -40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 260;
  sun.shadow.camera.left = -110;
  sun.shadow.camera.right = 110;
  sun.shadow.camera.top = 110;
  sun.shadow.camera.bottom = -110;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  group.add(sun);
  group.add(sun.target);

  // Ánh sáng môi trường dịu, tránh bóng đen 100%
  const ambient = new THREE.AmbientLight(0xcfe4ff, 0.35);
  group.add(ambient);

  // Ánh sáng bán cầu: trời xanh phía trên, đất nâu phía dưới - xấp xỉ HDR lighting
  const hemi = new THREE.HemisphereLight(0xaed4ff, 0x4c4536, 0.6);
  group.add(hemi);

  scene.add(group);

  return { sun, ambient, hemi };
}
