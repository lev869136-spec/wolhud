/* WOLHUD shared config — loaded by the browser (classic <script>, sets window.CONFIG)
 * and by the Node server (CommonJS require). Keep everything UMD-compatible. */
(function (root) {
  'use strict';

  /* ---------------- teams ---------------- */
  const TEAMS = {
    t: {
      key: 't',
      name: 'Террористы',
      short: 'Т',
      color: 0xe03a2f,
      pistol: 'glock',
      primary: 'akr'
    },
    ct: {
      key: 'ct',
      name: 'Спецназ',
      short: 'CT',
      color: 0x2f6fe0,
      pistol: 'usp',
      primary: 'm4a4'
    }
  };

  /* ---------------- weapons ----------------
   * team: 't' | 'ct' | 'both'
   * category: 'pistol' | 'smg' | 'rifle' | 'sniper' | 'heavy' | 'melee'
   * Prices & exclusives follow the CS2 buy menu (T vs CT). */
  const WEAPONS = {
    knife: {
      key: 'knife', name: 'Нож', slot: 3, team: 'both', category: 'melee', price: 0,
      damage: 65, rate: 600, range: 2.6, mag: 1, reserve: 0, reload: 0,
      fireMode: 'melee', auto: false, spread: 0, recoil: 0.4, speedMul: 1.0,
      scope: false, tracer: 'none', shape: { kind: 'knife' }
    },

    /* pistols */
    glock: {
      key: 'glock', name: 'Glock-18', slot: 2, team: 't', category: 'pistol', price: 200,
      damage: 24, rate: 110, range: 130, mag: 20, reserve: 120, reload: 1500,
      fireMode: 'semi', auto: false, spread: 0.011, recoil: 0.55, speedMul: 1.0,
      scope: false, tracer: 'pistol', shape: { kind: 'pistol', len: 0.22 }
    },
    usp: {
      key: 'usp', name: 'USP-S', slot: 2, team: 'ct', category: 'pistol', price: 200,
      damage: 30, rate: 180, range: 140, mag: 12, reserve: 24, reload: 1500,
      fireMode: 'semi', auto: false, spread: 0.005, recoil: 0.5, speedMul: 1.0,
      scope: false, tracer: 'pistol', shape: { kind: 'pistol', len: 0.24, silencer: true }
    },
    p250: {
      key: 'p250', name: 'P250', slot: 2, team: 'both', category: 'pistol', price: 300,
      damage: 32, rate: 150, range: 140, mag: 13, reserve: 26, reload: 1600,
      fireMode: 'semi', auto: false, spread: 0.007, recoil: 0.6, speedMul: 1.0,
      scope: false, tracer: 'pistol', shape: { kind: 'pistol', len: 0.22 }
    },
    tec9: {
      key: 'tec9', name: 'Tec-9', slot: 2, team: 't', category: 'pistol', price: 500,
      damage: 26, rate: 90, range: 130, mag: 18, reserve: 90, reload: 1700,
      fireMode: 'auto', auto: true, spread: 0.016, recoil: 0.6, speedMul: 1.0,
      scope: false, tracer: 'pistol', shape: { kind: 'pistol', len: 0.24, magStick: true }
    },
    fiveseven: {
      key: 'fiveseven', name: 'Five-SeveN', slot: 2, team: 'ct', category: 'pistol', price: 500,
      damage: 30, rate: 130, range: 140, mag: 20, reserve: 100, reload: 1700,
      fireMode: 'semi', auto: false, spread: 0.01, recoil: 0.6, speedMul: 1.0,
      scope: false, tracer: 'pistol', shape: { kind: 'pistol', len: 0.24 }
    },
    deagle: {
      key: 'deagle', name: 'Desert Eagle', slot: 2, team: 'both', category: 'pistol', price: 700,
      damage: 55, rate: 260, range: 160, mag: 7, reserve: 35, reload: 1900,
      fireMode: 'semi', auto: false, spread: 0.004, recoil: 1.4, speedMul: 0.99,
      scope: false, tracer: 'pistol', shape: { kind: 'pistol', len: 0.3, big: true }
    },

    /* SMGs */
    mac10: {
      key: 'mac10', name: 'MAC-10', slot: 1, team: 't', category: 'smg', price: 1050,
      damage: 24, rate: 75, range: 150, mag: 30, reserve: 100, reload: 2000,
      fireMode: 'auto', auto: true, spread: 0.021, recoil: 0.75, speedMul: 1.0,
      scope: false, tracer: 'smg', shape: { kind: 'smg', len: 0.4, magStick: true }
    },
    mp9: {
      key: 'mp9', name: 'MP9', slot: 1, team: 'ct', category: 'smg', price: 1250,
      damage: 24, rate: 70, range: 150, mag: 30, reserve: 120, reload: 2000,
      fireMode: 'auto', auto: true, spread: 0.018, recoil: 0.7, speedMul: 1.0,
      scope: false, tracer: 'smg', shape: { kind: 'smg', len: 0.4 }
    },
    mp7: {
      key: 'mp7', name: 'MP7', slot: 1, team: 'both', category: 'smg', price: 1500,
      damage: 25, rate: 70, range: 160, mag: 30, reserve: 120, reload: 2000,
      fireMode: 'auto', auto: true, spread: 0.016, recoil: 0.7, speedMul: 1.0,
      scope: false, tracer: 'smg', shape: { kind: 'smg', len: 0.42, stock: true }
    },
    ump: {
      key: 'ump', name: 'UMP-45', slot: 1, team: 'both', category: 'smg', price: 1200,
      damage: 28, rate: 105, range: 150, mag: 25, reserve: 100, reload: 2000,
      fireMode: 'auto', auto: true, spread: 0.017, recoil: 0.75, speedMul: 0.99,
      scope: false, tracer: 'smg', shape: { kind: 'smg', len: 0.44, stock: true, magStick: true }
    },

    /* rifles */
    galil: {
      key: 'galil', name: 'Galil AR', slot: 1, team: 't', category: 'rifle', price: 1800,
      damage: 27, rate: 100, range: 180, mag: 35, reserve: 90, reload: 2100,
      fireMode: 'auto', auto: true, spread: 0.022, recoil: 0.9, speedMul: 0.97,
      scope: false, tracer: 'rifle', shape: { kind: 'rifle', len: 0.62, magCurved: true, stock: true }
    },
    famas: {
      key: 'famas', name: 'FAMAS', slot: 1, team: 'ct', category: 'rifle', price: 2050,
      damage: 28, rate: 95, range: 180, mag: 25, reserve: 90, reload: 2100,
      fireMode: 'auto', auto: true, spread: 0.018, recoil: 0.85, speedMul: 0.97,
      scope: false, tracer: 'rifle', shape: { kind: 'rifle', len: 0.58, magCurved: true, stock: true, carryHandle: true }
    },
    akr: {
      key: 'akr', name: 'AK-47', slot: 1, team: 't', category: 'rifle', price: 2700,
      damage: 32, rate: 100, range: 200, mag: 30, reserve: 90, reload: 2200,
      fireMode: 'auto', auto: true, spread: 0.02, recoil: 1.0, speedMul: 0.96,
      scope: false, tracer: 'rifle', shape: { kind: 'rifle', len: 0.64, magCurved: true, stock: true, wood: true }
    },
    m4a4: {
      key: 'm4a4', name: 'M4A4', slot: 1, team: 'ct', category: 'rifle', price: 3100,
      damage: 29, rate: 90, range: 200, mag: 30, reserve: 90, reload: 2100,
      fireMode: 'auto', auto: true, spread: 0.017, recoil: 0.85, speedMul: 0.97,
      scope: false, tracer: 'rifle', shape: { kind: 'rifle', len: 0.64, magStraight: true, stock: true, carryHandle: true }
    },
    aug: {
      key: 'aug', name: 'AUG', slot: 1, team: 'ct', category: 'rifle', price: 3300,
      damage: 29, rate: 90, range: 200, mag: 30, reserve: 90, reload: 2100,
      fireMode: 'auto', auto: true, spread: 0.016, recoil: 0.85, speedMul: 0.97,
      scope: true, scopeFov: 30, tracer: 'rifle',
      shape: { kind: 'rifle', len: 0.6, magStraight: true, stock: true, scope: true }
    },
    sg553: {
      key: 'sg553', name: 'SG 553', slot: 1, team: 't', category: 'rifle', price: 3000,
      damage: 30, rate: 95, range: 200, mag: 30, reserve: 90, reload: 2100,
      fireMode: 'auto', auto: true, spread: 0.018, recoil: 0.9, speedMul: 0.96,
      scope: true, scopeFov: 30, tracer: 'rifle',
      shape: { kind: 'rifle', len: 0.62, magCurved: true, stock: true, scope: true }
    },

    /* snipers */
    scout: {
      key: 'scout', name: 'SSG 08', slot: 1, team: 'both', category: 'sniper', price: 1700,
      damage: 72, rate: 900, range: 300, mag: 10, reserve: 30, reload: 2300,
      fireMode: 'semi', auto: false, spread: 0.002, recoil: 2.2, speedMul: 0.96,
      scope: true, scopeFov: 22, tracer: 'rifle',
      shape: { kind: 'sniper', len: 0.8, scope: true, magStraight: true, stock: true }
    },
    awm: {
      key: 'awm', name: 'AWP', slot: 1, team: 'both', category: 'sniper', price: 4750,
      damage: 150, rate: 1200, range: 400, mag: 5, reserve: 20, reload: 2800,
      fireMode: 'semi', auto: false, spread: 0.001, recoil: 3.4, speedMul: 0.94,
      scope: true, scopeFov: 18, tracer: 'rifle',
      shape: { kind: 'sniper', len: 0.9, scope: true, magStraight: true, stock: true }
    },

    /* heavy */
    m249: {
      key: 'm249', name: 'M249', slot: 1, team: 'both', category: 'heavy', price: 5200,
      damage: 27, rate: 80, range: 200, mag: 100, reserve: 200, reload: 3500,
      fireMode: 'auto', auto: true, spread: 0.024, recoil: 1.0, speedMul: 0.93,
      scope: false, tracer: 'rifle', shape: { kind: 'heavy', len: 0.8, boxMag: true, stock: true }
    }
  };

  const BUY_CATEGORIES = [
    { key: 'pistol', name: 'Пистолеты' },
    { key: 'smg', name: 'ПП' },
    { key: 'rifle', name: 'Винтовки' },
    { key: 'sniper', name: 'Снайперские' },
    { key: 'heavy', name: 'Тяжёлое' }
  ];

  function weaponsForTeam(teamKey) {
    const out = [];
    for (const k in WEAPONS) {
      const w = WEAPONS[k];
      if (w.category === 'melee') continue;
      if (w.team === 'both' || w.team === teamKey) out.push(w);
    }
    return out;
  }

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
    HEADSHOT_MULT: 2,
    START_MONEY: 1600,
    KILL_REWARD: 300,
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
    TEAMS,
    WEAPONS,
    BUY_CATEGORIES,
    weaponsForTeam,
    MAP: { half: 23, wallHeight: 4 },
    SPAWNS,
    buildColliders
  };

  root.CONFIG = CONFIG;
  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
