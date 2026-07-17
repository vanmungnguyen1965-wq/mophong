import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Thiết lập chuỗi hậu xử lý (post-processing) bằng EffectComposer:
 * RenderPass (render scene gốc) -> UnrealBloomPass (phát sáng đèn xe, biển báo phản quang)
 * -> OutputPass (chuyển đổi màu output đúng color space / tone mapping của renderer).
 */
export class EffectsManager {
  constructor(renderer, scene, camera, width, height) {
    this.composer = new EffectComposer(renderer);
    this.composer.setSize(width, height);

    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.55, 0.4, 0.86);
    this.composer.addPass(this.bloomPass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);

    this.renderPass = renderPass;
  }

  setSize(width, height) {
    this.composer.setSize(width, height);
  }

  render(dt) {
    this.composer.render(dt);
  }
}
