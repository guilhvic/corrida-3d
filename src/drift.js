// Pontuação de drift: pontos por ângulo x velocidade, combo com multiplicador,
// bônus (transição, ângulo alto, drift longo, rente à parede) e perda por batida/grama/rodada.
// Módulo puro (sem three.js).

export const DRIFT = {
  minAngle: 12,          // graus para contar como drift
  minSpeed: 25,          // km/h
  maxScoredAngle: 70,    // ângulo acima disso não rende mais pontos
  spinAngle: 110,        // passou disso = rodou
  grace: 1.1,            // s sem driftar antes de fechar (e somar) o combo
  multStep: 3,           // s de drift contínuo para +0,5 no multiplicador
  maxMult: 5,
  wallImpact: 1.2,       // m/s de impacto que já derruba o combo
  carImpact: 2.0,        // m/s de batida em outro carro que derruba o combo (encostar não)
};

const rad2deg = 180 / Math.PI;

export class DriftScorer {
  constructor() {
    this.total = 0;
    this.best = 0;         // maior combo somado (pontos x multiplicador)
    this.lapPoints = 0;
    this.events = [];
    this.resetCombo();
  }

  // Nova corrida.
  resetRace() {
    this.total = 0;
    this.best = 0;
    this.lapPoints = 0;
    this.events = [];
    this.resetCombo();
  }

  resetCombo() {
    this.points = 0;       // pontos do combo atual, antes do multiplicador
    this.mult = 1;
    this.active = false;
    this.driftTime = 0;
    this.multTimer = 0;
    this.idle = 0;
    this.side = 0;
    this.highAngleTime = 0;
    this.bonuses = new Set();
    this.angle = 0;
  }

  get comboValue() {
    return Math.round(this.points * this.mult);
  }

  lose(reason) {
    if (this.active && this.points > 0) this.events.push({ type: 'lost', reason, points: this.comboValue });
    this.resetCombo();
  }

  bank() {
    const value = this.comboValue;
    if (value > 0) {
      this.total += value;
      this.lapPoints += value;
      this.best = Math.max(this.best, value);
      this.events.push({ type: 'bank', points: value, mult: this.mult });
    }
    this.resetCombo();
  }

  bonus(key, label, points) {
    if (this.bonuses.has(key)) return;
    this.bonuses.add(key);
    this.points += points;
    this.events.push({ type: 'bonus', label, points });
  }

  // s: { angle (rad, com sinal), speed (m/s), onGrass, wallImpact (m/s ou 0), carImpact (m/s ou 0), wallDistance (m) }
  update(dt, s) {
    const angleDeg = Math.abs(s.angle) * rad2deg;
    const kmh = s.speed * 3.6;
    this.angle = angleDeg;

    if (s.wallImpact > DRIFT.wallImpact) return this.lose('wall');
    if (s.carImpact > DRIFT.carImpact) return this.lose('car');
    if (this.active && s.onGrass) return this.lose('grass');
    if (this.active && angleDeg > DRIFT.spinAngle && kmh > 8) return this.lose('spin');

    const drifting = kmh >= DRIFT.minSpeed && angleDeg >= DRIFT.minAngle && angleDeg < DRIFT.spinAngle && !s.onGrass;
    if (!drifting) {
      if (this.active) {
        this.idle += dt;
        if (this.idle > DRIFT.grace) this.bank();
      }
      return;
    }

    const side = Math.sign(s.angle);
    if (this.active && this.side !== 0 && side !== this.side) {
      // Troca de lado sem perder o drift.
      this.points += 150;
      this.mult = Math.min(DRIFT.maxMult, this.mult + 0.5);
      this.events.push({ type: 'bonus', label: 'TRANSIÇÃO', points: 150 });
    }
    this.side = side;
    this.active = true;
    this.idle = 0;
    this.driftTime += dt;
    this.multTimer += dt;
    if (this.multTimer >= DRIFT.multStep) {
      this.multTimer -= DRIFT.multStep;
      this.mult = Math.min(DRIFT.maxMult, this.mult + 0.5);
    }

    const scoredAngle = Math.min(angleDeg, DRIFT.maxScoredAngle);
    let rate = (scoredAngle - DRIFT.minAngle + 4) * kmh * 0.08;
    const close = s.wallDistance !== undefined && s.wallDistance < 1.5;
    if (close) rate *= 1.5;
    this.points += rate * dt;

    if (angleDeg > 45) this.highAngleTime += dt; else this.highAngleTime = 0;
    if (this.highAngleTime > 1) this.bonus('angle', 'ÂNGULO ALTO', 300);
    if (this.driftTime > 8) this.bonus('long', 'DRIFT LONGO', 500);
    if (close) this.bonus('close', 'RENTE À PAREDE', 250);
  }

  // Nota de estilo da curva: com combo ativo o bônus entra no combo (e ganha o multiplicador); sem combo vai direto ao total.
  styleBonus(grade, points) {
    if (points <= 0) return;
    if (this.active) this.points += points;
    else { this.total += points; this.lapPoints += points; }
    this.events.push({ type: 'bonus', label: `NOTA ${grade}`, points });
  }

  startLap() {
    const points = this.lapPoints;
    this.lapPoints = 0;
    return points;
  }
}
