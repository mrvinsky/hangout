import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PetMode, PetProfile } from '../types/pet';
import { CameraControls } from './CameraControls';
import { CatBehavior, CatRig } from './CatRig';
import { recolorFurTexture, seedFromId } from './furTexture';
import { GROUND_Y, GroundPlane } from './GroundPlane';
import { AuraSystem, SwarmSystem } from './ParticleSystems';
import { PetAudio } from './PetAudio';

const MODEL_PATH = '/models/cat/source/Cat.glb';
const CAT_SCALE = 45.0;
const PATRONUS_EMISSIVE = 0xddeeff;
const DEFAULT_AURA = '#dbeafe';

/**
 * Sahneyi kuran ve her kareyi yöneten orkestra şefi.
 * Alt sistemler: CatRig (iskelet), SwarmSystem/AuraSystem (parçacıklar),
 * GroundPlane (gölge), CameraControls (jiroskop/sürükleme/pinch), PetAudio (mırlama),
 * furTexture (profile göre kürk boyama).
 */
export class PetCompanionEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: CameraControls;
  private clock = new THREE.Clock();
  private animFrameId: number | null = null;
  private isRunning = false;
  private disposed = false;

  private ground: GroundPlane;
  private swarm = new SwarmSystem();
  private aura = new AuraSystem();
  private audio = new PetAudio();

  // Model
  private catScene: THREE.Group | null = null;
  private rig: CatRig | null = null;
  private surfaceSamples: THREE.Vector3[] = [];
  private furMaterials: { mat: THREE.MeshStandardMaterial; source: THREE.Texture }[] = [];
  private eyeLeft: THREE.Group | null = null;
  private eyeRight: THREE.Group | null = null;
  private halo: THREE.Mesh | null = null;

  // Hareket
  private catPos = new THREE.Vector3(0, GROUND_Y, 0);
  private catTarget = new THREE.Vector3(0, GROUND_Y, 0);
  private readonly catSpeed = 0.2;
  private catRotY = 0;
  private turnVelocity = 0;
  private scaleFactor = 1.0;

  // Davranış
  private behavior: CatBehavior = 'WALK';
  private idleTimer = 0;
  private petReactTimer = 0;
  private summonState: 'IDLE' | 'SWARM' | 'CONVERGE' | 'ACTIVE' = 'IDLE';
  private summonStart = 0;

  private profile: PetProfile;

  /** Okşanınca tetiklenir (ör. native titreşim köprüsü) */
  onPetted?: () => void;

  constructor(private canvas: HTMLCanvasElement, profile: PetProfile) {
    this.profile = { ...profile };

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0x000000, 0);

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000);
    this.camera.position.set(0, 4, 75);
    this.camera.lookAt(0, -6, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const dirLight = new THREE.DirectionalLight(0xfff8f0, 1.6);
    dirLight.position.set(20, 40, 30);
    this.scene.add(dirLight);
    const rimLight = new THREE.PointLight(0xddeeff, 2.8, 120);
    rimLight.position.set(-20, 25, -20);
    this.scene.add(rimLight);

    this.ground = new GroundPlane(this.profile.mode);
    this.scene.add(this.ground.group, this.swarm.points, this.aura.points);
    this.applyAuraTint();

    this.controls = new CameraControls(canvas, this.camera, this.renderer, () => this.scaleFactor, (s) => this.setScaleFactor(s));
    this.loadModel();
  }

  private loadModel() {
    new GLTFLoader().load(
      MODEL_PATH,
      (gltf) => {
        if (this.disposed) return;
        const cat = gltf.scene;
        cat.scale.setScalar(CAT_SCALE * this.scaleFactor);
        cat.position.copy(this.catPos);

        cat.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat?.isMeshStandardMaterial) {
            mat.roughness = 0.65;
            mat.metalness = 0.08;
            mat.side = THREE.DoubleSide;
            if (mat.map) this.furMaterials.push({ mat, source: mat.map });
          }
          this.sampleSurface(mesh.geometry);
        });

        this.halo = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.45, 16, 40), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
        this.halo.rotation.x = Math.PI * 0.42;
        this.halo.position.set(0, 19.5, 9.5);
        cat.add(this.halo);

        this.catScene = cat;
        this.rig = new CatRig(cat);
        this.applyAppearance();
        cat.visible = false;
        this.scene.add(cat);
        this.summon();
      },
      undefined,
      (err) => console.warn('Model yüklenemedi:', err)
    );
  }

  /** Parçacık birleşmesi ve aura için yüzeyden rastgele noktalar örnekle */
  private sampleSurface(geom: THREE.BufferGeometry) {
    if (!geom?.attributes.position || !geom.index) return;
    const pos = geom.attributes.position;
    const idx = geom.index;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < idx.count; i += 3) {
      a.fromBufferAttribute(pos, idx.getX(i)).multiplyScalar(CAT_SCALE);
      b.fromBufferAttribute(pos, idx.getX(i + 1)).multiplyScalar(CAT_SCALE);
      c.fromBufferAttribute(pos, idx.getX(i + 2)).multiplyScalar(CAT_SCALE);
      for (let s = 0; s < 6; s++) {
        const sqrtR1 = Math.sqrt(Math.random());
        const u = 1 - sqrtR1;
        const v = Math.random() * sqrtR1;
        const w = 1 - u - v;
        this.surfaceSamples.push(new THREE.Vector3().addScaledVector(a, u).addScaledVector(b, v).addScaledVector(c, w));
      }
    }
  }

  private createEye(side: number, eyeColor: string): THREE.Group {
    const group = new THREE.Group();
    const color = new THREE.Color(eyeColor || '#ffb703');

    group.add(new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 16), new THREE.MeshBasicMaterial({ color })));

    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.45, 0.5), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    pupil.position.z = 0.88;
    group.add(pupil);

    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(0.32, 0.35, 0.95);
    group.add(glint);

    const eyeLight = new THREE.PointLight(color, 1.5, 16);
    eyeLight.position.set(0, 0, 2);
    group.add(eyeLight);

    group.position.set(side * 1.85, 16.0, 13.5);
    return group;
  }

  /** Kürk dokusu, göz rengi ve mod görünümünü profile göre uygula */
  private applyAppearance() {
    if (!this.catScene) return;
    const p = this.profile;
    const seed = seedFromId(p.id);

    for (const { mat, source } of this.furMaterials) {
      const recolored = recolorFurTexture(source, mat.name, {
        furHex: p.furColorHex,
        secondaryHex: p.secondaryColorHex || p.furColorHex,
        pattern: p.coatPattern,
        seed,
      });
      if (recolored) {
        if (mat.map && mat.map !== source) mat.map.dispose();
        mat.map = recolored;
        mat.color.set(0xffffff);
      } else {
        mat.color.set(p.furColorHex);
      }
      mat.needsUpdate = true;
    }

    if (this.eyeLeft) this.catScene.remove(this.eyeLeft);
    if (this.eyeRight) this.catScene.remove(this.eyeRight);
    this.eyeLeft = this.createEye(-1, p.eyeColorHex);
    this.eyeRight = this.createEye(1, p.eyeColorHex);
    this.catScene.add(this.eyeLeft, this.eyeRight);

    this.applyAuraTint();
    this.applyMode();
  }

  private applyAuraTint() {
    const tint = this.profile.auraColorHex || DEFAULT_AURA;
    this.swarm.setTint(tint);
    this.aura.setTint(tint);
    this.ground.setTint(tint);
  }

  private applyMode() {
    const patronus = this.profile.mode === 'patronus';
    this.ground.setMode(this.profile.mode);
    if (this.halo) this.halo.visible = patronus;
    if (!patronus) this.aura.clear();
    this.aura.points.visible = patronus && this.summonState === 'ACTIVE';
    for (const { mat } of this.furMaterials) {
      mat.emissive.set(patronus ? PATRONUS_EMISSIVE : 0x000000);
      mat.emissiveIntensity = patronus ? 0.38 : 0.0;
    }
  }

  public summon() {
    this.summonState = 'SWARM';
    this.summonStart = performance.now();
    this.swarm.points.visible = true;
    if (this.catScene) this.catScene.visible = false;
    this.ground.group.visible = false;
    this.aura.points.visible = false;
    this.pickNewDestination();
  }

  public setMode(mode: PetMode) {
    this.profile.mode = mode;
    this.applyMode();
  }

  public setScaleFactor(factor: number) {
    this.scaleFactor = Math.max(0.3, Math.min(2.5, factor));
    this.catScene?.scale.setScalar(CAT_SCALE * this.scaleFactor);
    this.ground.setScale(this.scaleFactor);
  }

  public getScaleFactor(): number {
    return this.scaleFactor;
  }

  public updateProfile(newProfile: PetProfile) {
    this.profile = { ...newProfile };
    this.applyAppearance();
    this.summon();
  }

  public petPet() {
    this.petReactTimer = 3.0;
    this.behavior = 'PET_REACT';
    this.audio.purr(3.0);
    this.onPetted?.();
  }

  private pickNewDestination() {
    this.catTarget.x = (Math.random() - 0.5) * 50;
    this.catTarget.z = (Math.random() - 0.5) * 40;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.loop();
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /** Döngüyü durdurur, dinleyicileri ve GPU kaynaklarını serbest bırakır */
  public dispose() {
    this.stop();
    this.disposed = true;
    this.controls.dispose();
    this.audio.dispose();
    this.renderer.dispose();
  }

  private updateBehavior(dt: number) {
    if (this.petReactTimer > 0) {
      this.petReactTimer -= dt;
      this.behavior = this.petReactTimer > 0 ? 'PET_REACT' : 'IDLE';
      if (this.behavior === 'IDLE') this.idleTimer = 1.5;
    } else if (this.behavior === 'IDLE') {
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) {
        this.behavior = 'WALK';
        this.pickNewDestination();
      }
    }

    if (this.behavior !== 'WALK') {
      this.turnVelocity = 0;
      return;
    }
    const dx = this.catTarget.x - this.catPos.x;
    const dz = this.catTarget.z - this.catPos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 4.5) {
      // Hedefe ulaştı: meraklı duruş molası
      this.behavior = 'IDLE';
      this.idleTimer = 2.5 + Math.random() * 3.0;
      this.turnVelocity = 0;
      return;
    }
    this.catPos.x += (dx / dist) * this.catSpeed;
    this.catPos.z += (dz / dist) * this.catSpeed;
    let diff = Math.atan2(dx, dz) - this.catRotY;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.turnVelocity = diff * 0.08;
    this.catRotY += this.turnVelocity;
  }

  private loop = () => {
    if (!this.isRunning) return;
    this.animFrameId = requestAnimationFrame(this.loop);

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.getElapsedTime();
    this.controls.update();

    if (this.summonState !== 'IDLE') {
      const elapsed = performance.now() - this.summonStart;

      if (elapsed < SwarmSystem.VORTEX_MS) {
        this.swarm.updateVortex(elapsed / SwarmSystem.VORTEX_MS, time);
      } else if (elapsed < SwarmSystem.VORTEX_MS + SwarmSystem.CONVERGE_MS) {
        this.summonState = 'CONVERGE';
        const progress = (elapsed - SwarmSystem.VORTEX_MS) / SwarmSystem.CONVERGE_MS;
        this.swarm.updateConverge(progress, this.surfaceSamples, this.catPos);
      } else {
        if (this.summonState !== 'ACTIVE') {
          this.summonState = 'ACTIVE';
          if (this.catScene) this.catScene.visible = true;
          this.ground.group.visible = true;
          this.swarm.points.visible = false;
          this.aura.points.visible = this.profile.mode === 'patronus';
        }

        this.updateBehavior(dt);

        if (this.catScene) {
          this.catScene.position.copy(this.catPos);
          this.catScene.rotation.y = this.catRotY;
          this.rig?.update(this.behavior, time, dt, this.turnVelocity);
        }
        if (this.halo?.visible) {
          this.halo.rotation.z += 0.035;
          this.halo.position.y = 19.5 + Math.sin(time * 2.5) * 0.7;
        }
        this.ground.follow(this.catPos.x, this.catPos.z);

        if (this.profile.mode === 'patronus') {
          this.aura.update(dt, time, this.surfaceSamples, this.catPos, this.catRotY, this.scaleFactor, this.petReactTimer > 0);
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  };
}
