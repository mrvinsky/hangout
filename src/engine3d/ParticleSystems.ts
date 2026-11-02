import * as THREE from 'three';
import { createSoftTexture } from './textures';

/** Çağırma (summon) girdabı: parçacıklar döner, sonra kedinin yüzeyine mıknatıs gibi birleşir. */
export class SwarmSystem {
  static readonly COUNT = 24000;
  static readonly VORTEX_MS = 800;
  static readonly CONVERGE_MS = 1400;

  readonly points: THREE.Points;
  private pos = new Float32Array(SwarmSystem.COUNT * 3);
  private vortex: { angle: number; r: number; y: number; speed: number }[] = [];

  constructor() {
    const geo = new THREE.BufferGeometry();
    const colors = new Float32Array(SwarmSystem.COUNT * 3);
    for (let i = 0; i < SwarmSystem.COUNT; i++) {
      this.vortex.push({
        angle: Math.random() * Math.PI * 2,
        r: 20 + Math.random() * 45,
        y: (Math.random() - 0.5) * 40,
        speed: 0.045 + Math.random() * 0.06,
      });
      const shade = 0.88 + Math.random() * 0.12;
      colors[i * 3] = shade;
      colors[i * 3 + 1] = shade * 0.98;
      colors[i * 3 + 2] = 1.0;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 2.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      map: createSoftTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    this.points.visible = false;
  }

  setTint(hex: string) {
    (this.points.material as THREE.PointsMaterial).color.set(hex);
  }

  /** Girdap fazı; t: 0→1 */
  updateVortex(t: number, time: number) {
    for (let i = 0; i < SwarmSystem.COUNT; i++) {
      const vp = this.vortex[i];
      vp.angle += vp.speed;
      const curR = vp.r * (0.3 + 0.7 * t);
      this.pos[i * 3] = Math.cos(vp.angle) * curR;
      this.pos[i * 3 + 1] = -5 + vp.y * (1 - t * 0.3) + Math.sin(time * 4 + i) * 2;
      this.pos[i * 3 + 2] = Math.sin(vp.angle) * curR;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  /** Birleşme fazı; progress: 0→1, hedefler kedi yüzeyinden örneklenmiş noktalar */
  updateConverge(progress: number, targets: THREE.Vector3[], origin: THREE.Vector3) {
    const ease = progress < 0.5 ? 4 * progress ** 3 : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    const n = targets.length;
    if (n === 0) return;
    for (let i = 0; i < SwarmSystem.COUNT; i++) {
      const vp = this.vortex[i];
      vp.angle += vp.speed * (1 - ease * 0.7);
      const vx = Math.cos(vp.angle) * vp.r * (1 - ease * 0.8);
      const vy = -5 + vp.y * (1 - ease * 0.7);
      const vz = Math.sin(vp.angle) * vp.r * (1 - ease * 0.8);
      const target = targets[i % n];
      this.pos[i * 3] = vx * (1 - ease) + (target.x + origin.x) * ease;
      this.pos[i * 3 + 1] = vy * (1 - ease) + (target.y + origin.y) * ease;
      this.pos[i * 3 + 2] = vz * (1 - ease) + (target.z + origin.z) * ease;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

interface AuraParticle {
  active: boolean;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  age: number; life: number; phase: number;
}

/** Patronus modunda gövdeden yavaşça süzülen hafif ışık buharı (380 parçacık). */
export class AuraSystem {
  static readonly COUNT = 380;

  readonly points: THREE.Points;
  private pos = new Float32Array(AuraSystem.COUNT * 3);
  private colors = new Float32Array(AuraSystem.COUNT * 3);
  private list: AuraParticle[] = [];

  constructor() {
    const geo = new THREE.BufferGeometry();
    for (let i = 0; i < AuraSystem.COUNT; i++) {
      this.pos[i * 3 + 1] = -9999;
      this.list.push({ active: false, x: 0, y: -9999, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 2.5 + Math.random() * 1.5, phase: Math.random() * 10 });
      this.colors[i * 3] = 0.92;
      this.colors[i * 3 + 1] = 0.96;
      this.colors[i * 3 + 2] = 1.0;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 2.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      map: createSoftTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    this.points.visible = false;
  }

  setTint(hex: string) {
    (this.points.material as THREE.PointsMaterial).color.set(hex);
  }

  clear() {
    for (let i = 0; i < AuraSystem.COUNT; i++) {
      this.list[i].active = false;
      this.pos[i * 3 + 1] = -9999;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * @param surface kedinin model uzayındaki yüzey noktaları
   * @param catPos kedinin dünya konumu, catRotY yönelimi, scale ölçek çarpanı
   */
  update(dt: number, time: number, surface: THREE.Vector3[], catPos: THREE.Vector3, catRotY: number, scale: number, isPetting: boolean) {
    if (surface.length === 0) return;
    const spawnProb = isPetting ? 0.25 : 0.12;
    const cosR = Math.cos(catRotY);
    const sinR = Math.sin(catRotY);

    for (let i = 0; i < AuraSystem.COUNT; i++) {
      const p = this.list[i];
      if ((!p.active || p.age >= p.life) && Math.random() < spawnProb) {
        const v = surface[Math.floor(Math.random() * surface.length)];
        p.active = true;
        p.x = catPos.x + (v.x * cosR + v.z * sinR) * scale;
        p.y = catPos.y + v.y * scale;
        p.z = catPos.z + (-v.x * sinR + v.z * cosR) * scale;
        p.vx = (Math.random() - 0.5) * (isPetting ? 0.022 : 0.012);
        p.vy = (isPetting ? 0.048 : 0.026) + Math.random() * 0.022;
        p.vz = (Math.random() - 0.5) * (isPetting ? 0.022 : 0.012);
        p.age = 0;
        p.life = 2.0 + Math.random() * 1.5;
      }
      if (!p.active) continue;

      p.age += dt;
      const progress = p.age / p.life;
      if (progress >= 1.0) {
        p.active = false;
        this.pos[i * 3 + 1] = -9999;
        continue;
      }
      p.x += p.vx + Math.sin(time * 2.0 + p.phase) * 0.012;
      p.y += p.vy;
      p.z += p.vz + Math.cos(time * 2.0 + p.phase) * 0.012;
      this.pos[i * 3] = p.x;
      this.pos[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = p.z;

      const alpha = Math.sin(progress * Math.PI) * (isPetting ? 0.88 : 0.68);
      this.colors[i * 3] = alpha * 0.88;
      this.colors[i * 3 + 1] = alpha * 0.94;
      this.colors[i * 3 + 2] = alpha * 1.0;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
