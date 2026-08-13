import * as THREE from '/vendor/three.module.js';
import { Net } from './net.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { MenuScene } from './menu.js';
import { LobbyScene } from './lobby.js';
import { GameScene } from './game.js';
import { preloadAssets, computeWorld } from './assets.js';

const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = 'wolhud_settings';

class App {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.settings = this.loadSettings();
    this.audio = new AudioEngine();
    this.audio.setVolume(this.settings.volume);
    this.input = new Input(this.renderer.domElement);
    this.net = new Net();

    this.menu = new MenuScene();
    this.lobby = null;
    this.game = null;
    this.scene = this.menu;
    this.team = 't';
    this.waitingToPlay = false;

    // preload optional FBX assets (non-blocking) and hot-swap the menu hero
    this.assets = { map: null, player: null, playerClips: [], mapJSON: null };
    this.assetsPromise = preloadAssets().then((assets) => {
      this.assets = assets;
      this.world = computeWorld(assets);
      if (this.menu && assets.player) this.menu.setPlayerModel(assets.player, assets.playerClips);
      return assets;
    });

    this.wireMenu();
    this.wireLobby();
    this.wireNet();
    this.pollLobby();

    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);

    window.addEventListener('resize', () => this.onResize());
    this.onResize();
  }

  /* ---------------- settings ---------------- */

  loadSettings() {
    const d = { sens: 1, fov: 85, volume: 0.7, name: '' };
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return Object.assign(d, s);
    } catch { return d; }
  }

  saveSettings() {
    this.settings.name = $('nick').value.trim().slice(0, 16);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch {}
  }

  /* ---------------- menu UI ---------------- */

  wireMenu() {
    const nick = $('nick');
    nick.value = this.settings.name || ('Игрок' + Math.floor(1000 + Math.random() * 9000));

    const bind = (id, key, parse) => {
      const el = $(id);
      el.value = this.settings[key];
      el.addEventListener('input', () => {
        this.settings[key] = parse(el.value);
        if (key === 'volume') this.audio.setVolume(this.settings.volume);
      });
    };
    bind('sens', 'sens', parseFloat);
    bind('fov', 'fov', parseFloat);
    bind('vol', 'volume', (v) => v / 100);

    $('play-btn').addEventListener('click', () => this.openLobby());
    nick.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.openLobby(); });
  }

  /* ---------------- 3D lobby (team select) ---------------- */

  wireLobby() {
    $('lobby-back').addEventListener('click', () => this.backToMenu());
    $('lobby-ready').addEventListener('click', () => this.joinGame());

    const cards = { t: $('team-t'), ct: $('team-ct') };
    for (const key in cards) {
      cards[key].addEventListener('click', () => this.selectTeam(key));
    }
    // fill team-exclusive weapon lists
    for (const key of ['t', 'ct']) {
      const box = $('team-' + key + '-guns');
      const exclusives = [];
      for (const wk in window.CONFIG.WEAPONS) {
        const w = window.CONFIG.WEAPONS[wk];
        if (w.team === key) exclusives.push(w.name);
      }
      box.innerHTML = exclusives.map((n) => `<span class="gun-chip">${n}</span>`).join('');
    }
  }

  selectTeam(key) {
    this.team = key;
    $('team-t').classList.toggle('selected', key === 't');
    $('team-ct').classList.toggle('selected', key === 'ct');
    if (this.lobby) this.lobby.setTeam(key);
  }

  openLobby() {
    this.saveSettings();
    if (this.menu) { this.menu.dispose(); this.menu = null; }
    this.lobby = new LobbyScene(this.assets);
    this.scene = this.lobby;
    this.selectTeam(this.team);
    $('lobby-nick').textContent = $('nick').value.trim().slice(0, 16) || 'Игрок';
    $('menu').classList.add('hidden');
    $('lobby').classList.remove('hidden');
    this.onResize();
  }

  backToMenu() {
    if (this.lobby) { this.lobby.dispose(); this.lobby = null; }
    this.menu = new MenuScene();
    this.scene = this.menu;
    if (this.assets.player) this.menu.setPlayerModel(this.assets.player, this.assets.playerClips);
    $('lobby').classList.add('hidden');
    $('menu').classList.remove('hidden');
    this.onResize();
  }

  /* ---------------- net ---------------- */

  wireNet() {
    this.net.onStatus = (connected) => {
      if (this.waitingToPlay && !connected) {
        this.waitingToPlay = false;
        this.showConnecting(false);
        this.setLobby('Не удалось подключиться к серверу', false);
      }
    };
    this.net.on('init', (m) => {
      if (this.waitingToPlay) {
        this.waitingToPlay = false;
        this.showConnecting(false);
        this.startGame(m);
      } else if (this.game) {
        // reconnected mid-game (e.g. server restart): rebuild the session
        this.startGame(m);
      }
    });
  }

  showConnecting(on) {
    $('connecting').classList.toggle('hidden', !on);
  }

  setLobby(text, ok) {
    const el = $('lobby-status');
    el.textContent = text;
    el.classList.toggle('ok', !!ok);
  }

  pollLobby() {
    fetch('/api/status').then((r) => r.json()).then((s) => {
      if (this.scene === this.menu && this.menu) {
        const total = (s.players || []).reduce((a, r) => a + r.players, 0);
        this.setLobby('Игроков онлайн: ' + total, true);
      }
    }).catch(() => {}).finally(() => setTimeout(() => this.pollLobby(), 5000));
  }

  /* ---------------- play / leave ---------------- */

  async joinGame() {
    const name = $('nick').value.trim().slice(0, 16) || 'Игрок';
    this.saveSettings();
    this.audio.init();
    this.audio.resume();
    this.waitingToPlay = true;
    this.showConnecting(true);
    this.setLobby('Загрузка ресурсов…', false);

    try { await this.assetsPromise; } catch {}
    const world = computeWorld(this.assets);
    this.world = world;

    this.setLobby('Подключение…', false);
    this.net.connect(name, {
      team: this.team,
      world: world.custom ? { colliders: world.colliders, spawns: world.spawns } : undefined
    });
  }

  startGame(init) {
    if (this.menu) { this.menu.dispose(); this.menu = null; }
    if (this.lobby) { this.lobby.dispose(); this.lobby = null; }
    this.game = new GameScene({
      input: this.input,
      audio: this.audio,
      net: this.net,
      settings: this.settings,
      assets: this.assets,
      world: this.world,
      onLeave: () => this.leaveToMenu()
    });
    this.game.start(init);
    this.scene = this.game;
    $('menu').classList.add('hidden');
    $('lobby').classList.add('hidden');
    $('hud').classList.remove('hidden');
    this.onResize();
  }

  leaveToMenu() {
    if (this.game) { this.game.stop(); this.game = null; }
    this.net.close();
    this.menu = new MenuScene();
    this.scene = this.menu;
    if (this.assets.player) this.menu.setPlayerModel(this.assets.player, this.assets.playerClips);
    $('hud').classList.add('hidden');
    $('lobby').classList.add('hidden');
    $('menu').classList.remove('hidden');
    this.onResize();
  }

  /* ---------------- loop ---------------- */

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.scene && this.scene.resize) this.scene.resize(w, h);
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;

    const s = this.scene;
    if (s && s.update) s.update(dt);
    if (s && s.render) s.render(this.renderer);
  }
}

function boot() { window.app = new App(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
