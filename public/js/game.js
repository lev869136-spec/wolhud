import * as THREE from '/vendor/three.module.js';
import {
  makeSky, makeLights, buildMap, makeDust, updateDust,
  makeCharacter, makeNameTag, glowTexture, mat
} from './world.js';
import { buildWeaponViewmodel } from './weapons.js';

const C = () => window.CONFIG;
const P = () => window.CONFIG.PLAYER;
const $ = (id) => document.getElementById(id);

export class GameScene {
  constructor(deps) {
    this.deps = deps; // { input, audio, net, settings, onLeave }
    this.active = false;
    this.t = 0;
    this.remotes = new Map();
    this.effects = [];
    this._stateTimer = 0;
    this.myName = '';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xaebfce);
    this.scene.fog = new THREE.Fog(0xaebfce, 40, 160);
    this.scene.add(makeSky());
    makeLights(this.scene);
    this.dust = makeDust(this.scene, 160, 70, 12);

    this.colliders = C().buildColliders().map((c) => ({
      minX: c.p[0] - c.s[0] / 2, maxX: c.p[0] + c.s[0] / 2,
      minY: c.p[1] - c.s[1] / 2, maxY: c.p[1] + c.s[1] / 2,
      minZ: c.p[2] - c.s[2] / 2, maxZ: c.p[2] + c.s[2] / 2
    }));
  }

  /* ---------------- lifecycle ---------------- */

  start(init) {
    this.active = true;
    this.myId = init.id;
    this.myName = init.name;
    this.t = 0;
    this.paused = true;      // wait for "click to play" (user gesture for pointer lock)
    this.playing = true;
    this.chatting = false;

    buildMap(this.scene);

    // DOM
    this.dom = {
      crosshair: $('crosshair'),
      chT: document.querySelector('#crosshair .ch-t'),
      chB: document.querySelector('#crosshair .ch-b'),
      chL: document.querySelector('#crosshair .ch-l'),
      chR: document.querySelector('#crosshair .ch-r'),
      hitmarker: $('hitmarker'),
      damageFlash: $('damage-flash'),
      hpFill: $('hp-fill'),
      hpNum: $('hp-num'),
      weaponName: $('weapon-name'),
      ammoNum: $('ammo-num'),
      killfeed: $('killfeed'),
      chatLog: $('chat-log'),
      chatInput: $('chat-input'),
      deathScreen: $('death-screen'),
      deathBy: $('death-by'),
      deathCount: $('death-count'),
      pauseMenu: $('pause-menu'),
      scope: $('scope-overlay'),
      scoreboard: $('scoreboard'),
      sbTable: $('sb-table'),
      timer: $('timer'),
      ping: $('ping'),
      resumeBtn: $('resume-btn'),
      leaveBtn: $('leave-btn'),
      sens2: $('sens2'),
      vol2: $('vol2'),
      startOverlay: $('start-overlay')
    };

    // camera
    this.camera = new THREE.PerspectiveCamera(this.deps.settings.fov, 1, 0.05, 600);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.fov = this.deps.settings.fov;

    // local player state
    const spawn = C().SPAWNS[(init.id - 1) % C().SPAWNS.length];
    this.pos = new THREE.Vector3(spawn[0], spawn[1], spawn[2]);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.grounded = false; this.crouch = false; this.sprint = false; this.ads = false;
    this.alive = true; this.hp = C().HP;
    this.weapon = 'akr';
    this.reloading = false; this.reloadTimer = 0; this.switchTimer = 0;
    this.recoil = 0; this.camKick = 0; this.lastShot = 0; this.bobTime = 0;
    this.eyeH = P().eye; this.respawnAt = 0;
    this._me = { k: 0, d: 0, sc: 0 };

    this.ammo = {};
    for (const k in C().WEAPONS) this.ammo[k] = { mag: C().WEAPONS[k].mag, reserve: C().WEAPONS[k].reserve || 0 };

    // viewmodel
    this.viewmodel = new THREE.Group();
    this.camera.add(this.viewmodel);
    this.arms = this.buildArms();
    this.viewmodel.add(this.arms);
    this.weapons = {};
    for (const k of C().DEFAULT_LOADOUT) {
      this.weapons[k] = buildWeaponViewmodel(k);
      this.weapons[k].group.visible = (k === this.weapon);
      this.viewmodel.add(this.weapons[k].group);
    }
    this._vmPos = new THREE.Vector3(0.24, -0.24, -0.42);

    this.dom.scope.classList.add('hidden');

    // register remotes
    for (const id in init.players) {
      if (+id !== this.myId) this.addRemote(+id, init.players[id]);
    }

    // net wiring
    this._netHandlers = {
      snapshot: (m) => this.onSnapshot(m),
      player_join: (m) => this.onJoin(m),
      player_leave: (m) => this.onLeave(m),
      shot: (m) => this.onShot(m),
      hit: (m) => this.onHit(m),
      killed: (m) => this.onKilled(m),
      death: (m) => this.onDeath(m),
      reload: (m) => this.onReload(m),
      reload_done: (m) => this.onReloadDone(m),
      chat: (m) => this.onChat(m),
      pong: (p) => { this.dom.ping.textContent = p + ' ms'; }
    };
    for (const type in this._netHandlers) this.deps.net.on(type, this._netHandlers[type]);

    this.deps.input.onLock = (locked) => this.onLockChange(locked);
    this.dom.resumeBtn.onclick = () => { this.paused = false; this.dom.pauseMenu.classList.add('hidden'); this.deps.input.lock(); };
    this.dom.leaveBtn.onclick = () => { this._leaving = true; this.paused = false; this.deps.onLeave(); };
    this.dom.sens2.oninput = () => { this.deps.settings.sens = parseFloat(this.dom.sens2.value); };
    this.dom.vol2.oninput = () => { this.deps.settings.volume = this.dom.vol2.value / 100; this.deps.audio.setVolume(this.deps.settings.volume); };
    this.dom.chatInput.addEventListener('keydown', (e) => this.onChatKey(e));
    this.dom.startOverlay.onclick = () => {
      this.dom.startOverlay.classList.add('hidden');
      this.paused = false;
      this.deps.audio.init();
      this.deps.audio.resume();
      this.deps.input.lock();
    };

    // apply settings sliders
    this.dom.sens2.value = this.deps.settings.sens;
    this.dom.vol2.value = Math.round(this.deps.settings.volume * 100);

    this.dom.startOverlay.classList.remove('hidden');
    this.dom.pauseMenu.classList.add('hidden');
    this.updateHUD();
  }

  stop() {
    this.active = false;
    this.deps.input.onLock = null;
    this.deps.input.unlock();
    this.dom.scope.classList.add('hidden');
    this.dom.pauseMenu.classList.add('hidden');
    this.dom.deathScreen.classList.add('hidden');
    for (const type in this._netHandlers) {
      const h = this._netHandlers[type];
      const list = this.deps.net.handlers[type];
      if (list) {
        const i = list.indexOf(h);
        if (i >= 0) list.splice(i, 1);
      }
    }
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }

  resize(w, h) {
    if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  }

  currentWeapon() { return C().WEAPONS[this.weapon] || C().WEAPONS.akr; }

  /* ---------------- remotes ---------------- */

  addRemote(id, data) {
    const group = makeCharacter(data.color);
    const tag = makeNameTag(data.name || ('Игрок ' + id), data.color);
    group.add(tag.sprite);
    group.visible = data.alive !== false;
    this.scene.add(group);
    const r = {
      id, group, tag,
      cx: data.p[0], cy: data.p[1], cz: data.p[2],
      tx: data.p[0], ty: data.p[1], tz: data.p[2],
      yaw: data.yaw || 0, tyaw: data.yaw || 0,
      hp: data.hp ?? C().HP, alive: data.alive !== false,
      name: data.name, color: data.color || 0xffffff,
      k: data.k || 0, d: data.d || 0, sc: data.sc || 0, animT: 0
    };
    this.remotes.set(id, r);
    return r;
  }

  removeRemote(id) {
    const r = this.remotes.get(id);
    if (r) { this.scene.remove(r.group); this.disposeGroup(r.group); this.remotes.delete(id); }
  }

  disposeGroup(g) {
    g.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }

  /* ---------------- net handlers ---------------- */

  onSnapshot(m) {
    if (!this.active) return;
    for (const id in m.players) {
      const p = m.players[id];
      if (+id === this.myId) {
        const wasAlive = this.alive;
        this.hp = p.hp;
        this.alive = p.alive;
        this._me = { k: p.k, d: p.d, sc: p.sc };
        for (const k in p.ammo) this.ammo[k] = p.ammo[k];
        if (!wasAlive && this.alive) this.onRespawn(p);
      } else {
        let r = this.remotes.get(+id);
        if (!r) r = this.addRemote(+id, p);
        r.tx = p.p[0]; r.ty = p.p[1]; r.tz = p.p[2];
        r.tyaw = p.yaw; r.hp = p.hp; r.alive = p.alive;
        r.k = p.k; r.d = p.d; r.sc = p.sc; r.name = p.name;
        r.tag.setHp(p.hp, C().HP);
        r.group.visible = p.alive;
      }
    }
    for (const id of this.remotes.keys()) {
      if (!(id in m.players)) this.removeRemote(id);
    }
  }

  onJoin(m) {
    if (!this.active || m.id === this.myId) return;
    if (!this.remotes.has(m.id)) this.addRemote(m.id, {
      name: m.name, color: m.color, p: m.p || [0, 0, 0], yaw: 0, hp: C().HP, alive: true
    });
  }

  onLeave(m) { if (this.active) this.removeRemote(m.id); }

  onShot(m) {
    if (!this.active) return;
    const from = new THREE.Vector3(m.o[0], m.o[1], m.o[2]);
    if (m.hit) {
      const to = new THREE.Vector3(m.hit[0], m.hit[1], m.hit[2]);
      this.spawnTracer(from, to, 0xffe9b8);
      this.spawnImpact(to, m.hitId ? 0xff6a5c : 0xd8cfa8);
    }
  }

  onHit(m) {
    if (!this.active) return;
    const r = this.remotes.get(m.target);
    if (r) r.tag.setHp(m.hp, C().HP);
    if (m.target === this.myId) {
      this.hp = m.hp;
      this.dom.hpFill.style.width = Math.max(0, m.hp) + '%';
      this.dom.hpNum.textContent = Math.max(0, m.hp);
      this.flashDamage();
      this.deps.audio.hurt();
    } else if (m.shooter === this.myId) {
      this.showHitmarker(m.head, false);
      this.deps.audio.hit(false);
    }
  }

  onKilled(m) {
    if (!this.active) return;
    const k = this.remotes.get(m.killer);
    const v = this.remotes.get(m.victim);
    const killerName = m.killer === this.myId ? 'Вы' : (k ? k.name : 'Игрок');
    const victimName = m.victim === this.myId ? 'вы' : (v ? v.name : 'Игрок');
    const w = C().WEAPONS[m.w] ? C().WEAPONS[m.w].name : '';
    this.addKillfeed(killerName, victimName, w, m.head);
    if (m.killer === this.myId) {
      this.showHitmarker(m.head, true);
      this.deps.audio.hit(true);
    }
  }

  onDeath(m) {
    if (!this.active) return;
    this.alive = false;
    this.dom.deathScreen.classList.remove('hidden');
    this.dom.deathBy.textContent = 'Убил: ' + m.kname;
    this.respawnAt = performance.now() + m.respawn;
    this.deps.audio.death();
  }

  onRespawn(p) {
    this.alive = true;
    this.hp = C().HP;
    this.pos.set(p.p[0], p.p[1], p.p[2]);
    this.vel.set(0, 0, 0);
    this.weapon = 'akr';
    this.reloading = false;
    for (const k in this.weapons) this.weapons[k].group.visible = (k === this.weapon);
    this.dom.deathScreen.classList.add('hidden');
    this.dom.damageFlash.style.opacity = '0';
    this.updateHUD();
  }

  onReload(m) { if (m.id === this.myId) { this.reloading = true; this.reloadTimer = m.ms / 1000; } }

  onReloadDone(m) {
    if (m.id === this.myId) {
      this.reloading = false;
      this.ammo[m.w].mag = m.mag;
      this.ammo[m.w].reserve = m.reserve;
    }
  }

  onChat(m) { this.addChat(m.name, m.t); }

  openChat() {
    this.chatting = true;
    this.dom.chatInput.classList.remove('hidden');
    this.dom.chatInput.focus();
    this.deps.input.unlock();
  }

  closeChat() {
    this.chatting = false;
    this.dom.chatInput.classList.add('hidden');
    this.deps.input.lock();
  }

  onChatKey(e) {
    e.stopPropagation();
    if (e.key === 'Enter') {
      const v = this.dom.chatInput.value.trim();
      if (v) this.deps.net.chat(v);
      this.dom.chatInput.value = '';
      this.closeChat();
    } else if (e.key === 'Escape') {
      this.dom.chatInput.value = '';
      this.closeChat();
    }
  }

  /* ---------------- update ---------------- */

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const input = this.deps.input;
    const jp = input.justPressed();
    const jm = input.justMouse();

    if (!this.paused) {
      if (jp.has('Enter') && this.alive && !this.chatting) this.openChat();
      this.updateController(dt, jp);
      this.updateViewmodel(dt);
      this.handleWeaponInput(jp, jm);
      this.sendState(dt);
    }

    this.updateRemotes(dt);
    this.updateEffects(dt);
    this.updateDeathCountdown();
    updateDust(this.dust, this.t, dt);

    // timer
    const mm = Math.floor(this.t / 60), ss = Math.floor(this.t % 60);
    this.dom.timer.textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

    // scoreboard (throttled rebuild)
    const showSb = input.down('Tab') && this.alive;
    this.dom.scoreboard.classList.toggle('hidden', !showSb);
    if (showSb) {
      this._sbTimer = (this._sbTimer || 0) - dt;
      if (this._sbTimer <= 0) { this._sbTimer = 0.5; this.buildScoreboard(); }
    } else {
      this._sbTimer = 0;
    }

    // FOV easing
    const w = this.currentWeapon();
    const targetFov = (this.ads && w.scope) ? w.scopeFov : this.deps.settings.fov * (this.sprint && !this.crouch ? 1.03 : 1);
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 12);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }

  updateController(dt, jp) {
    const input = this.deps.input;
    const w = this.currentWeapon();
    const P_ = P();

    // mouse look
    const m = input.consumeMouse();
    const sens = this.deps.settings.sens * 0.0021 * (this.ads && !w.scope ? 0.6 : 1);
    this.yaw -= m.x * sens;
    this.pitch -= m.y * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.55, 1.55);

    if (!this.alive) {
      // spectate from death spot: look around only
      this.camera.position.set(this.pos.x, this.pos.y + this.eyeH, this.pos.z);
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      return;
    }

    this.crouch = input.down('ControlLeft', 'ControlRight', 'KeyC');

    const f = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const s = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    const moving = f !== 0 || s !== 0;
    this.sprint = input.down('ShiftLeft', 'ShiftRight') && moving && f > 0 && !this.crouch && !this.ads;

    const speed = this.crouch ? P_.crouchSpeed : (this.sprint ? P_.sprintSpeed : P_.walkSpeed);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let mx = -sy * f + cy * s;
    let mz = -cy * f - sy * s;
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml; mz /= ml;
    const ax = mx * speed * w.speedMul, az = mz * speed * w.speedMul;
    const accel = this.grounded ? 14 : 8;
    this.vel.x += (ax - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (az - this.vel.z) * Math.min(1, accel * dt);

    if (jp.has('Space') && this.grounded) {
      this.vel.y = P_.jumpVel;
      this.grounded = false;
      this.deps.audio.jump();
    }

    const targetH = this.crouch ? P_.crouchHeight : P_.height;
    this.eyeH += ((this.crouch ? P_.crouchEye : P_.eye) - this.eyeH) * Math.min(1, dt * 12);
    this.collideMove(dt, targetH);

    this.camera.position.set(this.pos.x, this.pos.y + this.eyeH, this.pos.z);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camKick += (0 - this.camKick) * Math.min(1, dt * 8);
    this.camera.rotation.x += this.camKick;

    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.bobTime += dt * (this.grounded ? hSpeed : 0) * 1.6;

    if (this.grounded && hSpeed > 2.5) {
      this._stepAcc = (this._stepAcc || 0) + dt * (this.sprint ? 9 : 6);
      if (this._stepAcc > 1) { this._stepAcc = 0; this.deps.audio.step(); }
    }
  }

  collideMove(dt, h) {
    const r = P().radius;
    let x = this.pos.x + this.vel.x * dt;
    let z = this.pos.z + this.vel.z * dt;
    for (let it = 0; it < 2; it++) {
      for (const c of this.colliders) {
        if (this.pos.y + h <= c.minY || this.pos.y >= c.maxY) continue;
        const cx = THREE.MathUtils.clamp(x, c.minX, c.maxX);
        const cz = THREE.MathUtils.clamp(z, c.minZ, c.maxZ);
        let dx = x - cx, dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 1e-9) {
            const d = Math.sqrt(d2);
            const push = (r - d) / d;
            x += dx * push; z += dz * push;
          } else {
            const pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
            const mn = Math.min(pl, pr, pt, pb);
            if (mn === pl) x = c.minX - r; else if (mn === pr) x = c.maxX + r;
            else if (mn === pt) z = c.minZ - r; else z = c.maxZ + r;
          }
        }
      }
    }
    this.pos.x = x; this.pos.z = z;

    this.vel.y -= P().gravity * dt;
    const prevY = this.pos.y;
    this.pos.y += this.vel.y * dt;

    let ground = -Infinity;
    for (const c of this.colliders) {
      if (this.pos.x > c.minX - r && this.pos.x < c.maxX + r &&
          this.pos.z > c.minZ - r && this.pos.z < c.maxZ + r) {
        if (c.maxY <= prevY + 0.001) ground = Math.max(ground, c.maxY);
      }
    }
    if (this.pos.y <= ground && this.vel.y <= 0) {
      this.pos.y = ground;
      this.vel.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    for (const c of this.colliders) {
      if (this.pos.x > c.minX - r && this.pos.x < c.maxX + r &&
          this.pos.z > c.minZ - r && this.pos.z < c.maxZ + r) {
        if (this.vel.y > 0 && c.minY > this.pos.y + 0.001 && c.minY < this.pos.y + h) {
          this.pos.y = c.minY - h;
          this.vel.y = 0;
        }
      }
    }

    const H = C().MAP.half;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -H + r, H - r);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -H + r, H - r);
    if (this.pos.y < -20) { this.pos.y = 0; this.vel.y = 0; }
  }

  handleWeaponInput(jp, jm) {
    const input = this.deps.input;

    if (jp.has('Digit1') && this.weapons.akr) this.selectWeapon('akr');
    if (jp.has('Digit2') && this.weapons.p350) this.selectWeapon('p350');
    if (jp.has('Digit3') && this.weapons.knife) this.selectWeapon('knife');

    this.ads = input.mouseDown.right && this.currentWeapon().key !== 'knife';
    const scoped = this.ads && this.currentWeapon().scope;
    this.dom.scope.classList.toggle('hidden', !scoped);
    this.dom.crosshair.style.display = scoped ? 'none' : '';
    for (const k in this.weapons) this.weapons[k].group.visible = !scoped && k === this.weapon;

    if (jp.has('KeyR') && !this.reloading && this.currentWeapon().fireMode !== 'melee') {
      const a = this.ammo[this.weapon];
      if (a && a.mag < this.currentWeapon().mag && a.reserve > 0) {
        this.deps.net.reload(this.weapon);
        this.deps.audio.reload();
      }
    }

    const w = this.currentWeapon();
    const wantFire = w.fireMode === 'auto' ? input.mouseDown.left : (input.mouseDown.left && jm.has(0));
    if (wantFire && this.alive && !this.reloading && this.switchTimer <= 0) {
      const now = performance.now();
      if (now - this.lastShot >= w.rate) {
        this.fire();
        this.lastShot = now;
      }
    }
  }

  selectWeapon(key) {
    if (this.weapon === key || !this.weapons[key]) return;
    this.weapon = key;
    for (const k in this.weapons) this.weapons[k].group.visible = (k === key);
    this.reloading = false;
    this.switchTimer = 0.25;
    this.updateHUD();
  }

  fire() {
    const w = this.currentWeapon();
    const a = this.ammo[this.weapon];
    if (w.fireMode !== 'melee' && a) {
      if (a.mag <= 0) return;
      a.mag--;
    }

    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const moving = Math.hypot(this.vel.x, this.vel.z) > 1;
    let spread = w.spread;
    if (moving) spread *= 1.7;
    if (this.crouch) spread *= 0.8;
    if (this.ads) spread *= 0.35;
    if (w.key === 'knife') spread = 0;
    if (spread > 0) {
      dir.x += (Math.random() - 0.5) * spread;
      dir.y += (Math.random() - 0.5) * spread;
      dir.z += (Math.random() - 0.5) * spread;
      dir.normalize();
    }

    const wm = this.weapons[this.weapon];
    const origin = new THREE.Vector3();
    if (wm) wm.muzzle.getWorldPosition(origin);
    else origin.copy(this.camera.position);

    this.deps.net.shoot([origin.x, origin.y, origin.z], [dir.x, dir.y, dir.z], this.weapon);

    this.recoil = Math.min(1, this.recoil + (w.recoil / 3));
    this.camKick += w.recoil * 0.0045 * (this.ads ? 0.4 : 1);
    if (w.key === 'knife') { this.deps.audio.knife(); this.swing = 1; }
    else { this.deps.audio.shoot(w.tracer); this.flash = 1; }
    this.updateHUD();
  }

  /* ---------------- viewmodel ---------------- */

  buildArms() {
    const g = new THREE.Group();
    const skin = mat(0xc9987a, { roughness: 0.6 });
    const sleeve = mat(0x2b3a4d, { roughness: 0.8 });
    const armGeo = new THREE.BoxGeometry(0.09, 0.3, 0.1);
    const sleeveGeo = new THREE.BoxGeometry(0.1, 0.18, 0.11);
    const rS = new THREE.Mesh(sleeveGeo, sleeve); rS.position.set(0.22, -0.22, -0.34);
    const rA = new THREE.Mesh(armGeo, skin); rA.position.set(0.22, -0.42, -0.38);
    const lS = new THREE.Mesh(sleeveGeo, sleeve); lS.position.set(-0.18, -0.24, -0.42);
    const lA = new THREE.Mesh(armGeo, skin); lA.position.set(-0.18, -0.44, -0.46);
    g.add(rS, rA, lS, lA);
    return g;
  }

  updateViewmodel(dt) {
    const wm = this.weapons[this.weapon];
    if (!wm) return;

    const base = this._vmPos;
    const adsPos = new THREE.Vector3(0, -0.16, -0.34);
    const target = (this.ads && this.currentWeapon().scope) ? adsPos : new THREE.Vector3(0.24, -0.24, -0.42);
    base.lerp(target, Math.min(1, dt * 12));

    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    const bobAmp = this.grounded ? Math.min(0.03, hSpeed * 0.006) : 0.012;
    const bobX = Math.sin(this.bobTime * 2) * bobAmp;
    const bobY = -Math.abs(Math.cos(this.bobTime * 2)) * bobAmp;

    this.recoil += (0 - this.recoil) * Math.min(1, dt * 10);
    const rk = this.recoil * 0.06;

    let reloadDrop = 0, reloadTilt = 0;
    if (this.reloading) {
      this.reloadTimer -= dt;
      const prog = Math.max(0, this.reloadTimer / (this.currentWeapon().reload / 1000));
      const s = Math.sin(Math.min(1, 1 - prog) * Math.PI);
      reloadDrop = -s * 0.22;
      reloadTilt = s * 0.7;
    }

    let swing = 0;
    if (this.swing) {
      this.swing = Math.max(0, this.swing - dt * 4);
      swing = Math.sin((1 - this.swing) * Math.PI) * -0.8;
    }

    let switchDrop = 0;
    if (this.switchTimer > 0) {
      this.switchTimer -= dt;
      switchDrop = -Math.sin(Math.min(1, this.switchTimer / 0.25) * Math.PI) * 0.2;
    }

    const g = wm.group;
    const dx = bobX, dy = bobY + reloadDrop + switchDrop + rk * 0.4, dz = rk;
    g.position.set(base.x + dx, base.y + dy, base.z + dz);
    g.rotation.set(reloadTilt + swing, 0, this.recoil * 0.05);
    // arms group sits at origin; move it by the same animated delta only
    this.arms.position.set(dx, dy, dz);

    if (wm.flash) {
      const fl = wm.flash[0], fs = wm.flash[1];
      if (this.flash) {
        this.flash = Math.max(0, this.flash - dt * 25);
        fl.intensity = 2.5 * this.flash;
        fs.material.opacity = this.flash;
        fs.rotation.z = Math.random() * Math.PI * 2;
      } else {
        fl.intensity = 0;
        fs.material.opacity = 0;
      }
    }
  }

  /* ---------------- effects ---------------- */

  spawnTracer(from, to, color) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    if (len < 0.01) return;
    const geo = new THREE.CylinderGeometry(0.008, 0.008, 1, 5, 1, true);
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.scale.set(1, len, 1);
    this.scene.add(mesh);
    this.effects.push({ mesh, life: 0.06, t: 0, fade: true });
  }

  spawnImpact(at, color) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    sprite.position.copy(at);
    sprite.scale.set(0.2, 0.2, 1);
    this.scene.add(sprite);
    this.effects.push({ mesh: sprite, life: 0.16, t: 0, fade: true, expand: true });
  }

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      if (e.t >= e.life) {
        this.scene.remove(e.mesh);
        if (e.mesh.geometry) e.mesh.geometry.dispose();
        if (e.mesh.material) e.mesh.material.dispose();
        this.effects.splice(i, 1);
        continue;
      }
      e.mesh.material.opacity = 0.9 * (1 - e.t / e.life);
      if (e.expand && e.mesh.isSprite) e.mesh.scale.setScalar(0.2 + e.t * 1.3);
    }
  }

  updateRemotes(dt) {
    const now = performance.now();
    for (const r of this.remotes.values()) {
      if (!r.alive) continue;
      const k = Math.min(1, dt * 10);
      r.cx += (r.tx - r.cx) * k;
      r.cy += (r.ty - r.cy) * k;
      r.cz += (r.tz - r.cz) * k;
      let d = r.tyaw - r.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      r.yaw += d * k;

      r.group.position.set(r.cx, r.cy, r.cz);
      r.group.rotation.y = r.yaw;

      const dx = r.tx - r.cx, dz = r.tz - r.cz;
      const spd = Math.hypot(dx, dz) / Math.max(dt, 0.01);
      const moving = spd > 0.8;
      r.animT += dt * (moving ? spd * 2.4 : 0);
      const u = r.group.userData;
      const swing = moving ? Math.sin(r.animT) * 0.7 : Math.sin(now * 0.001 + r.id) * 0.05;
      u.lLeg.rotation.x = swing;
      u.rLeg.rotation.x = -swing;
      u.lArm.rotation.x = -swing * 0.4;
      u.rArm.rotation.x = swing * 0.4;
    }
  }

  /* ---------------- HUD ---------------- */

  updateHUD() {
    const w = this.currentWeapon();
    this.dom.weaponName.textContent = w.name;
    const a = this.ammo[this.weapon];
    if (w.fireMode === 'melee') this.dom.ammoNum.innerHTML = '—';
    else if (a) this.dom.ammoNum.innerHTML = `${a.mag} <span>/ ${a.reserve}</span>`;
    this.dom.hpFill.style.width = Math.max(0, this.hp) + '%';
    this.dom.hpNum.textContent = Math.max(0, this.hp);
    const moving = Math.hypot(this.vel.x, this.vel.z) > 1;
    const spread = Math.min(1, this.recoil * 0.8 + (moving ? 0.35 : 0) + (this.ads ? -0.2 : 0));
    const off = 8 + spread * 14;
    this.dom.chT.style.top = -off + 'px';
    this.dom.chB.style.top = off + 'px';
    this.dom.chL.style.left = -off + 'px';
    this.dom.chR.style.left = off + 'px';
  }

  showHitmarker(head, kill) {
    const hm = this.dom.hitmarker;
    hm.classList.remove('hidden', 'kill');
    if (kill) hm.classList.add('kill');
    if (this._hmTimer) clearTimeout(this._hmTimer);
    this._hmTimer = setTimeout(() => hm.classList.add('hidden'), 110);
  }

  flashDamage() {
    const el = this.dom.damageFlash;
    el.style.opacity = '1';
    clearTimeout(this._dmgTimer);
    this._dmgTimer = setTimeout(() => { el.style.opacity = '0'; }, 90);
  }

  addKillfeed(killer, victim, weapon, head) {
    const kf = this.dom.killfeed;
    const row = document.createElement('div');
    row.className = 'kf-row' + (head ? ' head' : '');
    row.innerHTML = `<span class="killer"></span> <span class="weapon">${weapon}</span> <span class="victim"></span>`;
    row.querySelector('.killer').textContent = killer;
    row.querySelector('.victim').textContent = victim;
    kf.appendChild(row);
    while (kf.children.length > 5) kf.removeChild(kf.firstChild);
    setTimeout(() => { if (row.parentNode) row.remove(); }, 5000);
  }

  addChat(name, text) {
    const log = this.dom.chatLog;
    const div = document.createElement('div');
    div.className = 'chat-msg';
    const b = document.createElement('b');
    b.textContent = name + ': ';
    div.appendChild(b);
    div.appendChild(document.createTextNode(text));
    log.appendChild(div);
    while (log.children.length > 6) log.removeChild(log.firstChild);
    setTimeout(() => { if (div.parentNode) div.remove(); }, 8000);
  }

  updateDeathCountdown() {
    if (this.alive) return;
    const remain = Math.max(0, (this.respawnAt - performance.now()) / 1000);
    this.dom.deathCount.textContent = 'Возрождение через ' + Math.ceil(remain) + '…';
  }

  buildScoreboard() {
    const rows = [{ name: this.myName, k: this._me.k, d: this._me.d, sc: this._me.sc, me: true, color: 0xff6a3d }];
    for (const r of this.remotes.values()) {
      rows.push({ name: r.name, k: r.k, d: r.d, sc: r.sc, me: false, color: r.color });
    }
    rows.sort((a, b) => b.sc - a.sc || b.k - a.k);
    let html = `<div class="sb-row head"><span></span><span>Игрок</span><span>Убийств</span><span>Смертей</span><span>Счёт</span><span></span></div>`;
    for (const r of rows) {
      const dot = r.me ? '#ff6a3d' : '#' + new THREE.Color(r.color).getHexString();
      html += `<div class="sb-row ${r.me ? 'me' : ''}">
        <span class="sb-dot" style="background:${dot}"></span>
        <span>${esc(r.name)}</span><span>${r.k}</span><span>${r.d}</span><span>${r.sc}</span><span></span></div>`;
    }
    this.dom.sbTable.innerHTML = html;
  }

  sendState(dt) {
    this._stateTimer += dt;
    if (this._stateTimer < 1 / 30) return;
    this._stateTimer = 0;
    if (!this.alive) return;
    this.deps.net.state({
      p: [this.pos.x, this.pos.y, this.pos.z],
      yaw: this.yaw, pitch: this.pitch,
      c: this.crouch, s: this.sprint, w: this.weapon
    });
  }

  onLockChange(locked) {
    if (!this.active) return;
    if (locked) {
      this.paused = false;
      this.dom.pauseMenu.classList.add('hidden');
      this.dom.startOverlay.classList.add('hidden');
    } else if (this.alive && this.playing && !this._leaving && !this.chatting) {
      this.paused = true;
      this.dom.pauseMenu.classList.remove('hidden');
    }
  }

  render(renderer) {
    renderer.render(this.scene, this.camera);
  }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
