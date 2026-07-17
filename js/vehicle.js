import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TextureFactory } from './textures.js';

/**
 * Vehicle - đại diện xe sedan 3D.
 * GLTFLoader được chuẩn bị sẵn: nếu tồn tại file model thật tại assets/models/sedan.glb
 * thì sẽ tự nạp; nếu không (mặc định trong bản demo này) xe được dựng bằng geometry
 * thủ tục (procedural) với đầy đủ bánh xe quay, vô lăng quay, gương, kính, đèn, biển số.
 */
export class Vehicle {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'Vehicle';

    // Tham chiếu các bộ phận cần animate
    this.wheels = { fl: null, fr: null, rl: null, rr: null };
    this.steeringWheelMesh = null;
    this.headlights = [];
    this.turnSignalMeshes = { left: null, right: null };
    this.brakeLightMesh = null;

    this._loader = new GLTFLoader();
    this._buildProcedural();

    scene.add(this.group);
  }

  /** Cố gắng nạp model GLTF thật; nếu lỗi (không có file) sẽ giữ nguyên xe procedural đã dựng sẵn */
  tryLoadGLTF(url = 'assets/models/sedan.glb') {
    this._loader.load(
      url,
      (gltf) => {
        this.group.clear();
        this.group.add(gltf.scene);
        gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      },
      undefined,
      () => { /* Không có model thật -> tiếp tục dùng xe procedural, không báo lỗi cho người dùng */ }
    );
  }

  _buildProcedural() {
    const bodyColor = 0xc11f2c;
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: bodyColor, metalness: 0.55, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.15,
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.3 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0e2230, transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.1, transmission: 0.5,
    });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.15 });

    // ===== Thân xe (dưới + cabin) =====
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.4), bodyMat);
    lowerBody.position.y = 0.55;
    lowerBody.castShadow = true; lowerBody.receiveShadow = true;
    this.group.add(lowerBody);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.3), bodyMat);
    cabin.position.set(0, 1.08, -0.15);
    cabin.castShadow = true; cabin.receiveShadow = true;
    this.group.add(cabin);

    // Vát góc cabin đơn giản bằng cách thêm khối chắn gió nghiêng (kính chắn gió)
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.06), glassMat);
    windshield.position.set(0, 1.08, 0.98);
    windshield.rotation.x = -0.35;
    windshield.castShadow = false;
    this.group.add(windshield);

    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.06), glassMat);
    rearGlass.position.set(0, 1.06, -1.28);
    rearGlass.rotation.x = 0.4;
    this.group.add(rearGlass);

    // Kính hông 2 bên
    [1, -1].forEach((side) => {
      const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 1.9), glassMat);
      sideGlass.position.set(side * 0.86, 1.08, -0.15);
      this.group.add(sideGlass);
    });

    // ===== Cản trước / sau =====
    const bumperFront = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.3, 0.25), darkMat);
    bumperFront.position.set(0, 0.32, 2.2);
    bumperFront.castShadow = true;
    this.group.add(bumperFront);

    const bumperRear = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.3, 0.25), darkMat);
    bumperRear.position.set(0, 0.32, -2.2);
    bumperRear.castShadow = true;
    this.group.add(bumperRear);

    // ===== Đèn pha (headlights) - hình cầu emissive =====
    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffcc, emissiveIntensity: 1.4 });
    [0.65, -0.65].forEach((x) => {
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), headlightMat);
      hl.position.set(x, 0.55, 2.28);
      this.group.add(hl);
      this.headlights.push(hl);

      // Đèn spotlight thật để chiếu sáng phía trước xe vào ban đêm / hiệu ứng
      const spot = new THREE.SpotLight(0xfff2cc, 3, 25, Math.PI / 7, 0.4, 1.2);
      spot.position.set(x, 0.55, 2.3);
      spot.target.position.set(x, 0, 12);
      spot.castShadow = false;
      this.group.add(spot);
      this.group.add(spot.target);
    });

    // Đèn hậu (brake light) màu đỏ
    const brakeLightMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff0000, emissiveIntensity: 0.15 });
    const brakeLight = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.05), brakeLightMat);
    brakeLight.position.set(0, 0.62, -2.32);
    this.group.add(brakeLight);
    this.brakeLightMesh = brakeLightMat;

    // Đèn xi-nhan trái/phải (nhấp nháy màu cam)
    const signalMat = (x) => new THREE.MeshStandardMaterial({ color: 0x552200, emissive: 0xff9900, emissiveIntensity: 0.1 });
    const sigL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.05), signalMat());
    sigL.position.set(0.85, 0.55, 2.25);
    this.group.add(sigL);
    this.turnSignalMeshes.left = sigL.material;

    const sigR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.05), signalMat());
    sigR.position.set(-0.85, 0.55, 2.25);
    this.group.add(sigR);
    this.turnSignalMeshes.right = sigR.material;

    // ===== Biển số (license plate) - texture chữ vẽ động =====
    const plateTex = TextureFactory.createLabelTexture('51K-999.99', {
      bg: '#ffffff', color: '#111111', font: 'bold 90px Arial', w: 512, h: 200,
    });
    const plateMat = new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.4 });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), plateMat);
    plate.position.set(0, 0.32, 2.33);
    this.group.add(plate);

    // ===== Gương chiếu hậu (mirrors) =====
    [1, -1].forEach((side) => {
      const mirrorArm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.2), darkMat);
      mirrorArm.position.set(side * 0.95, 1.02, 0.9);
      this.group.add(mirrorArm);
      const mirrorHead = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.26), darkMat);
      mirrorHead.position.set(side * 1.05, 1.02, 0.9);
      mirrorHead.castShadow = true;
      this.group.add(mirrorHead);
      const mirrorGlass = new THREE.Mesh(
        new THREE.PlaneGeometry(0.12, 0.22),
        new THREE.MeshPhysicalMaterial({ color: 0xaaccdd, metalness: 1, roughness: 0.05 })
      );
      mirrorGlass.position.set(side * (1.05 + side * 0.031), 1.02, 0.9);
      mirrorGlass.rotation.y = Math.PI / 2;
      this.group.add(mirrorGlass);
    });

    // ===== Bánh xe (4 bánh, có trục xoay riêng để animate lăn + đánh lái) =====
    const wheelTex = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.85 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.8, roughness: 0.25 });

    const buildWheel = () => {
      const pivot = new THREE.Group(); // pivot ngoài để đánh lái (steer) quanh trục Y
      const spin = new THREE.Group();  // pivot trong để lăn (roll) quanh trục X
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 20), wheelTex);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true; tire.receiveShadow = true;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.26, 12), rimMat);
      rim.rotation.z = Math.PI / 2;
      spin.add(tire, rim);
      pivot.add(spin);
      return { pivot, spin };
    };

    const wheelPositions = {
      fl: [0.82, 0.34, 1.35], fr: [-0.82, 0.34, 1.35],
      rl: [0.82, 0.34, -1.35], rr: [-0.82, 0.34, -1.35],
    };
    for (const key of Object.keys(wheelPositions)) {
      const { pivot, spin } = buildWheel();
      pivot.position.set(...wheelPositions[key]);
      this.group.add(pivot);
      this.wheels[key] = { pivot, spin };
    }

    // ===== Nội thất tối giản: vô lăng quay được (nhìn thấy qua kính) =====
    const wheelRimMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
    const steeringGroup = new THREE.Group();
    const rimTorus = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 8, 20), wheelRimMat);
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.02), wheelRimMat);
    steeringGroup.add(rimTorus, spoke);
    steeringGroup.rotation.x = Math.PI / 2.6;
    steeringGroup.position.set(0.42, 0.82, 1.15);
    this.group.add(steeringGroup);
    this.steeringWheelMesh = steeringGroup;

    // Nâng toàn bộ xe lên mặt đường
    this.group.position.set(0, 0, 40);
  }

  /** Cập nhật animation: bánh xe lăn theo quãng đường, bánh trước đánh lái, vô lăng quay theo góc lái */
  updateWheelAnimation(wheelRotationDelta, steerAngle) {
    this.wheels.fl.pivot.rotation.y = steerAngle;
    this.wheels.fr.pivot.rotation.y = steerAngle;
    this.wheels.fl.spin.rotation.x += wheelRotationDelta;
    this.wheels.fr.spin.rotation.x += wheelRotationDelta;
    this.wheels.rl.spin.rotation.x += wheelRotationDelta;
    this.wheels.rr.spin.rotation.x += wheelRotationDelta;

    // Vô lăng quay tỉ lệ với góc lái bánh xe (tỉ số vô lăng/bánh xe giả định ~14:1)
    this.steeringWheelMesh.rotation.z = -steerAngle * 14;
  }

  setBrakeLight(active) {
    this.brakeLightMesh.emissiveIntensity = active ? 2.2 : 0.15;
  }

  setTurnSignal(side, on) {
    const mat = this.turnSignalMeshes[side];
    if (mat) mat.emissiveIntensity = on ? 2.5 : 0.1;
  }

  getObject3D() {
    return this.group;
  }
}
