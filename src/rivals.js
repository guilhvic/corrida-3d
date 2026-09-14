// Corredores de IA no jogo: carro, piloto, pontuação, voltas, modelo 3D e nome flutuante.
import * as THREE from 'three';
import { paramsOf, createCar, resetCar, stepCar, setCarParams } from './physics.js';
import { carById } from './catalog.js';
import { nearestIndex, carSurfaces, lateralOffset, followGround, WALL_OFFSET } from './track.js';
import { collideWalls } from './walls.js';
import { collideCars } from './traffic.js';
import { DriftScorer } from './drift.js';
import { LapTimer } from './laps.js';
import { applyDifficulty } from './difficulty.js';
import { DriftDriver } from './ai.js';
import { gridSlot, RIVALS } from './race.js';
import { createCarModel } from './carModel.js';
import { JP_FONT } from './world.js';

const hex = (color) => `#${color.toString(16).padStart(6, '0')}`;

function nameSprite(name, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = `700 40px VT323, ${JP_FONT}, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const w = ctx.measureText(name).width + 28;
  ctx.fillRect(128 - w / 2, 10, w, 44);
  ctx.fillStyle = hex(color === 0x111214 ? 0x9aa0a8 : color);
  ctx.fillRect(128 - w / 2, 50, w, 4);
  ctx.fillStyle = '#e8fff6';
  ctx.fillText(name, 128, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true, fog: false }));
  sprite.scale.set(2.4, 0.6, 1);
  sprite.position.y = 2.0;
  sprite.renderOrder = 3;
  return sprite;
}

export class Rivals {
  constructor(scene, track, envMap) {
    this.scene = scene;
    this.track = track;
    this.envMap = envMap;
    this.pool = [];   // entradas criadas uma vez e reaproveitadas
    this.list = [];   // em uso nesta corrida
    this.showNames = true;
  }

  get count() { return this.list.length; }

  setTrack(track) {
    this.clear();
    this.track = track;
  }

  entry(i) {
    if (!this.pool[i]) {
      const def = RIVALS[i];
      const carDef = carById(def.car);
      const model = createCarModel({ design: carDef.design, color: def.color, headlight: false, envMap: this.envMap });
      model.setEnvMap(this.envMap);
      const label = nameSprite(def.name, def.color);
      model.root.add(label);
      this.scene.add(model.root);
      const car = createCar();
      setCarParams(car, carDef.params);
      this.pool[i] = { ...def, engine: carDef.engine, css: hex(def.color === 0x111214 ? 0x9aa0a8 : def.color), car, model, label, idx: 0, driver: null, scorer: new DriftScorer(), timer: null, wallImpact: 0, carImpact: 0, finished: false };
    }
    return this.pool[i];
  }

  // Coloca `count` rivais no grid (posições 0..count-1); o jogador larga atrás deles.
  setup(count, difficulty) {
    const n = Math.max(0, Math.min(RIVALS.length, count));
    for (const e of this.pool) e.model.root.visible = false;
    this.list = [];
    for (let i = 0; i < n; i++) {
      const e = this.entry(i);
      const slot = gridSlot(this.track, i);
      resetCar(e.car, slot.x, slot.z, slot.yaw);
      Object.assign(e.car, { vx: 0, vz: 0, r: 0, gear: 1, automatic: true });
      applyDifficulty(e.car, 'facil'); // a IA pilota com o controle de ângulo
      e.idx = slot.idx;
      followGround(e.car, this.track, e.idx);
      e.driver = new DriftDriver(e.car, this.track, { skill: e.skill * (difficulty === 'facil' ? 0.85 : 1), lane: slot.lane * 0.6, seed: 97 + i * 31 });
      e.scorer.resetRace();
      e.timer = new LapTimer(this.track, { persist: false });
      e.timer.startAt(slot.idx);
      e.finished = false;
      e.model.root.visible = true;
      e.model.update(e.car);
      this.list.push(e);
    }
  }

  clear() {
    for (const e of this.pool) e.model.root.visible = false;
    this.list = [];
  }

  // Um passo de física de todos os rivais. player: carro do jogador (para desviar e colidir).
  step(dt, player) {
    if (!this.list.length) return [];
    const cars = [player, ...this.list.map((e) => e.car)];
    for (const e of this.list) {
      const inp = e.driver.update(e.idx, dt, cars); // o piloto ignora o próprio carro
      const [sf, sr] = carSurfaces(this.track, e.car, e.idx, paramsOf(e.car).a, paramsOf(e.car).b);
      stepCar(e.car, inp, dt, sf, sr);
      e.idx = nearestIndex(this.track, e.car.x, e.car.z, e.idx);
      followGround(e.car, this.track, e.idx);
      const hit = collideWalls(e.car, this.track, e.idx);
      if (hit) e.wallImpact = Math.max(e.wallImpact, hit.speed);
    }
    // Contatos: índice 0 é o jogador.
    const contacts = collideCars(cars);
    for (const c of contacts) {
      for (const k of [c.a, c.b]) if (k > 0) this.list[k - 1].carImpact = Math.max(this.list[k - 1].carImpact, c.speed);
    }
    return contacts;
  }

  // Pontos e voltas dos rivais, uma vez por frame depois dos passos de física.
  score(simDt, laps, scoring) {
    for (const e of this.list) {
      if (scoring && !e.finished) {
        const lat = lateralOffset(this.track, e.idx, e.car.x, e.car.z);
        e.scorer.update(simDt, {
          angle: e.car.driftAngle, speed: e.car.speed, onGrass: false,
          wallImpact: e.wallImpact, carImpact: e.carImpact, wallDistance: WALL_OFFSET - Math.abs(lat) - 1.2,
        });
        e.timer.update(simDt, e.car, e.idx, () => {
          if (laps && e.timer.lap === laps) e.scorer.bank();
          return e.scorer.startLap();
        });
        for (const ev of e.timer.events.splice(0)) if (laps && ev.lap >= laps) e.finished = true;
      }
      e.scorer.events.length = 0;
      e.wallImpact = 0;
      e.carImpact = 0;
    }
  }

  // Encerra a corrida: soma os combos em andamento de quem não chegou.
  bankAll() {
    for (const e of this.list) if (!e.finished) e.scorer.bank();
  }

  // Marcas de pneu e fumaça só de quem está perto da câmera.
  effects(simDt, skids, particles, camera) {
    this.list.forEach((e, i) => {
      const c = e.car;
      const near = Math.hypot(c.x - camera.position.x, c.z - camera.position.z) < 70;
      const amount = near && c.speed > 3 ? Math.min(1, Math.max(0, (Math.abs(c.slipR) - 0.12) * 4) + c.wheelspin * 0.6) : 0;
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), lx = fz, lz = -fx, b = paramsOf(c).b;
      for (const side of [0.8, -0.8]) {
        const wx = c.x + lx * side - fx * b, wz = c.z + lz * side - fz * b;
        const wy = (c.y || 0) - Math.sin(c.pitch || 0) * b;
        skids.add(`r${i}${side}`, wx, wz, lx, lz, amount > 0.3, amount, wy);
        if (amount > 0.25) {
          const count = amount * simDt * 9 * (0.4 + Math.min(1, c.speed / 25));
          for (let k = Math.floor(count + Math.random()); k > 0; k--) particles.smoke(wx, wz, c.vx, c.vz, amount, wy);
        }
      }
    });
  }

  updateVisuals(camera) {
    for (const e of this.list) {
      e.model.update(e.car);
      const d = Math.hypot(e.car.x - camera.position.x, e.car.z - camera.position.z);
      e.model.setDetail(d < 28);
      e.label.visible = this.showNames && d > 7 && d < 110;
    }
  }

  standings(player) {
    const rows = [player, ...this.list.map((e) => ({
      name: e.name, css: e.css, points: e.scorer.total + (e.finished ? 0 : e.scorer.comboValue), lap: e.timer.lap, finished: e.finished,
    }))];
    return rows.sort((a, b) => b.points - a.points);
  }
}
