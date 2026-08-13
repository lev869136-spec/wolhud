import * as THREE from '/vendor/three.module.js';

/* Shared low-poly look helpers. Flat-shaded materials = Standoff-2 vibe. */

export const PALETTE = {
  floor: 0x37414f,
  wall: 0x465264,
  crate: 0x8d6b45,
  metal: 0x5a6a7c,
  accent: 0xe8703a,
  skyTop: 0x24415f,
  skyHorizon: 0xaebfce,
  fog: 0xaebfce,
  sun: 0xffe0b0
};

/* Fresh material per call — safe to dispose with its mesh. */
export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({
    color,
    roughness: 0.85,
    metalness: 0.05,
    flatShading: true
  }, opts));
}

let _glow = null;
export function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c);
  _glow.colorSpace = THREE.SRGBColorSpace;
  return _glow;
}

/* Gradient sky dome (BackSide sphere). */
export function makeSky() {
  const geo = new THREE.SphereGeometry(500, 32, 16);
  const uniforms = {
    top: { value: new THREE.Color(PALETTE.skyTop) },
    horizon: { value: new THREE.Color(PALETTE.skyHorizon) }
  };
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: `
      varying vec3 vPos;
      void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top; uniform vec3 horizon;
      void main(){
        float h = normalize(vPos).y * 0.5 + 0.5;
        gl_FragColor = vec4(mix(horizon, top, pow(max(h,0.0), 0.65)), 1.0);
      }
    `
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.frustumCulled = false;
  return mesh;
}

export function makeLights(scene) {
  const hemi = new THREE.HemisphereLight(0xcfe0f5, 0x6a5a48, 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.2);
  sun.position.set(28, 42, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 140;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);
  return sun;
}

/* Build the low-poly map from shared colliders. */
export function buildMap(scene) {
  const colliders = window.CONFIG.buildColliders();
  const group = new THREE.Group();
  const edgesGroup = new THREE.Group();
  const colors = {
    floor: [0x37414f, 0x333c49],
    wall: [0x465264, 0x3f4a5a],
    crate: [0x8d6b45, 0x7c5c39],
    metal: [0x5a6a7c, 0x4e5d6d],
    accent: [0xe8703a, 0xcf5f2c]
  };
  let i = 0;
  for (const c of colliders) {
    const [c1, c2] = colors[c.mat] || colors.crate;
    const col = (i % 2 === 0) ? c1 : c2;
    const geo = new THREE.BoxGeometry(c.s[0], c.s[1], c.s[2]);
    const mesh = new THREE.Mesh(geo, mat(col));
    mesh.position.set(c.p[0], c.p[1], c.p[2]);
    mesh.castShadow = c.mat !== 'floor';
    mesh.receiveShadow = true;
    group.add(mesh);

    // crisp low-poly edge lines
    const eg = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x0d1117, transparent: true, opacity: 0.35 })
    );
    eg.position.copy(mesh.position);
    edgesGroup.add(eg);
    i++;
  }
  scene.add(group);
  scene.add(edgesGroup);
  return group;
}

/* Drifting dust motes. */
export function makeDust(scene, count = 180, area = 60, height = 14) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * area;
    positions[i * 3 + 1] = Math.random() * height;
    positions[i * 3 + 2] = (Math.random() - 0.5) * area;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const m = new THREE.PointsMaterial({
    map: glowTexture(), size: 0.14, sizeAttenuation: true,
    transparent: true, opacity: 0.35, depthWrite: false,
    blending: THREE.AdditiveBlending, color: 0xfff2dc
  });
  const points = new THREE.Points(geo, m);
  points.userData.baseY = positions;
  scene.add(points);
  return points;
}

/* Update dust drift (call each frame). */
export function updateDust(points, t, dt) {
  if (!points) return;
  const pos = points.geometry.attributes.position;
  const base = points.userData.baseY;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, base[i * 3 + 1] + Math.sin(t * 0.25 + i) * 0.7);
    pos.setX(i, base[i * 3] + Math.cos(t * 0.16 + i * 1.7) * 0.8);
  }
  pos.needsUpdate = true;
  points.rotation.y = t * 0.01;
}

/* ------------------------- character model ------------------------- */

export function makeCharacter(color) {
  const group = new THREE.Group();
  const shirt = mat(color, { roughness: 0.7 });
  const pants = mat(new THREE.Color(color).multiplyScalar(0.55), { roughness: 0.8 });
  const helmet = mat(new THREE.Color(color).multiplyScalar(1.15), { roughness: 0.5 });
  const skin = mat(0xc9987a, { roughness: 0.6 });
  const dark = mat(0x1c1f24, { roughness: 0.5, metalness: 0.3 });

  const box = (w, h, d, m, px, py, pz, parent, pivotAtTop = false) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.castShadow = true;
    if (pivotAtTop) { mesh.position.y = -h / 2; }
    mesh.position.x = px; mesh.position.z = pz;
    const holder = new THREE.Group();
    holder.position.set(0, py, 0);
    holder.add(mesh);
    (parent || group).add(holder);
    return { holder, mesh };
  };

  // legs (pivot at hip)
  const lLeg = box(0.17, 0.78, 0.2, pants, -0.115, 0.82, 0, null, true);
  const rLeg = box(0.17, 0.78, 0.2, pants, 0.115, 0.82, 0, null, true);
  // boots
  box(0.19, 0.14, 0.26, dark, -0.115, 0.07, 0.02, group);
  box(0.19, 0.14, 0.26, dark, 0.115, 0.07, 0.02, group);
  // torso
  box(0.52, 0.56, 0.3, shirt, 0, 1.1, 0, group);
  // chest rig
  box(0.44, 0.24, 0.34, dark, 0, 1.12, 0, group);
  // head + helmet
  box(0.28, 0.26, 0.28, skin, 0, 1.52, 0, group);
  box(0.32, 0.16, 0.3, helmet, 0, 1.68, 0, group);
  box(0.34, 0.06, 0.3, dark, 0, 1.72, 0, group);
  // arms (pivot at shoulder)
  const lArm = box(0.15, 0.52, 0.17, shirt, -0.335, 1.34, 0, null, true);
  const rArm = box(0.15, 0.52, 0.17, shirt, 0.335, 1.34, 0, null, true);
  // hands
  box(0.15, 0.14, 0.15, skin, -0.335, 0.82, 0, group);
  box(0.15, 0.14, 0.15, skin, 0.335, 0.82, 0, group);

  // held rifle (low-poly)
  const gun = new THREE.Group();
  const gunMat = mat(0x23272e, { roughness: 0.4, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.62), gunMat);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.34), gunMat);
  barrel.position.set(0, 0.02, -0.45);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.1), gunMat);
  mag.position.set(0, -0.13, -0.05);
  mag.rotation.x = 0.25;
  body.castShadow = barrel.castShadow = mag.castShadow = true;
  gun.add(body, barrel, mag);
  gun.position.set(0.02, 1.24, 0.34); // rifle held across chest, pointing -Z
  group.add(gun);

  group.userData = { lLeg: lLeg.holder, rLeg: rLeg.holder, lArm: lArm.holder, rArm: rArm.holder, gun };
  return group;
}

/* Billboarded name + hp tag above a player. */
export function makeNameTag(name, color) {
  const w = 256, h = 80;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(1.7, 0.53, 1);
  sprite.position.y = 2.08;

  const colStr = '#' + new THREE.Color(color).getHexString();
  function draw(hp, max) {
    ctx.clearRect(0, 0, w, h);
    // name
    ctx.font = '700 34px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(name, w / 2, 36);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, w / 2, 36);
    // hp bar
    const bx = 28, by = 48, bw = w - 56, bh = 14;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx, by, bw, bh);
    const frac = Math.max(0, hp / max);
    ctx.fillStyle = frac > 0.35 ? '#7dff8a' : '#ff5c5c';
    ctx.fillRect(bx, by, bw * frac, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, bh);
    tex.needsUpdate = true;
  }
  draw(100, 100);
  return { sprite, setHp: (hp, max) => draw(hp, max), color: colStr };
}

/* Small point light + glow sprite for muzzle flashes. */
export function makeMuzzleFlash(color = 0xffd27a) {
  const light = new THREE.PointLight(color, 0, 6, 2);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  sprite.scale.set(0.35, 0.35, 1);
  const group = new THREE.Group();
  group.add(light, sprite);
  return group;
}
