import * as THREE from 'three';

/**
 * CollisionSystem kiểm tra va chạm giữa bounding box của xe với các vật cản tĩnh
 * (cọc tiêu, curb, biển báo) trong môi trường, đồng thời kiểm tra xe có ra khỏi
 * ranh giới sân asphalt hay không. Có cơ chế cooldown để một va chạm không bị
 * tính trừ điểm lặp lại liên tục trong khi 2 vật thể còn đang chạm nhau.
 */
export class CollisionSystem {
  constructor(environment) {
    this.environment = environment;
    this._cooldowns = new Map(); // object -> thời điểm được phép báo va chạm tiếp theo
    this.groundBounds = { minX: -47, maxX: 47, minZ: -69, maxZ: 69 };
  }

  /** Tính bounding box thế giới hiện tại của xe (theo group Object3D) */
  getVehicleBox(vehicleObject3D) {
    return new THREE.Box3().setFromObject(vehicleObject3D);
  }

  /**
   * Kiểm tra toàn bộ va chạm trong khung hình hiện tại.
   * @returns {Array<{type:string, message:string}>} danh sách sự kiện lỗi mới phát sinh
   */
  checkCollisions(vehicleObject3D, now) {
    const events = [];
    const vBox = this.getVehicleBox(vehicleObject3D);

    // ----- Va chạm với vật cản tĩnh (cọc / curb / biển báo) -----
    for (const collider of this.environment.colliders) {
      if (vBox.intersectsBox(collider.box)) {
        const key = collider.mesh || collider.box;
        const readyAt = this._cooldowns.get(key) || 0;
        if (now > readyAt) {
          this._cooldowns.set(key, now + 1.5); // 1.5s cooldown tránh spam
          if (collider.type === 'pole') events.push({ type: 'hit_pole', message: 'Đâm cọc tiêu' });
          else if (collider.type === 'curb') events.push({ type: 'hit_curb', message: 'Đâm vào bó vỉa (curb)' });
          else if (collider.type === 'sign') events.push({ type: 'hit_sign', message: 'Đâm vào biển báo' });
        }
      }
    }

    // ----- Kiểm tra ra khỏi ranh giới sân -----
    const pos = vehicleObject3D.position;
    const b = this.groundBounds;
    if (pos.x < b.minX || pos.x > b.maxX || pos.z < b.minZ || pos.z > b.maxZ) {
      const key = 'out_of_bounds';
      const readyAt = this._cooldowns.get(key) || 0;
      if (now > readyAt) {
        this._cooldowns.set(key, now + 2.0);
        events.push({ type: 'out_of_bounds', message: 'Xe đi ra ngoài ranh giới sân' });
      }
    }

    return events;
  }

  /** Kiểm tra xem 4 góc xe có nằm trong vùng vạch sơn của chuồng không (đè vạch nếu chỉ 1 phần nằm ngoài) */
  checkLineTouch(vehicleObject3D, bay, now) {
    const corners = this._getVehicleCorners(vehicleObject3D);
    let insideCount = 0;
    for (const c of corners) {
      if (this._pointInBay(c, bay)) insideCount++;
    }
    const key = `line_${bay.name}`;
    if (insideCount > 0 && insideCount < 4) {
      const readyAt = this._cooldowns.get(key) || 0;
      if (now > readyAt) {
        this._cooldowns.set(key, now + 2.5);
        return { type: 'line_touch', message: `Đè vạch chuồng ${bay.name}` };
      }
    }
    return null;
  }

  /** 4 góc của xe trong không gian thế giới (xấp xỉ hình chữ nhật 1.9m x 4.4m) */
  _getVehicleCorners(vehicleObject3D) {
    const halfW = 0.95, halfL = 2.2;
    const heading = vehicleObject3D.rotation.y;
    const cos = Math.cos(heading), sin = Math.sin(heading);
    const local = [[-halfW, -halfL], [halfW, -halfL], [-halfW, halfL], [halfW, halfL]];
    return local.map(([lx, lz]) => new THREE.Vector3(
      vehicleObject3D.position.x + lx * cos + lz * sin,
      0,
      vehicleObject3D.position.z - lx * sin + lz * cos
    ));
  }

  /** Kiểm tra 1 điểm có nằm trong hình chữ nhật chuồng (đã xoay theo heading của chuồng) hay không */
  _pointInBay(point, bay) {
    const dx = point.x - bay.center.x;
    const dz = point.z - bay.center.z;
    const cos = Math.cos(-bay.heading), sin = Math.sin(-bay.heading);
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    return Math.abs(lx) <= bay.width / 2 + 0.05 && Math.abs(lz) <= bay.length / 2 + 0.05;
  }

  getVehicleCorners(vehicleObject3D) {
    return this._getVehicleCorners(vehicleObject3D);
  }

  pointInBay(point, bay) {
    return this._pointInBay(point, bay);
  }
}
