import * as THREE from '/vendor/three.module.js';
import { makeLights, makeDust, updateDust, makeCharacter, mat } from './world.js';
import { createFBXPlayer, disposeObject } from './assets.js';

/* Standoff-2-style 3D lobby: your soldier stands on a pedestal platform in a
 * dark hangar, camera slowly orbits, team colour is reflected live (T red / CT blue). */
export class LobbyScene {
  constructor(assets) {
    this.assets = assets || {};
    this.team = 't';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x12161d);
    this.scene.fog = new THREE.Fog(0x12161d, 9, 46);
    makeLights(this.scene);
    this.dust = makeDust(this.scene, 140, 16, 9);

    // hangar floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(44, 0.2, 44), mat(0x1a212a, { roughness: 0.9 }));
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // floor grid lines (subtle)
    const grid = new THREE.GridHelper(44, 22, 0x2a3540, 0x202832);
    grid.position.y = 0.01;
    this.scene.add(grid);

    // background pillars
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 7, 0.9), mat(0x232a33, { roughness: 0.8 }));
      p.position.set(Math.sin(a) * 8.5, 3.5, Math.cos(a) * 8.5);
      p.castShadow = p.receiveShadow = true;
      this.scene.add(p);
    }

    // rim lights
    this.rim1 = new THREE.PointLight(0xe03a2f, 40, 18, 2); this.rim1.position.set(4, 3, 4); this.scene.add(this.rim1);
    this.rim2 = new THREE.PointLight(0x2f6fe0, 40, 18, 2); this.rim2.position.set(-4, 3, -4); this.scene.add(this.rim2);
    const key = new THREE.PointLight(0xffe0b0, 60, 22, 2); key.position.set(0, 5, 2); this.scene.add(key);

    // pedestal platform
    this.pedestal = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.6, 0.5, 28), mat(0x2a313a, { roughness: 0.6, metalness: 0.25 }));
    base.position.y = 0.25; base.castShadow = base.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.1, 0.16, 28), mat(0x37414f, { roughness: 0.6 }));
    top.position.y = 0.56; top.castShadow = top.receiveShadow = true;
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: 0xe03a2f }));
    this.ring.rotation.x = Math.PI / 2; this.ring.position.y = 0.62;
    this.pedestal.add(base, top, this.ring);
    this.scene.add(this.pedestal);

    // character holder (feet on platform top)
    this.charHolder = new THREE.Group();
    this.charHolder.position.set(0, 0.63, 0);
    this.scene.add(this.charHolder);
    this.char = null;
    this.charFBX = null;

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
    this.angle = -0.9;
    this.t = 0;

    this.setTeam(this.team);
  }

  setTeam(team) {
    this.team = team;
    const col = (window.CONFIG.TEAMS[team] || window.CONFIG.TEAMS.t).color;
    this.ring.material.color.setHex(col);
    this.rim1.color.setHex(col);
    this.rim1.position.x = Math.abs(this.rim1.position.x);

    if (this.char) { this.charHolder.remove(this.char); disposeObject(this.char); this.char = null; this.charFBX = null; }

    if (this.assets.player) {
      const inst = createFBXPlayer(this.assets.player, col, this.assets.playerClips);
      inst.setState('idle');
      this.char = inst.group;
      this.charFBX = inst;
    } else {
      this.char = makeCharacter(col);
    }
    this.char.rotation.y = -0.7;
    this.charHolder.add(this.char);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.t += dt;
    this.angle += dt * 0.22;
    const r = 4.1;
    this.camera.position.set(Math.sin(this.angle) * r, 1.75 + Math.sin(this.t * 0.4) * 0.08, Math.cos(this.angle) * r);
    this.camera.lookAt(0, 1.35, 0);

    if (this.charFBX) {
      this.charFBX.update(dt);
    }
    if (this.char) {
      this.char.rotation.y = -0.7 + Math.sin(this.t * 0.5) * 0.55;
    }
    updateDust(this.dust, this.t, dt);
  }

  render(renderer) {
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    disposeObject(this.scene);
  }
}
