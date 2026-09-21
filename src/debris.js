// Pedaços que se soltam do carro numa batida: para-choque, capô, porta, retrovisor, lanterna, cacos de
// vidro e lascas de pintura. Cada pedaço vira um corpo rígido simples (queda, quique, atrito e giro)
// que rola pelo asfalto e fica lá até o fim da corrida — no mesmo espírito das marcas de pneu.
import * as THREE from 'three';

const GRAVITY = 9.81;
const MAX_PIECES = 90;      // acima disso o mais antigo é recolhido (todos os carros juntos)
const SLEEP_SPEED = 0.35;   // m/s: abaixo disso o pedaço assenta no chão
const LIFE = 40;            // s até sumir (some antes se passar do limite de pedaços)

export class DebrisField {
  constructor(scene) {
    this.scene = scene;
    this.pieces = [];
    this.tmp = new THREE.Vector3();
    this.euler = new THREE.Euler();
    this.spin = new THREE.Quaternion();
    this.groundAt = null; // (x, z) -> altura do chão; definido pelo jogo a cada pista
  }

  // object: malha já posicionada no mundo (normalmente destacada do carro).
  // velocity/spin: velocidade linear (m/s) e angular (rad/s) iniciais.
  add(object, { velocity, spin, radius = 0.18 }) {
    this.scene.add(object);
    const piece = {
      object,
      v: velocity.clone(),
      w: spin.clone(),
      radius,
      life: LIFE,
      resting: false,
    };
    this.pieces.push(piece);
    while (this.pieces.length > MAX_PIECES) this.remove(this.pieces[0]);
    return piece;
  }

  remove(piece) {
    const i = this.pieces.indexOf(piece);
    if (i >= 0) this.pieces.splice(i, 1);
    piece.object.removeFromParent();
    piece.object.traverse?.((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
  }

  ground(x, z) {
    return this.groundAt ? this.groundAt(x, z) : 0;
  }

  update(dt) {
    if (!dt) return;
    for (const p of [...this.pieces]) {
      p.life -= dt;
      if (p.life <= 0) { this.remove(p); continue; }
      if (p.life < 2) {
        // Some encolhendo, para não apagar de uma vez na frente da câmera.
        p.object.scale.setScalar(Math.max(0.01, p.life / 2));
      }
      if (p.resting) continue;

      p.v.y -= GRAVITY * dt;
      p.object.position.addScaledVector(p.v, dt);
      // Giro: aplica a velocidade angular como pequenas rotações em torno dos eixos do mundo.
      this.euler.set(p.w.x * dt, p.w.y * dt, p.w.z * dt);
      p.object.quaternion.premultiply(this.spin.setFromEuler(this.euler));

      const floor = this.ground(p.object.position.x, p.object.position.z) + p.radius;
      if (p.object.position.y <= floor) {
        p.object.position.y = floor;
        if (p.v.y < 0) p.v.y = -p.v.y * 0.32;           // quica perdendo energia
        p.v.x *= 0.72; p.v.z *= 0.72;                    // atrito com o asfalto
        p.w.multiplyScalar(0.55);
        if (Math.abs(p.v.y) < 0.6 && p.v.lengthSq() < SLEEP_SPEED * SLEEP_SPEED) {
          // Assentou: encosta no chão e para de calcular.
          p.v.set(0, 0, 0);
          p.w.set(0, 0, 0);
          p.object.position.y = floor * 1 - p.radius * 0.35;
          p.resting = true;
        }
      }
    }
  }

  clear() {
    for (const p of [...this.pieces]) this.remove(p);
  }
}

// Lasca de lataria/vidro: um triângulo achatado e irregular, barato de gerar.
export function shardGeometry(size, rand = Math.random) {
  const r = () => (rand() - 0.5) * size;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array([
    r(), 0, r(),
    size * (0.4 + rand() * 0.6), rand() * size * 0.2, r(),
    r(), rand() * size * 0.2, size * (0.4 + rand() * 0.6),
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}
