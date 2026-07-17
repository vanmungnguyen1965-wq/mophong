import * as THREE from 'three';

/**
 * Module TextureFactory
 * Sinh các texture PBR (map màu, roughness, normal đơn giản) bằng canvas offscreen,
 * sau đó nạp thành THREE.CanvasTexture để dùng trong MeshStandardMaterial / MeshPhysicalMaterial.
 * Đây KHÔNG phải là render 2D của ứng dụng - chỉ là bước sinh dữ liệu texture cho WebGL.
 */
export class TextureFactory {

  /** Tạo canvas offscreen với kích thước cho trước */
  static _canvas(size = 512) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    return c;
  }

  /** Texture nhựa đường asphalt: nền xám đậm + noise hạt + vệt bánh xe nhẹ */
  static createAsphalt(size = 512) {
    const canvas = this._canvas(size);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#3a3d40';
    ctx.fillRect(0, 0, size, size);
    // Noise hạt đá
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * size, y = Math.random() * size;
      const v = 40 + Math.random() * 60;
      ctx.fillStyle = `rgb(${v},${v},${v + 2})`;
      ctx.fillRect(x, y, 1.4, 1.4);
    }
    // Vệt bánh xe (2 dải sẫm màu chạy dọc)
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#000000';
    ctx.fillRect(size * 0.28, 0, size * 0.08, size);
    ctx.fillRect(size * 0.64, 0, size * 0.08, size);
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Texture cỏ: nền xanh lục + đốm sáng tối ngẫu nhiên mô phỏng lá */
  static createGrass(size = 256) {
    const canvas = this._canvas(size);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#3d7a34';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * size, y = Math.random() * size;
      const g = 90 + Math.random() * 70;
      ctx.fillStyle = `rgba(40,${g},30,0.5)`;
      ctx.fillRect(x, y, 2, 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Texture curb (bó vỉa) vàng đen xen kẽ chéo - dùng cho mép sân sát hạch */
  static createCurbStripes(size = 256) {
    const canvas = this._canvas(size);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#f5c400';
    const stripeW = size / 6;
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(Math.PI / 4);
    for (let x = -size; x < size * 2; x += stripeW * 2) {
      ctx.fillRect(x, -size * 2, stripeW, size * 4);
    }
    ctx.restore();
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Texture bê tông (vỉa hè / concrete) */
  static createConcrete(size = 512) {
    const canvas = this._canvas(size);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#9a968c';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 6000; i++) {
      const x = Math.random() * size, y = Math.random() * size;
      const v = 130 + Math.random() * 50;
      ctx.fillStyle = `rgba(${v},${v},${v - 6},0.4)`;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    // Đường ron bê tông
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < size; i += size / 6) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Sinh texture Ambient Occlusion đơn giản dạng noise mềm cho mặt đường */
  static createAOMap(size = 512) {
    const canvas = this._canvas(size);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * size, y = Math.random() * size, r = 10 + Math.random() * 40;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(0,0,0,0.35)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /** Texture chữ (biển số / biển báo) vẽ text lên canvas, dùng làm mặt phẳng */
  static createLabelTexture(text, { bg = '#ffffff', color = '#111111', font = 'bold 120px Arial', w = 512, h = 256 } = {}) {
    const canvas = this._canvas(w);
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Texture vạch sơn trắng/vàng dạng dải để dán lên mặt đường (dùng làm decal đơn giản) */
  static createPaintStripe(color = '#ffffff', size = 128) {
    const canvas = this._canvas(size);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = color;
    ctx.fillRect(size * 0.35, 0, size * 0.3, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
}
