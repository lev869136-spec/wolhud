import * as THREE from '/vendor/three.module.js';
import { mat, makeMuzzleFlash } from './world.js';

/* First-person viewmodel weapons, built from boxes. Forward = -Z. */
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
  const tip = box(0.02, 0.08, 0.12, steel(), 0, 0.08, -0.4, g, 0, 0.6);
  const guard = box(0.09, 0.02, 0.03, dark(), 0, -0.01, -0.05, g);
  const handle = box(0.035, 0.05, 0.14, wood(), 0, -0.01, 0.05, g);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.08, -0.46); g.add(muzzle);
  return { group: g, muzzle, type: 'knife' };
}

function buildP350() {
  const g = new THREE.Group();
  const slide = box(0.05, 0.06, 0.24, steel(), 0, 0.02, -0.05, g);
  box(0.045, 0.03, 0.1, dark(), 0, 0.05, -0.05, g); // rear sight
  const frame = box(0.05, 0.05, 0.2, polymer(), 0, -0.01, -0.02, g);
  const grip = box(0.045, 0.16, 0.09, dark(), 0, -0.1, 0.04, g, 0, -0.18);
  const trigger = box(0.03, 0.02, 0.04, steel(), 0, -0.04, -0.06, g);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.02, -0.18); g.add(muzzle);
  return { group: g, muzzle, type: 'pistol' };
}

function buildAKR() {
  const g = new THREE.Group();
  const receiver = box(0.06, 0.09, 0.4, steel(), 0, 0.02, -0.1, g);
  const barrel = box(0.035, 0.035, 0.34, steel(), 0, 0.035, -0.45, g);
  box(0.04, 0.05, 0.03, dark(), 0, 0.07, -0.55, g); // front sight
  const handguard = box(0.05, 0.07, 0.22, wood(), 0, 0.02, -0.3, g);
  const mag = box(0.05, 0.22, 0.1, steel(), 0, -0.12, -0.06, g, 0, 0.22);
  const grip = box(0.045, 0.13, 0.07, wood(), 0, -0.08, 0.1, g, 0, -0.18);
  const stock = box(0.05, 0.08, 0.24, wood(), 0, -0.01, 0.22, g);
  box(0.04, 0.04, 0.3, steel(), 0, 0.05, 0.02, g); // top rail
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.035, -0.62); g.add(muzzle);
  return { group: g, muzzle, type: 'rifle' };
}

function buildAWM() {
  const g = new THREE.Group();
  const body = box(0.06, 0.1, 0.7, polymer(), 0, 0.02, -0.1, g);
  const barrel = box(0.04, 0.04, 0.5, steel(), 0, 0.04, -0.7, g);
  box(0.05, 0.04, 0.06, dark(), 0, 0.07, -0.95, g); // muzzle brake
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 10), steel());
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0, 0.11, -0.08);
  g.add(scope);
  box(0.04, 0.08, 0.05, dark(), 0, 0.11, -0.08, g); // mount
  const mag = box(0.05, 0.12, 0.1, polymer(), 0, -0.08, -0.05, g);
  const grip = box(0.045, 0.14, 0.07, polymer(), 0, -0.09, 0.14, g, 0, -0.15);
  const stock = box(0.05, 0.1, 0.3, polymer(), 0, 0, 0.36, g);
  const bolt = box(0.04, 0.03, 0.1, steel(), 0.05, 0.02, 0.05, g);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.04, -1.0); g.add(muzzle);
  return { group: g, muzzle, type: 'rifle' };
}

const BUILDERS = { knife: buildKnife, p350: buildP350, akr: buildAKR, awm: buildAWM };

/* A weapon viewmodel: gun + muzzle flash. */
export function buildWeaponViewmodel(key) {
  const { group, muzzle } = (BUILDERS[key] || buildAKR)();
  const flash = makeMuzzleFlash();
  muzzle.add(flash);
  return { group, muzzle, flash: flash.children, key };
}
