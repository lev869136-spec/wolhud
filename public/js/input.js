/* Keyboard + mouse + pointer-lock input manager. */
export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.dx = 0; this.dy = 0;
    this.mouseDown = { left: false, right: false };
    this.locked = false;
    this._justPressed = new Set();
    this._justMouse = new Set();

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
      if (!this.keys.has(e.code)) this._justPressed.add(e.code);
      this.keys.add(e.code);
      this.onKeyDown && this.onKeyDown(e.code, e);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.onKeyUp && this.onKeyUp(e.code, e);
    });

    el.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.dx += e.movementX || 0;
      this.dy += e.movementY || 0;
    });

    el.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown.left = true; this._justMouse.add(0); this.onMouseDown && this.onMouseDown(0); }
      if (e.button === 2) { this.mouseDown.right = true; this._justMouse.add(2); this.onMouseDown && this.onMouseDown(2); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) { this.mouseDown.left = false; this.onMouseUp && this.onMouseUp(0); }
      if (e.button === 2) { this.mouseDown.right = false; this.onMouseUp && this.onMouseUp(2); }
    });

    el.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
      this.onLock && this.onLock(this.locked);
    });
    document.addEventListener('pointerlockerror', () => { this.onLockError && this.onLockError(); });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown.left = this.mouseDown.right = false;
    });
  }

  lock() { try { this.el.requestPointerLock(); } catch {} }

  unlock() { if (this.locked) try { document.exitPointerLock(); } catch {} }

  /* consume mouse delta since last frame */
  consumeMouse() {
    const d = { x: this.dx, y: this.dy };
    this.dx = 0; this.dy = 0;
    return d;
  }

  /* consume keys pressed this frame (for discrete actions) */
  justPressed() {
    const s = new Set(this._justPressed);
    this._justPressed.clear();
    return s;
  }

  /* consume mouse buttons pressed this frame */
  justMouse() {
    const s = new Set(this._justMouse);
    this._justMouse.clear();
    return s;
  }

  down(...codes) { return codes.some((c) => this.keys.has(c)); }
}
