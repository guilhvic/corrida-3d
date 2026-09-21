// Vitrine do carro no menu: um renderizador pequeno só para o cartão de seleção, com luz de estúdio
// e o carro girando devagar. É um contexto WebGL próprio (separado do jogo), então só
// desenha quando a tela do menu está à vista e fica parado no resto do tempo.
import * as THREE from 'three';
import { createCarModel } from './carModel.js';

export class CarPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.model = null;
    this.yaw = -0.6;
    this.ok = true;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      this.ok = false; // sem contexto sobrando: o menu segue sem a vitrine
      return;
    }
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    this.renderer.setSize(canvas.width, canvas.height, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, canvas.width / canvas.height, 0.1, 60);

    // Luz de estúdio: principal quente na frente, contraluz fria atrás e preenchimento de cima.
    const key = new THREE.DirectionalLight(0xfff1dc, 2.6);
    key.position.set(3.4, 4.2, 4.6);
    const rim = new THREE.DirectionalLight(0x8fc6ff, 1.8);
    rim.position.set(-4, 2.6, -3.4);
    const fill = new THREE.HemisphereLight(0xdfe8ff, 0x14161c, 1.1);
    this.scene.add(key, rim, fill);

    // Reflexo do ambiente: um "estúdio" simples (painéis claros em volta) virado em mapa de reflexo.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new THREE.Scene();
    room.background = new THREE.Color(0x2a2f3a);
    const panel = new THREE.MeshBasicMaterial({ color: 0xe8eef7 });
    for (const [x, y, z, w, h] of [[0, 6, 0, 10, 10], [-6, 2.5, 0, 6, 5], [6, 2.5, 0, 6, 5], [0, 2.5, -6, 8, 5]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), panel);
      m.position.set(x, y, z);
      m.lookAt(0, 1, 0);
      room.add(m);
    }
    this.env = pmrem.fromScene(room, 0.06);
    this.scene.environment = this.env.texture;
    room.traverse((o) => o.geometry?.dispose());
    panel.dispose();
    pmrem.dispose();

    // A sombra "bolha" já vem no próprio modelo do carro (como no jogo).
    this.holder = new THREE.Group();
    this.scene.add(this.holder);
  }

  // design: id em DESIGNS; look: visual da garagem (mesmo objeto do carro do jogador)
  setCar(design, look = null) {
    if (!this.ok || (design === this.design && look === this.look)) return;
    this.design = design;
    this.look = look;
    this.model?.dispose();
    this.model = createCarModel({ design, look, headlight: false });
    this.model.setEnvMap(this.env.texture);
    this.model.setDetail(true);
    // A sombra "bolha" do jogo é pintada no chão da pista; aqui, sem chão, ela flutuaria atrás do carro.
    for (const child of this.model.root.children) {
      if (child.isMesh && [child.material].flat().some((m) => m && m.depthWrite === false)) child.visible = false;
    }
    this.holder.add(this.model.root);
    this.frameCar();
  }

  // Enquadra o carro inteiro, seja ele curto ou comprido. Só a lataria entra na conta: os fachos dos
  // faróis, os brilhos das lanternas e a sombra são bem maiores que o carro.
  frameCar() {
    const box = new THREE.Box3();
    const bounds = new THREE.Box3();
    this.model.root.updateMatrixWorld(true);
    this.model.root.traverse((o) => {
      if (!o.isMesh || [o.material].flat().some((m) => m && m.depthWrite === false)) return;
      bounds.setFromBufferAttribute(o.geometry.attributes.position).applyMatrix4(o.matrixWorld);
      box.union(bounds);
    });
    const size = box.getSize(new THREE.Vector3());
    // O carro gira, então o que precisa caber na largura é o raio (a diagonal), e na altura, a altura dele.
    const radius = Math.hypot(size.x, size.z) / 2;
    const half = Math.tan((this.camera.fov * Math.PI) / 360);
    this.center = box.getCenter(new THREE.Vector3());
    this.dist = Math.max(radius / (half * this.camera.aspect), (size.y / 2 + 0.12) / half) * 1.08;
  }

  update(dt) {
    if (!this.ok || !this.model) return;
    this.yaw += dt * 0.45;
    this.holder.rotation.y = this.yaw;
    const el = 0.28; // câmera um pouco acima, olhando o carro de leve por cima
    this.camera.position.set(0, this.center.y + this.dist * Math.sin(el), this.dist * Math.cos(el));
    this.camera.lookAt(0, this.center.y, 0);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (!this.ok) return;
    this.model?.dispose();
    this.env?.dispose();
    this.renderer.dispose();
  }
}
