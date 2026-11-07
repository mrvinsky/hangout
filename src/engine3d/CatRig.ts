import * as THREE from 'three';

export type CatBehavior = 'WALK' | 'IDLE' | 'PET_REACT';

const LEG_BONES = [
  'Thigh_FR', 'Knee_FR', 'Foot_FR',
  'Thigh_FL', 'Knee_FL', 'Foot_FL',
  'Thigh_BR', 'Knee_BR', 'Foot_BR',
  'Thigh_BL', 'Knee_BL', 'Foot_BL',
];

/** Cat.glb iskeleti üzerinde prosedürel biyomekanik: yürüyüş, nefes, okşanma tepkisi. */
export class CatRig {
  private bones: Record<string, THREE.Bone> = {};
  private rest: Record<string, THREE.Euler> = {};
  private walkCyclePhase = 0;

  constructor(root: THREE.Object3D) {
    root.traverse((child) => {
      if ((child as THREE.Bone).isBone) {
        const b = child as THREE.Bone;
        this.bones[b.name] = b;
        this.rest[b.name] = b.rotation.clone();
      }
    });
  }

  get isReady(): boolean {
    return !!this.bones['Thigh_FR'];
  }

  /** rest pozuna göre eksen ofseti uygular (kemik yoksa sessizce atlar) */
  private set(name: string, axis: 'x' | 'y' | 'z', offset: number) {
    const bone = this.bones[name];
    if (bone) bone.rotation[axis] = this.rest[name][axis] + offset;
  }

  private resetLegsToStand() {
    for (const name of LEG_BONES) {
      const bone = this.bones[name];
      const rest = this.rest[name];
      if (!bone || !rest) continue;
      bone.rotation.x += (rest.x - bone.rotation.x) * 0.12;
      bone.rotation.y += (rest.y - bone.rotation.y) * 0.12;
      bone.rotation.z += (rest.z - bone.rotation.z) * 0.12;
    }
  }

  update(behavior: CatBehavior, time: number, dt: number, turnVelocity: number) {
    if (!this.isReady) return;
    if (behavior === 'PET_REACT') this.animatePetReact(time);
    else if (behavior === 'IDLE') this.animateIdle(time);
    else this.animateWalk(dt, turnVelocity);
  }

  // 1. OKŞANMA VE SEVİLME REAKSİYONU
  private animatePetReact(time: number) {
    const purrWave = Math.sin(time * 18.0); // mırlama rezonansı
    // Başını kullanıcının eline doğru kaldırır
    this.set('Head', 'x', 0.38 + purrWave * 0.02);
    this.set('Head', 'z', Math.sin(time * 2.5) * 0.05);
    this.set('Neck', 'x', 0.18);
    // Ağız hafif aralanır
    this.set('Jaw', 'x', 0.15 + purrWave * 0.02);
    // Sırt kabartma
    this.set('Torso', 'x', 0.08);
    this.set('Torso', 'z', purrWave * 0.015);
    // Kuyruk havaya kalkar, ucu kıvrılır
    this.set('Tail_1', 'x', -0.45);
    this.set('Tail_2', 'x', 0.35);
    this.set('Tail_3', 'x', 0.65);
    this.set('Tail_3', 'y', Math.sin(time * 5.0) * 0.32);
    this.resetLegsToStand();
  }

  // 2. DURUŞ & MERAKLI ETRAFA BAKINMA
  private animateIdle(time: number) {
    const breath = Math.sin(time * 2.2);
    this.set('Torso', 'z', breath * 0.028);
    this.set('Pelvis', 'x', breath * 0.016);

    const lookYaw = Math.sin(time * 0.75) * 0.28;
    const headTilt = Math.cos(time * 0.95) * 0.12;
    this.set('Neck', 'y', lookYaw * 0.5);
    this.set('Neck', 'x', breath * 0.02);
    this.set('Head', 'y', lookYaw * 0.7);
    this.set('Head', 'z', headTilt);
    this.set('Head', 'x', -0.04 + Math.sin(time * 1.1) * 0.03);

    // Kulak seğirmesi
    if (this.bones['Ear_R1']) {
      this.bones['Ear_R1'].rotation.z = Math.sin(time * 4.4) > 0.92 ? Math.sin(time * 26.0) * 0.18 : 0;
    }
    if (this.bones['Ear_L1']) {
      this.bones['Ear_L1'].rotation.z = Math.sin(time * 3.2) > 0.93 ? Math.sin(time * 24.0) * 0.18 : 0;
    }
    this.set('Jaw', 'x', 0);

    // Tembel kuyruk salınımı
    this.set('Tail_1', 'y', Math.sin(time * 1.2) * 0.16);
    this.set('Tail_2', 'y', Math.sin(time * 1.2 - 0.7) * 0.30);
    this.set('Tail_3', 'y', Math.sin(time * 1.2 - 1.4) * 0.44);
    this.resetLegsToStand();
  }

  // 3. DÖRT AYAKLI ÇAPRAZ YÜRÜYÜŞ (diagonal gait)
  private animateWalk(dt: number, turnVelocity: number) {
    this.walkCyclePhase += dt * 4.4;
    const step = this.walkCyclePhase;
    const phaseA = step;
    const phaseB = step + Math.PI;
    const legAmp = 0.38;

    // Ön bacaklar z ekseninde: öne atılırken diz kırılır
    const front = (side: 'FR' | 'FL', phase: number) => {
      const swing = Math.sin(phase);
      this.set(`Thigh_${side}`, 'z', swing * legAmp);
      this.set(`Knee_${side}`, 'z', -(swing < 0 ? -swing * 0.72 : swing * 0.14));
      this.set(`Foot_${side}`, 'z', Math.sin(phase - 0.4) * 0.32);
    };
    // Arka bacaklar x ekseninde
    const rear = (side: 'BR' | 'BL', phase: number) => {
      const swing = Math.sin(phase);
      this.set(`Thigh_${side}`, 'x', swing * legAmp);
      this.set(`Knee_${side}`, 'x', swing > 0 ? swing * 0.65 : -swing * 0.15);
      this.set(`Foot_${side}`, 'x', -Math.sin(phase - 0.3) * 0.28);
    };
    front('FR', phaseA);
    front('FL', phaseB);
    rear('BR', phaseB);
    rear('BL', phaseA);

    // Omurga, kalça ve göğüs
    this.set('Pelvis', 'y', Math.sin(step) * 0.08);
    this.set('Pelvis', 'x', Math.cos(step * 2) * 0.04);
    this.set('Torso', 'y', -Math.sin(step) * 0.06);
    this.set('Torso', 'z', Math.cos(step * 2) * 0.038);

    // Baş dengelemesi, dönüşe doğru bakma
    this.set('Neck', 'x', Math.sin(step * 2 - 0.2) * 0.05);
    this.set('Neck', 'y', Math.sin(step) * 0.04);
    this.set('Head', 'x', -Math.sin(step * 2 - 0.2) * 0.035);
    this.set('Head', 'y', Math.max(-0.4, Math.min(0.4, turnVelocity * 3.2)));

    // S-dalgası kuyruk
    this.set('Tail_1', 'y', Math.sin(step * 1.4) * 0.26);
    this.set('Tail_1', 'x', Math.cos(step * 1.4) * 0.12);
    this.set('Tail_2', 'y', Math.sin(step * 1.4 - 0.6) * 0.44);
    this.set('Tail_3', 'y', Math.sin(step * 1.4 - 1.2) * 0.62);
  }
}
