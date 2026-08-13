/* Procedural WebAudio sound engine — no external assets. */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.enabled = true;
    this.master = null;
    this.noiseBuf = null;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      // white-noise buffer for impacts/gunshots
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  setEnabled(e) { this.enabled = e; }

  _noise(t0, dur, gain, filterFreq, filterType) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    const f = ctx.createBiquadFilter();
    f.type = filterType || 'lowpass';
    f.frequency.setValueAtTime(filterFreq, t0);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur);
  }

  _tone(t0, freq, dur, gain, type, slideTo) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur);
  }

  shoot(kind = 'rifle') {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const power = kind === 'rifle' ? 1 : kind === 'pistol' ? 0.7 : 0.5;
    this._noise(t, 0.12 * power + 0.05, 0.5 * power, kind === 'rifle' ? 3200 : 2200, 'lowpass');
    this._noise(t, 0.05, 0.35 * power, 600, 'highpass');
    this._tone(t, 180, 0.08, 0.25 * power, 'square', 60);
  }

  knife() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.12, 0.3, 5000, 'highpass');
    this._tone(t, 900, 0.09, 0.12, 'sawtooth', 300);
  }

  hit(kill = false) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this._tone(t, kill ? 880 : 1200, kill ? 0.09 : 0.05, 0.22, 'square', kill ? 440 : 900);
  }

  hurt() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this._tone(t, 160, 0.16, 0.25, 'sawtooth', 70);
  }

  reload() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this._tone(t, 500, 0.04, 0.18, 'square');
    this._tone(t + 0.18, 700, 0.05, 0.2, 'square');
  }

  jump() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this._tone(t, 220, 0.12, 0.12, 'sine', 360);
  }

  step() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.05, 0.06, 500, 'lowpass');
  }

  death() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this._tone(t, 300, 0.4, 0.2, 'sawtooth', 50);
  }
}
