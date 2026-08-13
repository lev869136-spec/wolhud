/* WOLHUD shared config — loaded by the browser (classic <script>, sets window.CONFIG)
 * and by the Node server (CommonJS require). Keep everything UMD-compatible. */
(function (root) {
  'use strict';

  const WEAPONS = {
    knife: {
      key: 'knife', name: 'НОЖ', slot: 3, damage: 65, rate: 600, range: 2.6,
      mag: 1, reload: 0, fireMode: 'melee', auto: false, spread: 0, recoil: 0.4,
      speedMul: 1.0, scope: false, tracer: 'none'
    },
    p350: {
      key: 'p350', name: 'P350', slot: 2, damage: 26, rate: 150, range: 140,
      mag: 12, reserve: 48, reload: 1600, fireMode: 'semi', auto: false,
      spread: 0.006, recoil: 0.7, speedMul: 1.0, scope: false, tracer: 'pistol'
    },
    akr: {
      key: 'akr', name: 'AKR', slot: 1, damage: 30, rate: 105, range: 200,
      mag: 30, reserve: 120, reload: 2200, fireMode: 'auto', auto: true,
      spread: 0.02, recoil: 1.0, speedMul: 0.96, scope: false, tracer: 'rifle'
    },
    awm: {
      key: 'awm', name: 'AWM', slot: 1, damage: 150, rate: 1200, range: 400,
      mag: 5, reserve: 20, reload: 2800, fireMode: 'semi', auto: false,
      spread: 0.001, recoil: 3.4, speedMul: 0.94, scope: true, scopeFov: 18, tracer: 'rifle'
    }
  };

  // y-up. Colliders are axis-aligned boxes: { p:[cx,cy,cz], s:[sx,sy,sz], mat }
  function buildColliders() {
    const L = [];
    const add = (p, s, mat) => L.push({ p, s, mat });
    const H = 23;                       // half arena
    const WH = 4;                       // wall height
    add([0, -1.5, 0], [H * 2 + 4, 3, H * 2 + 4], 'floor');
    add([0, WH / 2, -H - 0.5], [H * 2 + 4, WH, 1], 'wall');
    add([0, WH / 2, H + 0.5], [H * 2 + 4, WH, 1], 'wall');
    add([-H - 0.5, WH / 2, 0], [1, WH, H * 2 + 4], 'wall');
    add([H + 0.5, WH / 2, 0], [1, WH, H * 2 + 4], 'wall');

    // central container (full cover)
    add([0, 1.15, 0], [7.2, 2.3, 4.4], 'metal');

    // low walls (crouch cover)
    add([-6, 0.45, -9], [3, 0.9, 1], 'crate');
    add([6, 0.45, -9], [3, 0.9, 1], 'crate');
    add([-6, 0.45, 9], [3, 0.9, 1], 'crate');
    add([6, 0.45, 9], [3, 0.9, 1], 'crate');
    add([-14, 0.45, 0], [1, 0.9, 5], 'crate');
    add([14, 0.45, 0], [1, 0.9, 5], 'crate');

    // tall crates (full cover)
    add([-10, 1.2, -13], [2, 2.4, 2], 'crate');
    add([10, 1.2, -13], [2, 2.4, 2], 'crate');
    add([-10, 1.2, 13], [2, 2.4, 2], 'crate');
    add([10, 1.2, 13], [2, 2.4, 2], 'crate');
    add([-17, 1.2, -4], [2, 2.4, 2], 'crate');
    add([17, 1.2, -4], [2, 2.4, 2], 'crate');
    add([-17, 1.2, 4], [2, 2.4, 2], 'crate');
    add([17, 1.2, 4], [2, 2.4, 2], 'crate');

    // low jumpable crates (elevation / step-ups)
    add([-4, 0.3, 4], [2, 0.6, 2], 'accent');
    add([4, 0.3, 4], [2, 0.6, 2], 'accent');
    add([-4, 0.3, -4], [2, 0.6, 2], 'accent');
    add([4, 0.3, -4], [2, 0.6, 2], 'accent');
    add([-19, 0.3, 12], [2, 0.6, 2], 'accent');
    add([19, 0.3, 12], [2, 0.6, 2], 'accent');
    add([-19, 0.3, -12], [2, 0.6, 2], 'accent');
    add([19, 0.3, -12], [2, 0.6, 2], 'accent');

    // stacked crates (two-high) around the middle
    add([-8, 0.6, -6], [2, 1.2, 2], 'crate');
    add([8, 0.6, -6], [2, 1.2, 2], 'crate');
    add([-8, 0.6, 6], [2, 1.2, 2], 'crate');
    add([8, 0.6, 6], [2, 1.2, 2], 'crate');

    return L;
  }

  const SPAWNS = [
    [-16, 0, -16], [16, 0, -16], [-16, 0, 16], [16, 0, 16],
    [0, 0, -18], [0, 0, 18], [-18, 0, 0], [18, 0, 0]
  ];

  const CONFIG = {
    NAME: 'WOLHUD',
    TICK: 15,               // server broadcast rate (Hz)
    MAX_PLAYERS: 8,
    HP: 100,
    RESPAWN_TIME: 3.0,
    KILL_LIMIT: 30,
    HEADSHOT_MULT: 2,
    PLAYER: {
      radius: 0.42,
      height: 1.78,
      crouchHeight: 1.15,
      eye: 1.62,
      crouchEye: 1.02,
      walkSpeed: 4.6,
      sprintSpeed: 6.6,
      crouchSpeed: 2.5,
      jumpVel: 5.4,
      gravity: 18,
      airControl: 0.5
    },
    WEAPONS,
    DEFAULT_LOADOUT: ['akr', 'p350', 'knife'],
    MAP: { half: 23, wallHeight: 4 },
    SPAWNS,
    buildColliders
  };

  root.CONFIG = CONFIG;
  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
