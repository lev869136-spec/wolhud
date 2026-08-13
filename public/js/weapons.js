import * as THREE from '/vendor/three.module.js';
import { mat, makeMuzzleFlash } from './world.js';

/* First-person viewmodel weapons, built from boxes. Forward = -Z.
 * One parametric builder covers every gun via the `shape` profile in CONFIG. */

const dark = () => mat(0x23272e, { roughness: 0.45, metalness: 0.55 });
const polymer = () => mat(0x33383f, { roughness: 0.6, metalness: 0.2 });
const steel = () => mat(0x565d66, { roughness: 0.35, metalness: 0.85 });
const wood = () => mat(0x7a5a34, { roughness: 0.7, metalness: 0.05 });

function box(w, h, d, m, x, y, z, parent, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.rotation.z = rz;
  parent.add(mesh);
  return mesh;
}

function buildKnife() {
  const g = new THREE.Group();
  const blade = box(0.02, 0.12, 0.3, steel(), 0, 0.04, -0.22, g);
  box(0.02, 0.08, 0.12, steel(), 0, 0.08, -0.4, g, 0, 0.6); // tip
  box(0.09, 0.02, 0.03, dark(), 0, -0.01, -0.05, g);         // guard
  box(0.035, 0.05, 0.14, wood(), 0, -0.01, 0.05, g);         // handle
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.08, -0.46); g.add(muzzle);
  return { group: g, muzzle, type: 'knife' };
}

function buildPistol(shape) {
  const big = !!shape.big;
  const len = shape.len || 0.24;
  const g = new THREE.Group();
  const slide = box(0.055, 0.06, len, steel(), 0, 0.02, -len * 0.28, g);
  if (shape.silencer) box(0.04, 0.04, 0.16, dark(), 0, 0.02, -len * 0.5 - 0.05, g);
  box(0.05, 0.03, 0.09, dark(), 0, 0.055, -len * 0.45, g); // rear sight
  const frame = box(0.05, 0.05, len * 0.82, polymer(), 0, -0.01, -len * 0.26, g);
  const gripH = big ? 0.2 : 0.16;
  box(0.045, gripH, 0.09, dark(), 0, -0.02 - gripH / 2, len * 0.08, g, 0, big ? -0.12 : -0.2);
  box(0.03, 0.02, 0.04, steel(), 0, -0.04, -len * 0.1, g); // trigger
  if (shape.magStick) box(0.04, 0.18, 0.06, steel(), 0, -0.14, 0, g, 0, 0.1);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.02, -len * 0.55); g.add(muzzle);
  return { group: g, muzzle, type: 'pistol' };
}

function buildSMG(shape) {
  const len = shape.len || 0.42;
  const g = new THREE.Group();
  const body = box(0.06, 0.1, len * 0.6, dark(), 0, 0.02, -len * 0.1, g);
  const barrel = box(0.04, 0.04, len * 0.4, steel(), 0, 0.035, -len * 0.55, g);
  if (shape.stock) box(0.05, 0.08, len * 0.3, polymer(), 0, -0.01, len * 0.22, g);
  const magMat = shape.magStick ? steel() : polymer();
  if (shape.magStick) box(0.045, 0.24, 0.07, magMat, 0, -0.13, -len * 0.05, g, 0, 0.15);
  else box(0.05, 0.16, 0.09, magMat, 0, -0.11, -len * 0.05, g, 0, 0.1);
  box(0.045, 0.13, 0.06, polymer(), 0, -0.08, len * 0.12, g, 0, -0.15); // grip
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.035, -len * 0.75); g.add(muzzle);
  return { group: g, muzzle, type: 'smg' };
}

function buildRifle(shape) {
  const len = shape.len || 0.62;
  const g = new THREE.Group();
  const bodyMat = shape.wood ? wood() : dark();
  const body = box(0.06, 0.1, len * 0.55, dark(), 0, 0.02, -len * 0.08, g);
  const barrel = box(0.035, 0.035, len * 0.42, steel(), 0, 0.035, -len * 0.55, g);
  const guard = box(0.05, 0.075, len * 0.3, bodyMat, 0, 0.02, -len * 0.38, g);
  if (shape.carryHandle) box(0.04, 0.04, 0.16, dark(), 0, 0.1, -len * 0.42, g);
  box(0.05, 0.04, len * 0.18, dark(), 0, 0.05, -len * 0.05, g); // top rail
  if (shape.magCurved) box(0.05, 0.24, 0.1, bodyMat, 0, -0.13, -len * 0.05, g, 0, 0.22);
  else if (shape.magStraight) box(0.05, 0.2, 0.09, dark(), 0, -0.12, -len * 0.05, g, 0, 0.08);
  box(0.045, 0.13, 0.07, bodyMat, 0, -0.08, len * 0.1, g, 0, -0.18); // grip
  if (shape.stock) box(0.05, 0.08, len * 0.26, bodyMat, 0, -0.01, len * 0.2, g);
  if (shape.scope) {
    const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 10), steel());
    sc.rotation.x = Math.PI / 2; sc.position.set(0, 0.11, -len * 0.15); g.add(sc);
    box(0.04, 0.07, 0.05, dark(), 0, 0.11, -len * 0.15, g);
  }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.035, -len * 0.76); g.add(muzzle);
  return { group: g, muzzle, type: 'rifle' };
}

function buildSniper(shape) {
  const len = shape.len || 0.9;
  const g = new THREE.Group();
  const body = box(0.06, 0.1, len * 0.55, polymer(), 0, 0.02, -len * 0.08, g);
  const barrel = box(0.04, 0.04, len * 0.5, steel(), 0, 0.04, -len * 0.6, g);
  box(0.05, 0.05, 0.06, dark(), 0, 0.05, -len * 0.85, g); // muzzle brake
  const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.26, 10), steel());
  sc.rotation.x = Math.PI / 2; sc.position.set(0, 0.12, -len * 0.1); g.add(sc);
  box(0.04, 0.08, 0.05, dark(), 0, 0.12, -len * 0.1, g);
  box(0.05, 0.14, 0.1, polymer(), 0, -0.1, -len * 0.08, g); // mag
  box(0.045, 0.15, 0.07, polymer(), 0, -0.09, len * 0.12, g, 0, -0.15); // grip
  box(0.05, 0.1, len * 0.26, polymer(), 0, 0, len * 0.3, g); // stock
  box(0.04, 0.03, 0.1, steel(), 0.055, 0.02, len * 0.04, g); // bolt
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.04, -len * 0.9); g.add(muzzle);
  return { group: g, muzzle, type: 'rifle' };
}

function buildHeavy(shape) {
  const len = shape.len || 0.8;
  const g = new THREE.Group();
  const body = box(0.07, 0.11, len * 0.55, dark(), 0, 0.02, -len * 0.08, g);
  const barrel = box(0.05, 0.05, len * 0.45, steel(), 0, 0.03, -len * 0.6, g);
  box(0.05, 0.05, 0.08, steel(), 0, 0.03, -len * 0.82, g); // muzzle
  box(0.06, 0.22, 0.12, steel(), 0, -0.13, -len * 0.05, g); // box mag
  box(0.05, 0.09, len * 0.3, dark(), 0, -0.02, len * 0.24, g); // stock
  box(0.05, 0.15, 0.07, polymer(), 0, -0.1, len * 0.1, g, 0, -0.15); // grip
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.03, -len * 0.86); g.add(muzzle);
  return { group: g, muzzle, type: 'rifle' };
}

const BUILDERS = {
  knife: buildKnife,
  pistol: buildPistol,
  smg: buildSMG,
  rifle: buildRifle,
  sniper: buildSniper,
  heavy: buildHeavy
};

export function buildWeaponViewmodel(key) {
  const cfg = (window.CONFIG && window.CONFIG.WEAPONS && window.CONFIG.WEAPONS[key]) || null;
  const shape = (cfg && cfg.shape) || { kind: 'rifle' };
  const builder = BUILDERS[shape.kind] || buildRifle;
  const { group, muzzle } = builder(shape);
  const flash = makeMuzzleFlash();
  muzzle.add(flash);
  return { group, muzzle, flash: flash.children, key, type: (cfg && cfg.tracer) || 'rifle' };
}
