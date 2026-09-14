// Câmera livre (debug): voa pelo mapa para ver detalhes, com a corrida congelada.
// Teclado: WASD/setas movem, Espaço/E sobe, C/Q desce, Shift acelera, Ctrl vai devagar, roda do mouse muda a velocidade.
// Mouse: arrastar (qualquer botão) gira. Controle: analógico esquerdo move, direito gira, RT/LT sobem/descem.
import * as THREE from 'three';
import { PAD } from './input.js';

const LOOK_SPEED = 0.0032; // rad por pixel
const PAD_LOOK = 2.4;      // rad/s
const MIN_SPEED = 2, MAX_SPEED = 160;

export class FreeCamera {
  constructor(camera, canvas, input) {
    this.camera = camera;
    this.input = input;
    this.active = false;
    this.yaw = 0;
    this.pitch = 0;
    this.speed = 14;
    this.dragging = false;
    this.velocity = new THREE.Vector3();

    canvas.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      this.dragging = true;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointerup', () => { this.dragging = false; });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.active || !this.dragging) return;
      this.yaw -= e.movementX * LOOK_SPEED;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * LOOK_SPEED, -1.5, 1.5);
    });
    canvas.addEventListener('contextmenu', (e) => { if (this.active) e.preventDefault(); });
    addEventListener('wheel', (e) => {
      if (!this.active) return;
      this.speed = THREE.MathUtils.clamp(this.speed * (e.deltaY > 0 ? 0.85 : 1.18), MIN_SPEED, MAX_SPEED);
      this.onSpeed?.(this.speed);
    }, { passive: true });
  }

  // Começa de onde a câmera do jogo está, olhando para o mesmo lado.
  enable() {
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    this.yaw = Math.atan2(dir.x, dir.z);
    this.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    this.velocity.set(0, 0, 0);
    this.active = true;
  }

  disable() {
    this.active = false;
    this.dragging = false;
  }

  update(dt) {
    const k = this.input.keys;
    const cam = this.camera;
    let fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let side = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let rise = (k.has('Space') || k.has('KeyE') ? 1 : 0) - (k.has('KeyC') || k.has('KeyQ') ? 1 : 0);
    let boost = k.has('ShiftLeft') || k.has('ShiftRight') ? 4 : k.has('ControlLeft') || k.has('ControlRight') ? 0.25 : 1;

    const pad = this.input.pad();
    if (pad) {
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
      fwd -= dz(pad.axes[1] || 0);
      side += dz(pad.axes[0] || 0);
      rise += (pad.buttons[PAD.RT]?.value || 0) - (pad.buttons[PAD.LT]?.value || 0);
      if (pad.buttons[10]?.pressed) boost = 4; // clicar o analógico esquerdo acelera
      const look = this.input.lookStick();
      this.yaw -= look.x * PAD_LOOK * dt;
      this.pitch = THREE.MathUtils.clamp(this.pitch - look.y * PAD_LOOK * dt, -1.5, 1.5);
    }

    // Anda no plano para onde se olha (W não mergulha no chão olhando para baixo); sobe/desce na vertical.
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const target = new THREE.Vector3(
      (sin * fwd - cos * side) * this.speed * boost,
      rise * this.speed * boost,
      (cos * fwd + sin * side) * this.speed * boost,
    );
    this.velocity.lerp(target, 1 - Math.exp(-dt * 10));
    cam.position.addScaledVector(this.velocity, dt);
    cam.position.y = Math.max(0.25, cam.position.y);

    const cp = Math.cos(this.pitch);
    cam.lookAt(cam.position.x + sin * cp, cam.position.y + Math.sin(this.pitch), cam.position.z + cos * cp);
    cam.fov = 62;
    cam.updateProjectionMatrix();
  }
}
