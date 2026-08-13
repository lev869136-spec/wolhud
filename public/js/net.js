/* WebSocket networking client with auto-reconnect + ping. */
export class Net {
  constructor() {
    this.ws = null;
    this.handlers = {};
    this.connected = false;
    this.playerId = null;
    this.ping = 0;
    this._pingTimer = null;
    this._reconnect = null;
    this.onStatus = null; // (connected) => void
  }

  on(type, fn) {
    (this.handlers[type] = this.handlers[type] || []).push(fn);
  }

  emit(type, data) {
    const hs = this.handlers[type];
    if (hs) for (const fn of hs) fn(data);
  }

  connect(name) {
    this.name = name;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.connected = true;
      this.onStatus && this.onStatus(true);
      ws.send(JSON.stringify({ type: 'join', name }));
      this._pingTimer = setInterval(() => {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'ping', t0: performance.now() }));
      }, 2000);
    };

    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === 'pong') {
        this.ping = Math.round(performance.now() - msg.t0);
        this.emit('pong', this.ping);
        return;
      }
      if (msg.type === 'init') this.playerId = msg.id;
      this.emit(msg.type, msg);
    };

    ws.onclose = () => {
      this.connected = false;
      this.onStatus && this.onStatus(false);
      clearInterval(this._pingTimer);
      if (this._reconnect) return;
      // try to reconnect once
      this._reconnect = setTimeout(() => { this._reconnect = null; this.connect(this.name); }, 1500);
    };

    ws.onerror = () => {};
  }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  state(o) { this.send(Object.assign({ type: 'state' }, o)); }
  shoot(o, d, w) { this.send({ type: 'shoot', o, d, w }); }
  reload(w) { this.send({ type: 'reload', w }); }
  respawn() { this.send({ type: 'respawn' }); }
  chat(t) { this.send({ type: 'chat', t }); }

  close() {
    clearInterval(this._pingTimer);
    if (this._reconnect) { clearTimeout(this._reconnect); this._reconnect = null; }
    if (this.ws) { this.ws.onclose = null; try { this.ws.close(); } catch {} }
    this.connected = false;
  }
}
