import * as THREE from '/vendor/three.module.js';
import { Net } from './net.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { MenuScene } from './menu.js';
import { GameScene } from './game.js';

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
    this.game = null;
    this.scene = this.menu;
    this.waitingToPlay = false;

    this.wireMenu();
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

    $('play-btn').addEventListener('click', () => this.startPlaying());
    nick.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.startPlaying(); });
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

  /* ---------------- net ---------------- */

  wireNet() {
    this.net.onStatus = (connected) => {
      if (this.waitingToPlay) {
        if (!connected) {
          this.waitingToPlay = false;
          this.showConnecting(false);
          this.setLobby('Не удалось подключиться к серверу', false);
        }
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

  /* ---------------- play / leave ---------------- */

  startPlaying() {
    const name = $('nick').value.trim().slice(0, 16) || 'Игрок';
    this.saveSettings();
    this.audio.init();
    this.audio.resume();
    this.waitingToPlay = true;
    this.showConnecting(true);
    this.setLobby('Подключение…', false);
    this.net.connect(name);
  }

  startGame(init) {
    if (this.menu) { this.menu.dispose(); this.menu = null; }
    this.game = new GameScene({
      input: this.input,
      audio: this.audio,
      net: this.net,
      settings: this.settings,
      onLeave: () => this.leaveToMenu()
    });
    this.game.start(init);
    this.scene = this.game;
    $('menu').classList.add('hidden');
    $('hud').classList.remove('hidden');
    this.onResize();
  }

  leaveToMenu() {
    if (this.game) { this.game.stop(); this.game = null; }
    this.net.close();
    this.menu = new MenuScene();
    this.scene = this.menu;
    $('hud').classList.add('hidden');
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
