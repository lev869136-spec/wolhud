'use strict';

const fs = require('fs');
const path = require('path');
const CONFIG = require('../public/js/config.js');

/* ----------------------------- small math ----------------------------- */

const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const sub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const scale = (a, s) => v3(a.x * s, a.y * s, a.z * s);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.sqrt(dot(a, a));
const norm = (a) => { const l = len(a) || 1; return v3(a.x / l, a.y / l, a.z / l); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* Ray vs axis-aligned box (slab method). Returns t or Infinity. */
function rayAABB(o, d, min, max) {
  let tmin = -Infinity, tmax = Infinity;
  const os = [o.x, o.y, o.z], ds = [d.x, d.y, d.z];
  const mn = [min.x, min.y, min.z], mx = [max.x, max.y, max.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(ds[i]) < 1e-9) {
      if (os[i] < mn[i] || os[i] > mx[i]) return Infinity;
    } else {
      let t1 = (mn[i] - os[i]) / ds[i];
      let t2 = (mx[i] - os[i]) / ds[i];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin >= 0 ? tmin : Infinity;
}

/* Closest-point parameters between two segments (Ericson, Real-Time Collision Detection). */
function segSeg(p1, q1, p2, q2) {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s, t;
  const EPS = 1e-9;
  if (a <= EPS && e <= EPS) { s = 0; t = 0; return { s, t, d: len(r) }; }
  if (a <= EPS) { s = 0; t = clamp(f / e, 0, 1); }
  else {
    const c = dot(d1, r);
    if (e <= EPS) { t = 0; s = clamp(-c / a, 0, 1); }
    else {
      const b = dot(d1, d2);
      const denom = a * e - b * b;
      s = denom !== 0 ? clamp((b * f - c * e) / denom, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); }
      else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  const c1 = add(p1, scale(d1, s));
  const c2 = add(p2, scale(d2, t));
  return { s, t, d: len(sub(c1, c2)) };
}

/* Ray vs vertical capsule (segment a->b with radius). Returns { t, point, segY } or null. */
function rayCapsule(o, d, a, b, radius, maxDist) {
  const far = add(o, scale(d, maxDist));
  const r = segSeg(o, far, a, b);
  if (r.d > radius) return null;
  // refine: solve along the ray for exact entry distance
  const ab = sub(b, a);
  const ao = sub(o, a);
  const abab = dot(ab, ab);
  // project: distance from ray to capsule axis squared
  const t = clamp(dot(ao, ab) / (abab || 1), 0, 1);
  const axisPoint = add(a, scale(ab, t));
  const m = sub(o, axisPoint);
  const bProj = dot(m, d);
  const cProj = dot(m, m) - radius * radius;
  const disc = bProj * bProj - cProj;
  if (disc < 0) return null;
  let tHit = -bProj - Math.sqrt(disc);
  if (tHit < 0 || tHit > maxDist) return null;
  const point = add(o, scale(d, tHit));
  return { t: tHit, point, segY: axisPoint.y };
}

/* ----------------------------- game room ------------------------------ */

/* Per-player color: team base (T red / CT blue) with a slight lightness
 * variation so teammates remain distinguishable. */
function teamColor(teamKey, id) {
  const def = CONFIG.TEAMS[teamKey] ? CONFIG.TEAMS[teamKey] : CONFIG.TEAMS.t;
  const c = def.color >>> 0;
  const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
  const f = 0.88 + ((id % 3) * 0.08);
  return ((Math.min(255, Math.round(r * f)) << 16) |
          (Math.min(255, Math.round(g * f)) << 8) |
          Math.min(255, Math.round(b * f)));
}

/* Authoritative world (colliders + spawns) from assets/map.json if present. */
function loadWorldFromDisk() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'map.json'), 'utf8');
    const j = JSON.parse(raw);
    if (j && Array.isArray(j.colliders) && j.colliders.length) {
      const colliders = j.colliders.filter(
        (c) => c && Array.isArray(c.p) && c.p.length === 3 && Array.isArray(c.s) && c.s.length === 3
      );
      const spawns = (Array.isArray(j.spawns) && j.spawns.length) ? j.spawns : CONFIG.SPAWNS;
      if (colliders.length) return { colliders, spawns, custom: true };
    }
  } catch (e) { /* no map.json — built-in map */ }
  return { colliders: CONFIG.buildColliders(), spawns: CONFIG.SPAWNS, custom: false };
}

function sanitizeWorld(world) {
  if (!world || !Array.isArray(world.colliders) || !world.colliders.length) return null;
  const colliders = world.colliders.filter(
    (c) => c && Array.isArray(c.p) && c.p.length === 3 && Array.isArray(c.s) && c.s.length === 3
  ).slice(0, 512);
  if (!colliders.length) return null;
  const spawns = (Array.isArray(world.spawns) && world.spawns.length) ? world.spawns : CONFIG.SPAWNS;
  return { colliders, spawns, custom: true };
}

class Room {
  constructor(id, world) {
    this.id = id;
    this.players = new Map(); // id -> player
    this.max = CONFIG.MAX_PLAYERS;
    this.world = world;
  }

  addPlayer(socket, team) {
    const id = this.nextId();
    const spawn = this.world.spawns[(id - 1) % this.world.spawns.length];
    const teamKey = CONFIG.TEAMS[team] ? team : 't';
    const teamDef = CONFIG.TEAMS[teamKey];
    const player = {
      id,
      name: String(socket.name || 'Player').slice(0, 16) || 'Player',
      team: teamKey,
      color: teamColor(teamKey, id),
      money: CONFIG.START_MONEY,
      loadout: { 1: null, 2: teamDef.pistol, 3: 'knife' },
      pos: { x: spawn[0], y: spawn[1], z: spawn[2] },
      vel: v3(),
      yaw: 0,
      pitch: 0,
      crouch: false,
      sprint: false,
      grounded: false,
      weapon: teamDef.pistol,
      hp: CONFIG.HP,
      alive: true,
      kills: 0,
      deaths: 0,
      score: 0,
      respawnAt: 0,
      reloading: false,
      ammo: this.freshAmmo(),
      lastShot: {},
      lastState: 0,
      socket
    };
    this.players.set(id, player);
    return player;
  }

  freshAmmo() {
    const a = {};
    for (const k in CONFIG.WEAPONS) a[k] = { mag: CONFIG.WEAPONS[k].mag, reserve: CONFIG.WEAPONS[k].reserve || 0 };
    return a;
  }

  nextId() {
    let i = 1;
    while (this.players.has(i)) i++;
    return i;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    this.players.delete(id);
    return p;
  }

  broadcast(msg, exceptId) {
    const data = JSON.stringify(msg);
    for (const p of this.players.values()) {
      if (p.id === exceptId) continue;
      if (p.socket.readyState === 1) p.socket.send(data);
    }
  }

  sendTo(id, msg) {
    const p = this.players.get(id);
    if (p && p.socket.readyState === 1) p.socket.send(JSON.stringify(msg));
  }

  /* state update — called every tick.
   * Movement is client-authoritative (standard for casual web FPS); the server
   * only clamps/validates incoming positions and handles respawn + combat. */
  update(dt) {
    const now = Date.now();
    for (const p of this.players.values()) {
      if (!p.alive && p.respawnAt && now >= p.respawnAt) this.respawn(p);
    }
  }

  respawn(p) {
    const spawn = this.world.spawns[(p.id - 1) % this.world.spawns.length];
    p.alive = true;
    p.hp = CONFIG.HP;
    p.pos = v3(spawn[0], spawn[1], spawn[2]);
    p.vel = v3();
    p.ammo = this.freshAmmo();
    // keep bought loadout; fall back to team pistol
    p.weapon = p.loadout[1] || p.loadout[2] || 'knife';
    p.reloading = false;
    p.respawnAt = 0;
  }

  snapshot() {
    const players = {};
    for (const p of this.players.values()) {
      players[p.id] = {
        p: [round(p.pos.x), round(p.pos.y), round(p.pos.z)],
        yaw: round(p.yaw), pitch: round(p.pitch),
        c: p.crouch, s: p.sprint, w: p.weapon,
        hp: p.hp, alive: p.alive, k: p.kills, d: p.deaths, sc: p.score,
        name: p.name, color: p.color, team: p.team, reloading: p.reloading,
        money: p.money, loadout: p.loadout, ammo: p.ammo
      };
    }
    return players;
  }

  /* authoritative shooting */
  handleShoot(p, msg) {
    if (!p.alive || p.reloading) return;
    const w = CONFIG.WEAPONS[p.weapon];   // server-owned weapon (ignore client msg.w)
    if (!w) return;
    const now = Date.now();
    const lastShot = p.lastShot[w.key] || 0;
    if (now - lastShot < w.rate * 0.9) return;
    const ammo = p.ammo[w.key];
    if (w.fireMode !== 'melee') {
      if (!ammo || ammo.mag <= 0) return;
      ammo.mag--;
    }
    p.lastShot[w.key] = now;

    const origin = v3(msg.o[0], msg.o[1], msg.o[2]);
    const dir = norm(v3(msg.d[0], msg.d[1], msg.d[2]));
    const range = w.range;

    // world hit
    let tWall = Infinity;
    for (const c of this.world.colliders) {
      const min = { x: c.p[0] - c.s[0] / 2, y: c.p[1] - c.s[1] / 2, z: c.p[2] - c.s[2] / 2 };
      const max = { x: c.p[0] + c.s[0] / 2, y: c.p[1] + c.s[1] / 2, z: c.p[2] + c.s[2] / 2 };
      const t = rayAABB(origin, dir, min, max);
      if (t < tWall) tWall = t;
    }

    // player hit
    let hitPlayer = null, hitInfo = null;
    for (const q of this.players.values()) {
      if (q.id === p.id || !q.alive) continue;
      const h = q.crouch ? CONFIG.PLAYER.crouchHeight : CONFIG.PLAYER.height;
      const a = v3(q.pos.x, q.pos.y + 0.35, q.pos.z);
      const b = v3(q.pos.x, q.pos.y + h - 0.15, q.pos.z);
      const r = CONFIG.PLAYER.radius + 0.06;
      const res = rayCapsule(origin, dir, a, b, r, range);
      if (res && res.t < tWall && (!hitInfo || res.t < hitInfo.t)) {
        hitInfo = res;
        hitPlayer = q;
      }
    }

    const tracer = {
      type: 'shot',
      id: p.id, w: w.key,
      o: [round(origin.x), round(origin.y), round(origin.z)],
      hit: null, wall: false, head: false, hitId: null
    };

    if (hitPlayer) {
      const head = hitInfo.segY >= hitPlayer.pos.y + CONFIG.PLAYER.eye - 0.22;
      const dmg = Math.round(w.damage * (head ? CONFIG.HEADSHOT_MULT : 1));
      hitPlayer.hp -= dmg;
      tracer.hit = [round(hitInfo.point.x), round(hitInfo.point.y), round(hitInfo.point.z)];
      tracer.head = head;
      tracer.hitId = hitPlayer.id;

      this.broadcast(tracer);
      this.broadcast({ type: 'hit', target: hitPlayer.id, shooter: p.id, hp: Math.max(0, hitPlayer.hp), head });

      if (hitPlayer.hp <= 0) {
        hitPlayer.alive = false;
        hitPlayer.deaths++;
        hitPlayer.respawnAt = Date.now() + CONFIG.RESPAWN_TIME * 1000;
        p.kills++;
        p.score += head ? 3 : 1;
        p.money += CONFIG.KILL_REWARD;
        const killMsg = { type: 'killed', victim: hitPlayer.id, killer: p.id, w: w.key, head };
        this.broadcast(killMsg);
        this.sendTo(hitPlayer.id, { type: 'death', killer: p.id, kname: p.name, w: w.key, respawn: CONFIG.RESPAWN_TIME * 1000 });
      }
    } else {
      if (tWall < range) {
        const pt = add(origin, scale(dir, tWall));
        tracer.hit = [round(pt.x), round(pt.y), round(pt.z)];
        tracer.wall = true;
      }
      this.broadcast(tracer);
    }
  }

  handleReload(p, msg) {
    if (!p.alive || p.reloading) return;
    const w = CONFIG.WEAPONS[msg.w];
    if (!w || w.fireMode === 'melee') return;
    const ammo = p.ammo[w.key];
    if (!ammo || ammo.mag >= w.mag || ammo.reserve <= 0) return;
    p.reloading = true;
    this.broadcast({ type: 'reload', id: p.id, w: w.key, ms: w.reload });
    setTimeout(() => {
      if (!this.players.has(p.id)) return;
      const need = w.mag - ammo.mag;
      const take = Math.min(need, ammo.reserve);
      ammo.mag += take;
      ammo.reserve -= take;
      p.reloading = false;
      this.broadcast({ type: 'reload_done', id: p.id, w: w.key, mag: ammo.mag, reserve: ammo.reserve });
    }, w.reload);
  }

  /* Buy menu — team-specific weapon purchase. */
  handleBuy(p, msg) {
    if (!p.alive) return this.sendTo(p.id, { type: 'buy_fail', reason: 'dead' });
    const w = CONFIG.WEAPONS[msg.w];
    if (!w || w.category === 'melee') return this.sendTo(p.id, { type: 'buy_fail', reason: 'bad' });
    if (w.team !== 'both' && w.team !== p.team) {
      return this.sendTo(p.id, { type: 'buy_fail', reason: 'team' });
    }
    if (p.money < w.price) return this.sendTo(p.id, { type: 'buy_fail', reason: 'money' });

    p.money -= w.price;
    if (w.slot === 1) p.loadout[1] = w.key;
    else if (w.slot === 2) p.loadout[2] = w.key;
    // full ammo for the purchased weapon
    p.ammo[w.key] = { mag: w.mag, reserve: w.reserve || 0 };
    p.weapon = w.key;
    p.reloading = false;
    this.sendTo(p.id, { type: 'buy_ok', w: w.key, money: p.money, loadout: p.loadout });
  }
}

function round(n) { return Math.round(n * 100) / 100; }

/* ----------------------------- game ------------------------------ */

class Game {
  constructor() {
    this.rooms = new Map(); // socket -> room  (each socket = one player)
    this.roomByPlayer = new Map(); // playerId -> room
    this.roomCounter = 0;
    this.lastTick = Date.now();
    this.serverWorld = loadWorldFromDisk();
  }

  room() {
    // simple quick-play: fill one room, create a new one when full
    let target = null;
    for (const r of this.rooms.values()) {
      if (r.players.size < r.max) { target = r; break; }
    }
    if (!target) {
      this.roomCounter++;
      const world = this.serverWorld.custom
        ? this.serverWorld
        : { colliders: this.serverWorld.colliders, spawns: this.serverWorld.spawns, custom: false };
      target = new Room(this.roomCounter, world);
      this.rooms.set(this.roomCounter, target);
    }
    return target;
  }

  listRooms() {
    const out = [];
    for (const r of this.rooms.values()) {
      out.push({ id: r.id, players: r.players.size, max: r.max });
    }
    return out;
  }

  join(socket, name, worldMsg, team) {
    socket.name = name;
    const room = this.room();
    // Adopt a client-generated world (FBX auto-colliders) if this room has no
    // authoritative map.json yet. First joiner defines the world for the room.
    if (!room.world.custom && room.players.size === 0) {
      const w = sanitizeWorld(worldMsg);
      if (w) room.world = w;
    }
    const player = room.addPlayer(socket, team);
    this.roomByPlayer.set(player.id, room);
    socket.playerId = player.id;
    socket.room = room;

    socket.send(JSON.stringify({
      type: 'init',
      id: player.id,
      name: player.name,
      color: player.color,
      team: player.team,
      money: player.money,
      loadout: player.loadout,
      room: room.id,
      players: room.snapshot()
    }));
    room.broadcast({
      type: 'player_join',
      id: player.id, name: player.name, color: player.color, team: player.team,
      w: player.weapon, p: [player.pos.x, player.pos.y, player.pos.z]
    }, player.id);
    return player;
  }

  leave(socket) {
    const room = socket.room;
    if (!room) return;
    const p = room.removePlayer(socket.playerId);
    this.roomByPlayer.delete(socket.playerId);
    socket.room = null;
    socket.playerId = null;
    if (p) room.broadcast({ type: 'player_leave', id: p.id });
    if (room.players.size === 0) this.rooms.delete(room.id);
  }

  handleMessage(socket, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const room = socket.room;
    if (!room) return;
    const p = room.players.get(socket.playerId);
    if (!p) return;

    switch (msg.type) {
      case 'state': {
        if (!p.alive) break;
        if (msg.p && msg.p.length === 3) {
          const nx = clamp(msg.p[0], -1000, 1000);
          const ny = clamp(msg.p[1], -100, 1000);
          const nz = clamp(msg.p[2], -1000, 1000);
          // sanity: reject huge teleports (spawn/death are handled server-side)
          const dx = nx - p.pos.x, dy = ny - p.pos.y, dz = nz - p.pos.z;
          if (dx * dx + dz * dz < 400 && dy * dy < 400) {
            p.pos.x = nx; p.pos.y = ny; p.pos.z = nz;
          }
        }
        if (typeof msg.yaw === 'number') p.yaw = msg.yaw;
        if (typeof msg.pitch === 'number') p.pitch = clamp(msg.pitch, -89, 89);
        p.crouch = !!msg.c;
        p.sprint = !!msg.s;
        if (msg.w && CONFIG.WEAPONS[msg.w]) {
          // only allow switching to a weapon the player actually owns
          const owned = msg.w === p.loadout[1] || msg.w === p.loadout[2] || msg.w === p.loadout[3];
          if (owned) p.weapon = msg.w;
        }
        break;
      }
      case 'shoot': room.handleShoot(p, msg); break;
      case 'buy': room.handleBuy(p, msg); break;
      case 'reload': room.handleReload(p, msg); break;
      case 'respawn': if (!p.alive) room.respawn(p); break;
      case 'chat': {
        const text = String(msg.t || '').slice(0, 120);
        if (text.trim()) room.broadcast({ type: 'chat', id: p.id, name: p.name, t: text });
        break;
      }
      case 'ping': {
        if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'pong', t0: msg.t0 }));
        break;
      }
    }
  }

  tick() {
    const now = Date.now();
    let dt = (now - this.lastTick) / 1000;
    this.lastTick = now;
    if (dt > 0.1) dt = 0.1;
    for (const room of this.rooms.values()) {
      room.update(dt);
      const snap = room.snapshot();
      room.broadcast({ type: 'snapshot', players: snap });
    }
  }
}

module.exports = { Game, CONFIG };
