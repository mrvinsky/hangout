import * as THREE from 'three';
import { PetMode } from '../types/pet';
import { createRadialTexture } from './textures';

export const GROUND_Y = -16.0;

/** Kedinin altındaki kontak gölgesi + Patronus modunda gümüş ışık havuzu. */
export class GroundPlane {
  readonly group = new THREE.Group();
  private puddle: THREE.Mesh;

  constructor(mode: PetMode) {
    this.group.position.set(0, GROUND_Y, 0);

    const puddleTex = createRadialTexture(128, [
      [0, 'rgba(225, 240, 255, 0.55)'],
      [0.5, 'rgba(180, 210, 255, 0.22)'],
      [1.0, 'rgba(0, 0, 0, 0)'],
    ], 64);
    this.puddle = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 54),
      new THREE.MeshBasicMaterial({ map: puddleTex, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.puddle.rotation.x = -Math.PI * 0.5;
    this.group.add(this.puddle);

    const shadowTex = createRadialTexture(128, [
      [0, 'rgba(0, 0, 0, 0.68)'],
      [0.6, 'rgba(0, 0, 0, 0.22)'],
      [1.0, 'rgba(0, 0, 0, 0)'],
    ], 60);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 38),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.7, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI * 0.5;
    shadow.position.y = 0.05;
    this.group.add(shadow);

    this.setMode(mode);
    this.group.visible = false;
  }

  setMode(mode: PetMode) {
    this.puddle.visible = mode === 'patronus';
  }

  setTint(hex: string) {
    (this.puddle.material as THREE.MeshBasicMaterial).color.set(hex);
  }

  follow(x: number, z: number) {
    this.group.position.set(x, GROUND_Y, z);
  }

  setScale(factor: number) {
    this.group.scale.set(factor, 1, factor);
  }
}
