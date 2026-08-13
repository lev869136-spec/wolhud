import * as THREE from '/vendor/three.module.js';
import { FBXLoader } from '/vendor/loaders/FBXLoader.js';
import * as SkeletonUtils from '/vendor/utils/SkeletonUtils.js';

/* FBX asset pipeline: loaders, world (colliders/spawns) generation and
 * animated player instances. Everything is optional — the game falls back
 * to the built-in procedural map and characters when files are missing. */

const BASE = '/assets/';
const C = () => window.CONFIG;

/* Shared asset resources (loaded from disk) must not be disposed by scene cleanup,
 * because clones reuse the same geometry/materials. */
const sharedGeos = new Set();
const sharedMats = new Set();

export function markShared(obj) {
  obj.traverse((n) => {
    if (n.geometry) sharedGeos.add(n.geometry);
    if (n.material) {
      (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => sharedMats.add(m));
    }
  });
}

export function disposeObject(root) {
  root.traverse((n) => {
    if (n.geometry && !sharedGeos.has(n.geometry)) n.geometry.dispose();
    if (n.material) {
      (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => {
        if (!sharedMats.has(m)) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      });
    }
  });
}

/* ----------------------------- loading ----------------------------- */

export async function loadJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

export function loadFBX(url) {
  return new Promise((resolve, reject) => {
    new FBXLoader().load(url, resolve, undefined, (err) => reject(err));
  });
}

/* Loads every optional asset. Never rejects — missing files just mean null. */
export async function preloadAssets() {
  const assets = { map: null, player: null, playerClips: [], mapJSON: null };
  const done = [];

  try {
    const model = await loadFBX(BASE + 'player.fbx');
    assets.player = normalizePlayerModel(model, C().PLAYER.height);
    assets.playerClips = model.animations || [];
    markShared(assets.player);
    done.push('player.fbx');
  } catch (e) { /* procedural player */ }

  try {
    assets.map = await loadFBX(BASE + 'map.fbx');
    markShared(assets.map);
    done.push('map.fbx');
  } catch (e) { /* procedural map */ }

  try {
    assets.mapJSON = await loadJSON(BASE + 'map.json');
    done.push('map.json');
  } catch (e) { /* auto-generate */ }

  if (done.length) console.log('[assets] loaded:', done.join(', '));
  else console.log('[assets] no custom assets — using built-in map & models');
  return assets;
}

/* ------------------------- player model ------------------------- */

/* Wrap the FBX root so it is scaled to `targetHeight` with feet at y=0. */
export function normalizePlayerModel(model, targetHeight) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const h = box.max.y - box.min.y;
  if (h <= 0.001) return model;
  const s = targetHeight / h;
  const holder = new THREE.Group();
  holder.name = 'playerRoot';
  model.scale.setScalar(s);
  model.position.y = -box.min.y * s;
  holder.add(model);
  return holder;
}

const ANIM_STATES = {
  idle: ['idle', 'stand', 'breath', 'tpose', 't-pose', 'neutral'],
  walk: ['walk'],
  run: ['run', 'sprint', 'jog'],
  shoot: ['shoot', 'fire', 'attack', 'shot'],
  reload: ['reload'],
  jump: ['jump'],
  death: ['death', 'die', 'dead', 'down']
};

/* Map clip names → states by keyword (case-insensitive, with fallbacks). */
export function mapAnimations(clips) {
  const names = clips.map((c) => c.name);
  const find = (kw) => {
    for (const n of names) {
      const nl = n.toLowerCase();
      for (const k of kw) if (nl.includes(k)) return n;
    }
    return null;
  };
  const by = {};
  for (const st in ANIM_STATES) by[st] = find(ANIM_STATES[st]);
  by.walk = by.walk || by.run || by.idle;
  by.run = by.run || by.walk;
  by.jump = by.jump || by.idle;
  by.shoot = by.shoot || by.idle;
  by.reload = by.reload || by.idle;
  by.death = by.death || by.idle;
  by.idle = by.idle || names[0] || null;
  return by;
}

function tint(obj, color) {
  const col = new THREE.Color(color);
  obj.traverse((node) => {
    if (node.isMesh && node.material) {
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      const clones = mats.map((m) => {
        const c = m.clone();
        if (c.color) c.color.lerp(col, 0.4);
        return c;
      });
      node.material = clones.length === 1 ? clones[0] : clones;
    }
  });
}

/* Clone the loaded player model and return an animator handle. */
export function createFBXPlayer(model, color, clips) {
  const clone = SkeletonUtils.clone(model);
  const mixer = new THREE.AnimationMixer(clone);
  const mapping = mapAnimations(clips || []);
  const actions = {};
  for (const clip of (clips || [])) actions[clip.name.toLowerCase()] = mixer.clipAction(clip);

  if (color != null) tint(clone, color);

  let current = null;

  const setState = (state) => {
    const name = mapping[state];
    if (!name) return;
    const act = actions[name.toLowerCase()];
    if (!act || act === current) return;
    if (state === 'death') {
      act.loop = THREE.LoopOnce;
      act.clampWhenFinished = true;
    } else if (state === 'shoot' || state === 'jump') {
      act.loop = THREE.LoopOnce;
      act.clampWhenFinished = false;
    } else {
      act.loop = THREE.LoopRepeat;
      act.clampWhenFinished = false;
    }
    if (current) current.fadeOut(0.15);
    act.reset().fadeIn(0.15).play();
    current = act;
  };

  const update = (dt) => mixer.update(dt);
  return { group: clone, mixer, setState, update, actions, mapping };
}

/* --------------------- world: colliders + spawns --------------------- */

function boxesFromModel(model) {
  const boxes = [];
  const global = new THREE.Box3();
  model.traverse((n) => {
    if (!n.isMesh) return;
    n.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(n);
    if (b.isEmpty()) return;
    boxes.push(b);
    global.union(b);
  });
  return { boxes, global };
}

/* Build colliders from FBX mesh bounding boxes + a ground slab. */
export function collidersFromModel(model) {
  const { boxes, global } = boxesFromModel(model);
  if (global.isEmpty()) return C().buildColliders();

  const gw = global.max.x - global.min.x;
  const gd = global.max.z - global.min.z;
  const colliders = [{
    p: [(global.min.x + global.max.x) / 2, global.min.y + 0.05, (global.min.z + global.max.z) / 2],
    s: [gw + 2, 0.1, gd + 2]
  }];

  for (const b of boxes) {
    const sx = b.max.x - b.min.x;
    const sy = b.max.y - b.min.y;
    const sz = b.max.z - b.min.z;
    if (sy < 0.15) continue;                       // flat floor/decal — skip
    if (sx > gw * 0.95 && sz > gd * 0.95 && sy > 30) continue; // skybox/background
    colliders.push({
      p: [(b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2],
      s: [sx, sy, sz]
    });
  }
  // cap for perf on very detailed maps (keep the biggest solids)
  if (colliders.length > 512) {
    colliders.sort((a, b) => (b.s[0] * b.s[1] * b.s[2]) - (a.s[0] * a.s[1] * a.s[2]));
    colliders.length = 512;
  }
  return colliders;
}

/* Sample the top surface of the model to place up to 8 spread spawn points. */
export function spawnsFromModel(model, n = 8) {
  const { boxes, global } = boxesFromModel(model);
  if (global.isEmpty()) return C().SPAWNS.slice();

  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  raycaster.far = (global.max.y - global.min.y) + 4;
  const gw = global.max.x - global.min.x;
  const gd = global.max.z - global.min.z;
  const stepX = gw / 6;
  const stepZ = gd / 6;
  const y = global.max.y + 1;
  const pts = [];

  for (let ix = 0; ix <= 6; ix++) {
    for (let iz = 0; iz <= 6; iz++) {
      raycaster.set(new THREE.Vector3(global.min.x + ix * stepX, y, global.min.z + iz * stepZ), down);
      const hits = raycaster.intersectObject(model, true);
      if (hits.length) {
        const p = hits[0].point;
        pts.push([+p.x.toFixed(2), +(p.y + 0.05).toFixed(2), +p.z.toFixed(2)]);
      }
    }
  }
  if (!pts.length) return C().SPAWNS.slice();

  // farthest-point spread selection
  const chosen = [pts[0]];
  while (chosen.length < Math.min(n, pts.length)) {
    let best = null, bestD = -1;
    for (const p of pts) {
      if (chosen.some((c) => c[0] === p[0] && c[2] === p[2])) continue;
      let d = Infinity;
      for (const c of chosen) d = Math.min(d, (c[0] - p[0]) ** 2 + (c[2] - p[2]) ** 2);
      if (d > bestD) { bestD = d; best = p; }
    }
    if (!best) break;
    chosen.push(best);
  }
  return chosen;
}

/* Determine the final world (colliders + spawns) for a session.
 * Priority: map.json → auto from map.fbx → built-in defaults. */
export function computeWorld(assets) {
  const cfg = assets.mapJSON || {};
  const cfgColliders = Array.isArray(cfg.colliders) && cfg.colliders.length ? cfg.colliders : null;
  const cfgSpawns = Array.isArray(cfg.spawns) && cfg.spawns.length ? cfg.spawns : null;

  if (assets.map) {
    const auto = {
      colliders: collidersFromModel(assets.map),
      spawns: spawnsFromModel(assets.map)
    };
    return {
      colliders: cfgColliders || auto.colliders,
      spawns: cfgSpawns || auto.spawns,
      custom: true
    };
  }
  if (cfgColliders || cfgSpawns) {
    return {
      colliders: cfgColliders || C().buildColliders(),
      spawns: cfgSpawns || C().SPAWNS,
      custom: true
    };
  }
  return { colliders: C().buildColliders(), spawns: C().SPAWNS, custom: false };
}
