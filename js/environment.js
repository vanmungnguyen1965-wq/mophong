import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { TextureFactory } from './textures.js';

/**
 * EnvironmentBuilder dựng toàn bộ sân sát hạch lái xe:
 * mặt đường nhựa, cỏ, bó vỉa (curb) vàng đen, biển báo, cọc tiêu,
 * vạch sơn kẻ đường và 2 chuồng bài thi (ghép dọc / ghép ngang).
 * Đồng thời trả về toạ độ/kích thước chuồng để module parking.js dùng chấm điểm.
 */
export class EnvironmentBuilder {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'Environment';
    this.colliders = []; // các vật cản tĩnh: cọc, biển báo (dùng cho collision.js)
    this.bays = {}; // thông tin 2 chuồng bài thi

    this._buildGround();
    this._buildCurbBorder();
    this._buildParkingBayVertical();   // Bài 1: ghép xe dọc
    this._buildParkingBayHorizontal(); // Bài 2: ghép xe ngang
    this._buildRoadMarkings();
    this._buildSigns();
    this._buildReflectivePatch();

    this.scene.add(this.group);
  }

  /** Mặt đường asphalt trung tâm + cỏ bao quanh + AO map */
  _buildGround() {
    const asphaltTex = TextureFactory.createAsphalt(1024);
    asphaltTex.repeat.set(18, 26);
    const aoTex = TextureFactory.createAOMap(512);
    aoTex.repeat.set(18, 26);

    const asphaltMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      aoMap: aoTex,
      roughness: 0.92,
      metalness: 0.02,
    });

    const asphaltGeo = new THREE.PlaneGeometry(96, 140, 1, 1);
    // aoMap cần bộ UV thứ 2
    asphaltGeo.setAttribute('uv2', new THREE.BufferAttribute(asphaltGeo.attributes.uv.array, 2));
    const asphalt = new THREE.Mesh(asphaltGeo, asphaltMat);
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.receiveShadow = true;
    this.group.add(asphalt);

    // Cỏ bao quanh (mặt phẳng lớn hơn, nằm thấp hơn asphalt một chút)
    const grassTex = TextureFactory.createGrass(512);
    grassTex.repeat.set(40, 50);
    const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1.0 });
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.03;
    grass.receiveShadow = true;
    this.group.add(grass);
  }

  /** Bó vỉa (curb) vàng đen viền quanh khu vực asphalt */
  _buildCurbBorder() {
    const curbTex = TextureFactory.createCurbStripes(256);
    curbTex.repeat.set(24, 1);
    const curbMat = new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.8 });

    const mkCurb = (w, d, x, z, rotY = 0, repeatX = 10) => {
      const tex = curbTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(repeatX, 1);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
      const curb = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, d), mat);
      curb.position.set(x, 0.11, z);
      curb.rotation.y = rotY;
      curb.castShadow = true;
      curb.receiveShadow = true;
      this.group.add(curb);
      this.colliders.push({ type: 'curb', box: new THREE.Box3().setFromObject(curb) });
    };

    // 2 cạnh dài (Đông/Tây) + 2 cạnh ngắn (Bắc/Nam) quanh sân 96x140
    mkCurb(0.4, 140, -48, 0, 0, 30);
    mkCurb(0.4, 140, 48, 0, 0, 30);
    mkCurb(96, 0.4, 0, -70, 0, 20);
    mkCurb(96, 0.4, 0, 70, 0, 20);
  }

  /** Chuồng ghép xe dọc (Bài 1): xe lùi thẳng vào giữa 2 hàng cọc.
   *  Kích thước chuẩn: rộng 2,5 m x dài 7,0 m; làn đường/cửa vào phía trước rộng 3,5 m. */
  _buildParkingBayVertical() {
    const center = new THREE.Vector3(-28, 0, 30);
    const bayWidth = 2.5;   // chiều rộng ô đỗ (trục X - theo bề ngang thân xe)
    const bayLength = 7.0;  // chiều dài ô đỗ (trục Z - hướng xe lùi vào)
    const laneWidth = 3.5;  // chiều rộng làn đường / cửa vào phía trước ô đỗ
    const heading = 0;      // hướng chuẩn khi đỗ xong (dọc theo trục Z)

    this._drawBayLines(center, bayWidth, bayLength, heading);
    this._placeCornerPoles(center, bayWidth, bayLength, heading);
    this._drawApproachLane(center, bayLength, laneWidth, heading, 1);

    this.bays.vertical = {
      name: 'Ghép xe dọc',
      center,
      width: bayWidth,
      length: bayLength,
      laneWidth,
      heading,
      approachPoint: new THREE.Vector3(center.x - laneWidth - 2, 0, center.z + bayLength / 2 + 7),
    };
  }

  /** Chuồng ghép xe ngang (Bài 2): xe lùi vuông góc vào chuồng nằm ngang trục X.
   *  Kích thước chuẩn: rộng 2,5 m x sâu 5,0 m; làn đường trước ô đỗ rộng 5,0 m. */
  _buildParkingBayHorizontal() {
    const center = new THREE.Vector3(28, 0, -22);
    const bayWidth = 2.5;   // chiều rộng ô đỗ (trục theo bề ngang thân xe)
    const bayLength = 5.0;  // chiều sâu ô đỗ (trục theo chiều dài thân xe - hướng xe lùi vào)
    const laneWidth = 5.0;  // chiều rộng làn đường trước ô đỗ
    const heading = Math.PI / 2; // hướng chuẩn khi đỗ xong (thân xe nằm dọc trục X)

    this._drawBayLines(center, bayWidth, bayLength, heading);
    this._placeCornerPoles(center, bayWidth, bayLength, heading);
    this._drawApproachLane(center, bayLength, laneWidth, heading, -1);

    this.bays.horizontal = {
      name: 'Ghép xe ngang',
      center,
      width: bayWidth,
      length: bayLength,
      laneWidth,
      heading,
      approachPoint: new THREE.Vector3(center.x + bayLength / 2 + 7, 0, center.z - laneWidth / 2 - 2),
    };
  }

  /** Vẽ vạch sơn trắng viền chuồng đỗ bằng các thanh mỏng phát sáng nhẹ */
  _drawBayLines(center, width, length, rotY) {
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, emissive: 0x222222 });
    const mkLine = (w, d, lx, lz) => {
      const line = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), lineMat);
      const cos = Math.cos(rotY), sin = Math.sin(rotY);
      const rx = lx * cos - lz * sin;
      const rz = lx * sin + lz * cos;
      line.position.set(center.x + rx, 0.02, center.z + rz);
      line.rotation.y = rotY;
      line.receiveShadow = true;
      this.group.add(line);
    };
    const thick = 0.12;
    // 2 vạch dọc 2 bên + 1 vạch đáy (đầu chuồng), miệng chuồng để hở cho xe lùi vào
    mkLine(thick, length, -width / 2, 0);
    mkLine(thick, length, width / 2, 0);
    mkLine(width, thick, 0, length / 2);
  }

  /** Vẽ 2 vạch biên thể hiện chiều rộng làn đường / cửa vào phía trước ô đỗ,
   *  kéo dài từ miệng chuồng ra phía làn xe chạy để người thi hình dung đúng hành lang thao tác.
   *  mouthSign chọn đúng phía miệng chuồng (khớp với approachPoint) vì công thức xoay vị trí
   *  bên dưới cho kết quả ngược dấu theo trục Z tuỳ vào heading = 0 hay 90 độ. */
  _drawApproachLane(center, bayLength, laneWidth, rotY, mouthSign = 1) {
    const laneMat = new THREE.MeshStandardMaterial({
      color: 0x66d9ef, roughness: 0.6, emissive: 0x123b3a, emissiveIntensity: 0.35,
    });
    const extension = 9; // chiều dài vạch kéo ra phía làn xe chạy
    const cos = Math.cos(rotY), sin = Math.sin(rotY);
    const mkLaneLine = (lx) => {
      const lz = mouthSign * (bayLength / 2 + extension / 2); // bắt đầu ngay miệng chuồng, kéo ra ngoài
      const rx = lx * cos - lz * sin;
      const rz = lx * sin + lz * cos;
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, extension), laneMat);
      line.position.set(center.x + rx, 0.018, center.z + rz);
      line.rotation.y = rotY;
      line.receiveShadow = true;
      this.group.add(line);
    };
    mkLaneLine(-laneWidth / 2);
    mkLaneLine(laneWidth / 2);
  }

  /** Đặt 4 cọc tiêu ở 4 góc chuồng (cọc nhựa cam trắng chuẩn sát hạch) */
  _placeCornerPoles(center, width, length, rotY) {
    const cos = Math.cos(rotY), sin = Math.sin(rotY);
    const corners = [
      [-width / 2, -length / 2], [width / 2, -length / 2],
      [-width / 2, length / 2], [width / 2, length / 2],
    ];
    corners.forEach(([lx, lz]) => {
      const rx = lx * cos - lz * sin;
      const rz = lx * sin + lz * cos;
      const pole = this._createPole();
      pole.position.set(center.x + rx, 0, center.z + rz);
      this.group.add(pole);
      const box = new THREE.Box3().setFromObject(pole);
      this.colliders.push({ type: 'pole', box, mesh: pole });
    });
  }

  /** Tạo 1 cọc tiêu hình trụ cam-trắng xen kẽ */
  _createPole() {
    const g = new THREE.Group();
    const segH = 0.18;
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0xff5500 : 0xffffff,
        roughness: 0.5,
      });
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, segH, 12), mat);
      seg.position.y = segH * i + segH / 2;
      seg.castShadow = true;
      seg.receiveShadow = true;
      g.add(seg);
    }
    // Đế cọc
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.15, 0.05, 12),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 })
    );
    base.position.y = 0.025;
    base.castShadow = true;
    g.add(base);
    return g;
  }

  /** Vạch sơn làn đường nối 2 khu vực bài thi + vạch dừng */
  _buildRoadMarkings() {
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf5c400, roughness: 0.6 });

    // Vạch tim đường vàng nét đứt chạy dọc trục chính
    for (let z = -60; z < 60; z += 4) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.015, 2), yellowMat);
      dash.position.set(0, 0.015, z);
      dash.receiveShadow = true;
      this.group.add(dash);
    }

    // Vạch dừng (stop line) trước khu vực chuồng dọc
    const stop1 = new THREE.Mesh(new THREE.BoxGeometry(6, 0.02, 0.3), stripeMat);
    stop1.position.set(-28, 0.02, 42);
    this.group.add(stop1);

    // Vạch dừng trước khu vực chuồng ngang
    const stop2 = new THREE.Mesh(new THREE.BoxGeometry(6, 0.02, 0.3), stripeMat);
    stop2.position.set(38, 0.02, -22);
    stop2.rotation.y = Math.PI / 2;
    this.group.add(stop2);
  }

  /** Biển báo sát hạch (biển chỉ dẫn bài thi) dựng bằng cọc + bảng biển texture chữ */
  _buildSigns() {
    this._createSignPost('BÀI 1\nGHÉP DỌC', -28, 44, 0x0a63c9);
    this._createSignPost('BÀI 2\nGHÉP NGANG', 38, -30, 0x0a63c9);
    this._createSignPost('SÂN SÁT HẠCH\nHẠNG B', 0, 66, 0xc91a1a);
  }

  _createSignPost(text, x, z, bgHex) {
    const g = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.4, metalness: 0.6 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 10), poleMat);
    pole.position.y = 1.2;
    pole.castShadow = true;
    g.add(pole);

    const bgColor = `#${bgHex.toString(16).padStart(6, '0')}`;
    const tex = TextureFactory.createLabelTexture(text.split('\n')[0], {
      bg: bgColor, color: '#ffffff', font: 'bold 64px Arial', w: 512, h: 256,
    });
    const boardMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.1 });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), boardMat);
    board.position.set(0, 2.15, 0.01);
    board.castShadow = true;
    g.add(board);
    const boardBack = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), boardMat);
    boardBack.position.set(0, 2.15, -0.01);
    boardBack.rotation.y = Math.PI;
    g.add(boardBack);

    g.position.set(x, 0, z);
    this.group.add(g);

    const box = new THREE.Box3().setFromObject(g);
    this.colliders.push({ type: 'sign', box, mesh: g });
  }

  /** Một mảng nhựa đường ướt phản chiếu thật (Reflector) gần khu vực xuất phát để thể hiện hiệu ứng reflection */
  _buildReflectivePatch() {
    const geo = new THREE.CircleGeometry(6, 48);
    const reflector = new Reflector(geo, {
      clipBias: 0.003,
      textureWidth: window.innerWidth * window.devicePixelRatio,
      textureHeight: window.innerHeight * window.devicePixelRatio,
      color: 0x889a9a,
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.set(0, 0.015, 55);
    this.group.add(reflector);
  }

  getBay(name) {
    return this.bays[name];
  }
}
