import * as THREE from '/vendor/three.module.js';
import { makeSky, makeLights, buildMap, makeDust, updateDust, makeCharacter, PALETTE } from './world.js';

/* CS2-style 3D main menu: camera slowly orbits a soldier posed in the arena. */
export class MenuScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.skyHorizon);
    this.scene.fog = new THREE.Fog(PALETTE.fog, 40, 170);

    this.scene.add(makeSky());
    makeLights(this.scene);
    buildMap(this.scene);
    this.dust = makeDust(this.scene, 220, 70, 16);

    // hero character on the central container
    this.hero = makeCharacter(0xff6a3d);
    this.hero.position.set(0, 2.3, 0);
    this.hero.rotation.y = -0.6;
    this.scene.add(this.hero);

    // rim lights for drama
    const rim = new THREE.PointLight(0xff6a3d, 30, 30, 2);
    rim.position.set(3.5, 3.4, 2.5);
    this.scene.add(rim);
    const fill = new THREE.PointLight(0x7db8ff, 20, 30, 2);
    fill.position.set(-3, 2.6, -3);
    this.scene.add(fill);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);
    this.angle = 0;
    this.t = 0;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.t += dt;
    this.angle += dt * 0.12;
    const r = 5.6;
    const x = Math.sin(this.angle) * r;
    const z = Math.cos(this.angle) * r;
    this.camera.position.set(x, 2.9 + Math.sin(this.t * 0.4) * 0.12, z);
    this.camera.lookAt(0, 1.85, 0);

    // subtle idle sway
    const u = this.hero.userData;
    if (u) {
      u.lArm.rotation.x = 0.04 + Math.sin(this.t * 1.1) * 0.03;
      u.rArm.rotation.x = -0.04 - Math.sin(this.t * 1.1) * 0.03;
      this.hero.position.y = 2.3 + Math.sin(this.t * 1.1) * 0.015;
    }
    updateDust(this.dust, this.t, dt);
  }

  render(renderer) {
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }
}
