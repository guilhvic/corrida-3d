// Teclado + controle (Xbox/PlayStation no mapeamento "standard" do navegador).
// Teclado usa rampas para imitar um controle analógico.
import { t } from './i18n.js';

const BLOCK = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

// Botões do mapeamento standard (Xbox): A=0 B=1 X=2 Y=3 LB=4 RB=5 LT=6 RT=7 View=8 Menu=9 LS=10 RS=11 D-pad 12-15.
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const PAD_ACTIONS = {
  shiftUp: PAD.RB, shiftDown: PAD.LB, camera: PAD.Y, reset: PAD.VIEW, pause: PAD.MENU, difficulty: PAD.X,
  tcs: PAD.LEFT, abs: PAD.RIGHT, driftAssist: PAD.UP, ghost: PAD.DOWN, confirm: PAD.A, back: PAD.B,
};
// Navegação nos menus (D-pad; o analógico esquerdo também navega).
const PAD_NAV = { up: PAD.UP, down: PAD.DOWN, left: PAD.LEFT, right: PAD.RIGHT };
const DEADZONE = 0.1;
const NAV_DELAY = 420;  // ms segurando o direcional (analógico ou D-pad) até começar a repetir
const NAV_REPEAT = 120; // ms entre repetições

const approach = (v, target, rate) => (v < target ? Math.min(target, v + rate) : Math.max(target, v - rate));

export class Input {
  constructor({ onPadConnected, onPadDisconnected } = {}) {
    this.keys = new Set();
    this.pressedQueue = new Set();
    this.state = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
    this.padPrev = [];
    this.padIndex = null;
    this.stickNav = { x: 0, y: 0 };
    this.navHeld = {}; // direção -> { since, last } para repetir segurando
    this.usingPad = false;
    this.rumbleUntil = 0;
    this.rumbleEnabled = true;
    this.lastRumble = 0;

    addEventListener('keydown', (e) => {
      if (isTyping(e)) return; // digitando num campo (painel de debug): não pilota
      if (BLOCK.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressedQueue.add(e.code);
      this.keys.add(e.code);
      this.usingPad = false;
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    // A conexão é detectada por consulta a cada frame (pollConnection): o evento
    // gamepadconnected não dispara em alguns navegadores/janelas embutidas.
    this.onPadConnected = onPadConnected;
    this.onPadDisconnected = onPadDisconnected;
    this.connectedId = null;
  }

  pads() {
    try {
      return Array.from(navigator.getGamepads?.() || []).filter((p) => p && p.connected);
    } catch {
      return []; // bloqueado por política de permissões
    }
  }

  pad() {
    const pads = this.pads();
    return pads.find((p) => p.index === this.padIndex) || pads.find((p) => p.mapping === 'standard') || pads[0] || null;
  }

  pollConnection() {
    const pad = this.pad();
    if (pad) this.padIndex = pad.index;
    const id = pad ? pad.id : null;
    if (id === this.connectedId) return pad;
    if (this.connectedId) this.onPadDisconnected?.(padName({ id: this.connectedId }));
    if (id) this.onPadConnected?.(padName(pad), pad);
    this.connectedId = id;
    return pad;
  }

  // Texto de diagnóstico do que o navegador está enxergando.
  diagnostics() {
    if (!navigator.getGamepads) return t('Este navegador não tem suporte a controles (Gamepad API).');
    if (!isSecureContext) return t('Página fora de contexto seguro: abra por http://localhost.');
    const pads = this.pads();
    if (!pads.length) return t('Nenhum controle visível para a página. Clique aqui na tela e aperte o botão A.');
    return pads.map((p) => {
      const pressed = p.buttons.map((b, i) => (b.pressed ? i : null)).filter((i) => i !== null);
      const axes = p.axes.map((a) => a.toFixed(1)).join(' ');
      const warn = p.mapping === 'standard' ? '' : ' (mapeamento não padrão: botões podem não bater)';
      return `#${p.index} ${p.id}${warn} | botões: ${pressed.length ? pressed.join(',') : '-'} | eixos: ${axes}`;
    }).join('\n');
  }

  // Ações de toque único (C, R, Q, E...). Consumidas a cada frame.
  consumeActions() {
    const k = this.pressedQueue;
    const actions = {
      shiftUp: k.has('KeyE') || k.has('ShiftRight'),
      shiftDown: k.has('KeyQ') || k.has('ControlRight'),
      camera: k.has('KeyC'),
      reset: k.has('KeyR'),
      transmission: k.has('KeyT'),
      mute: k.has('KeyM'),
      ghost: k.has('KeyG'),
      pause: k.has('KeyP') || k.has('Escape'),
      tcs: k.has('Digit1'),
      abs: k.has('Digit2'),
      driftAssist: k.has('Digit3'),
      difficulty: k.has('KeyH'),
      mist: k.has('KeyN'),
      crt: k.has('KeyV'),
      debug: k.has('KeyB'),
      freeCam: k.has('KeyF'),
      music: k.has('KeyK'),
      nextSong: k.has('KeyL'),
      confirm: k.has('Enter'),
      back: k.has('Escape') || k.has('Backspace'),
      // Menus: setas ou WASD
      up: k.has('ArrowUp') || k.has('KeyW'),
      down: k.has('ArrowDown') || k.has('KeyS'),
      left: k.has('ArrowLeft') || k.has('KeyA'),
      right: k.has('ArrowRight') || k.has('KeyD'),
    };
    k.clear();

    const pad = this.pad();
    if (pad) {
      for (const [name, i] of Object.entries(PAD_ACTIONS)) {
        const now = !!pad.buttons[i]?.pressed;
        if (now && !this.padPrev[i]) { actions[name] = true; this.usingPad = true; }
      }
      // Direções dos menus pelo D-pad e pelo analógico esquerdo (dispara ao passar de 0,5 e rearma abaixo de 0,3).
      // Segurando, repete depois de NAV_DELAY.
      const held = { up: false, down: false, left: false, right: false };
      for (const [name, i] of Object.entries(PAD_NAV)) if (pad.buttons[i]?.pressed) held[name] = true;
      for (const [axis, neg, pos, idx] of [['x', 'left', 'right', 0], ['y', 'up', 'down', 1]]) {
        const v = pad.axes[idx] || 0;
        const dir = v > 0.5 ? 1 : v < -0.5 ? -1 : Math.abs(v) < 0.3 ? 0 : this.stickNav[axis];
        this.stickNav[axis] = dir;
        if (dir) held[dir > 0 ? pos : neg] = true;
      }
      // Na diagonal fica só o eixo mais inclinado (senão o analógico "escorrega" para a linha de baixo)
      if ((held.left || held.right) && (held.up || held.down) && !pad.buttons[PAD.UP]?.pressed && !pad.buttons[PAD.DOWN]?.pressed) {
        if (Math.abs(pad.axes[0] || 0) >= Math.abs(pad.axes[1] || 0)) held.up = held.down = false;
        else if (!pad.buttons[PAD.LEFT]?.pressed && !pad.buttons[PAD.RIGHT]?.pressed) held.left = held.right = false;
      }
      const now = performance.now();
      for (const [name, on] of Object.entries(held)) {
        const h = this.navHeld[name];
        if (!on) { delete this.navHeld[name]; continue; }
        if (!h) { this.navHeld[name] = { since: now, last: now }; actions[name] = true; continue; }
        if (now - h.since > NAV_DELAY && now - h.last > NAV_REPEAT) { h.last = now; actions[name] = true; }
      }
      this.padPrev = pad.buttons.map((b) => b.pressed);
    }
    return actions;
  }

  update(dt) {
    const k = this.keys, s = this.state;
    const up = k.has('KeyW') || k.has('ArrowUp');
    const down = k.has('KeyS') || k.has('ArrowDown');
    const left = k.has('KeyA') || k.has('ArrowLeft');
    const right = k.has('KeyD') || k.has('ArrowRight');

    s.throttle = approach(s.throttle, up ? 1 : 0, dt * (up ? 5 : 8));
    s.brake = approach(s.brake, down ? 1 : 0, dt * (down ? 7 : 10));
    s.handbrake = k.has('Space') ? 1 : 0;

    const target = (left ? 1 : 0) - (right ? 1 : 0);
    const reversing = target !== 0 && Math.sign(target) !== Math.sign(s.steer) && s.steer !== 0;
    const rate = target === 0 ? 4.5 : reversing ? 7 : 2.8;
    s.steer = approach(s.steer, target, dt * rate);

    const pad = this.pad();
    if (!pad) return { ...s };

    const ax = pad.axes[0] || 0;
    const { throttle: rt, brake: lt } = triggers(pad);
    const hb = pad.buttons[PAD.A]?.pressed || pad.buttons[PAD.B]?.pressed ? 1 : 0;
    if (Math.abs(ax) > DEADZONE || rt > 0.05 || lt > 0.05 || hb) this.usingPad = true;
    if (!this.usingPad) return { ...s };

    const mag = Math.max(0, (Math.abs(ax) - DEADZONE) / (1 - DEADZONE));
    return {
      steer: -Math.sign(ax) * Math.pow(mag, 1.3),
      throttle: rt,
      brake: lt,
      handbrake: Math.max(hb, s.handbrake),
    };
  }

  // Analógico direito: { x, y } em -1..1 (x+ = direita, y+ = para baixo), com zona morta radial.
  lookStick() {
    const pad = this.pad();
    if (!pad || pad.axes.length < 4) return { x: 0, y: 0 };
    const x = pad.axes[2] || 0, y = pad.axes[3] || 0;
    const mag = Math.hypot(x, y);
    if (mag < 0.18) return { x: 0, y: 0 };
    // Não marca usingPad: um analógico com folga não pode desligar o teclado.
    const k = (mag - 0.18) / (1 - 0.18) / mag;
    return { x: x * k, y: y * k };
  }

  // Vibração contínua (chamar todo frame) + pancadas curtas. Valores 0..1.
  rumble(weak, strong, now = performance.now()) {
    const pad = this.pad();
    const act = pad?.vibrationActuator;
    if (!act || !this.rumbleEnabled || !this.usingPad || now - this.lastRumble < 90) return;
    this.lastRumble = now;
    if (now < this.rumbleUntil) return; // deixa a pancada terminar
    if (weak < 0.02 && strong < 0.02) return;
    act.playEffect?.('dual-rumble', { startDelay: 0, duration: 120, weakMagnitude: Math.min(1, weak), strongMagnitude: Math.min(1, strong) }).catch(() => {});
  }

  hit(strength, ms = 220) {
    const act = this.pad()?.vibrationActuator;
    if (!act || !this.rumbleEnabled) return;
    this.rumbleUntil = performance.now() + ms;
    act.playEffect?.('dual-rumble', { startDelay: 0, duration: ms, weakMagnitude: Math.min(1, strength * 0.6), strongMagnitude: Math.min(1, strength) }).catch(() => {});
  }
}

export const isTyping = (e) => e.target instanceof Element && !!e.target.closest('input, textarea, select');

// Gatilhos analógicos (LT/RT). Fora do mapeamento standard não há como saber o repouso dos eixos,
// então só os botões são usados.
function triggers(pad) {
  return { throttle: pad.buttons[PAD.RT]?.value || 0, brake: pad.buttons[PAD.LT]?.value || 0 };
}

function padName(gamepad) {
  const id = gamepad.id.toLowerCase();
  if (id.includes('xbox') || id.includes('xinput') || id.includes('045e')) return 'Controle Xbox';
  if (id.includes('dualsense') || id.includes('dualshock') || id.includes('054c')) return 'Controle PlayStation';
  return 'Controle';
}
