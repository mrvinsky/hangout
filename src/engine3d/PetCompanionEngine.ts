import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PetProfile } from '../types/pet';

export class PetCompanionEngine {
  private canvas: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private isRunning: boolean = false;
  private animFrameId: number | null = null;

  // Model & Bones
  private catScene: THREE.Group | null = null;
  private catBones: Record<string, THREE.Bone> = {};
  private catRestRot: Record<string, THREE.Euler> = {};
  private catTargetVertices: THREE.Vector3[] = [];
  private eyeLeftGroup: THREE.Group | null = null;
  private eyeRightGroup: THREE.Group | null = null;
  private haloMesh: THREE.Mesh | null = null;

  // Pozisyon & Yürüyüş
  private catPos = new THREE.Vector3(0, -16.0, 0);
  private catTargetPos = new THREE.Vector3(0, -16.0, 0);
  private catSpeed = 0.20;
  private catRotY = 0;
  private readonly catScale = 45.0;
  private currentScaleFactor = 1.0;

  // Zemin & Gölge
  private groundGroup!: THREE.Group;
  private puddleMesh!: THREE.Mesh;

  // Parçacık Sistemleri
  private readonly SWARM_COUNT = 24000;
  private swarmPoints!: THREE.Points;
  private swarmPos!: Float32Array;
  private swarmVortex: { angle: number; r: number; y: number; speed: number }[] = [];

  // Gövdeden Süzülen Ektoplazma Aurası (Hafif ve Asil 380 Parçacık)
  private readonly SURFACE_COUNT = 380;
  private surfacePoints!: THREE.Points;
  private surfacePos!: Float32Array;
  private surfaceColors!: Float32Array;
  private surfaceList: {
    active: boolean;
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    age: number; life: number; phase: number;
  }[] = [];

  // Biyomekanik Davranış Durumu (Doğal Kedi Hareketleri)
  private catBehavior: 'WALK' | 'IDLE' | 'PET_REACT' = 'WALK';
  private behaviorTimer: number = 0;
  private petReactTimer: number = 0;
  private walkCyclePhase: number = 0;
  private catRotYVel: number = 0;

  // State Machine
  private patronusState: 'IDLE' | 'SWARM' | 'CONVERGE' | 'ACTIVE' = 'IDLE';
  private stateStartTime: number = 0;
  private clock = new THREE.Clock();

  // Kamera & Kontrol
  private camYaw = 0;
  private camPitch = 0;
  private gyroYaw = 0;
  private gyroPitch = 0;
  private dragYaw = 0;
  private dragPitch = 0;
  private baseAlpha: number | null = null;
  private baseBeta: number | null = null;
  private isDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Profil
  private profile: PetProfile;

  constructor(canvas: HTMLCanvasElement, profile: PetProfile) {
    this.canvas = canvas;
    this.profile = profile;
    this.initScene();
    this.initGround();
    this.initSwarmSystem();
    this.initSurfaceSystem();
    this.initListeners();
    this.loadModel();
  }

  private initScene() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(this.canvas.clientWidth || window.innerWidth, this.canvas.clientHeight || window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      50,
      (this.canvas.clientWidth || window.innerWidth) / (this.canvas.clientHeight || window.innerHeight),
      0.1,
      1000
    );
    this.camera.position.set(0, 4, 75);
    this.camera.lookAt(0, -6, 0);

    // Işıklar
    const ambient = new THREE.AmbientLight(0xffffff, 1.4);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xfff8f0, 1.6);
    dirLight.position.set(20, 40, 30);
    this.scene.add(dirLight);

    const rimLight = new THREE.PointLight(0xddeeff, 2.8, 120);
    rimLight.position.set(-20, 25, -20);
    this.scene.add(rimLight);
  }

  private createSoftTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.4, 'rgba(235, 245, 255, 0.88)');
    grad.addColorStop(0.75, 'rgba(180, 210, 245, 0.35)');
    grad.addColorStop(1.0, 'rgba(140, 180, 240, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();
    return new THREE.CanvasTexture(c);
  }

  private initGround() {
    this.groundGroup = new THREE.Group();
    this.groundGroup.position.set(0, -16.0, 0);

    // Zemin Işık Havuzu
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 128; pCanvas.height = 128;
    const pCtx = pCanvas.getContext('2d')!;
    const pGrad = pCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    pGrad.addColorStop(0, 'rgba(225, 240, 255, 0.55)');
    pGrad.addColorStop(0.5, 'rgba(180, 210, 255, 0.22)');
    pGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    pCtx.fillStyle = pGrad;
    pCtx.fillRect(0, 0, 128, 128);
    const puddleTex = new THREE.CanvasTexture(pCanvas);

    this.puddleMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 54),
      new THREE.MeshBasicMaterial({ map: puddleTex, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.puddleMesh.rotation.x = -Math.PI * 0.5;
    this.puddleMesh.visible = this.profile.mode === 'patronus';
    this.groundGroup.add(this.puddleMesh);

    // Zemin Kontak Gölgesi
    const sCanvas = document.createElement('canvas');
    sCanvas.width = 128; sCanvas.height = 128;
    const sCtx = sCanvas.getContext('2d')!;
    const sGrad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 60);
    sGrad.addColorStop(0, 'rgba(0, 0, 0, 0.68)');
    sGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.22)');
    sGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(sCanvas);

    const shadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 38),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.7, depthWrite: false })
    );
    shadowMesh.rotation.x = -Math.PI * 0.5;
    shadowMesh.position.y = 0.05;
    this.groundGroup.add(shadowMesh);

    this.groundGroup.visible = false;
    this.scene.add(this.groundGroup);
  }

  private initSwarmSystem() {
    const geo = new THREE.BufferGeometry();
    this.swarmPos = new Float32Array(this.SWARM_COUNT * 3);
    const colors = new Float32Array(this.SWARM_COUNT * 3);
    const softTex = this.createSoftTexture();

    for (let i = 0; i < this.SWARM_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 45;
      const y = (Math.random() - 0.5) * 40;
      this.swarmVortex.push({ angle, r, y, speed: 0.045 + Math.random() * 0.06 });

      const shade = 0.88 + Math.random() * 0.12;
      colors[i * 3] = shade;
      colors[i * 3 + 1] = shade * 0.98;
      colors[i * 3 + 2] = 1.0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.swarmPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 2.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      map: softTex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.swarmPoints = new THREE.Points(geo, mat);
    this.swarmPoints.visible = false;
    this.scene.add(this.swarmPoints);
  }

  private initSurfaceSystem() {
    const geo = new THREE.BufferGeometry();
    this.surfacePos = new Float32Array(this.SURFACE_COUNT * 3);
    this.surfaceColors = new Float32Array(this.SURFACE_COUNT * 3);
    const softTex = this.createSoftTexture();

    for (let i = 0; i < this.SURFACE_COUNT; i++) {
      this.surfacePos[i * 3 + 1] = -9999;
      this.surfaceList.push({
        active: false,
        x: 0, y: -9999, z: 0,
        vx: 0, vy: 0, vz: 0,
        age: 0,
        life: 2.5 + Math.random() * 1.5,
        phase: Math.random() * 10,
      });
      this.surfaceColors[i * 3] = 0.92;
      this.surfaceColors[i * 3 + 1] = 0.96;
      this.surfaceColors[i * 3 + 2] = 1.0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.surfacePos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.surfaceColors, 3));

    const mat = new THREE.PointsMaterial({
      size: 2.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      map: softTex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.surfacePoints = new THREE.Points(geo, mat);
    this.surfacePoints.visible = false;
    this.scene.add(this.surfacePoints);
  }

  private createAmberEye(side: number, eyeColor: string): THREE.Group {
    const group = new THREE.Group();
    const colorInt = parseInt(eyeColor.replace('#', '0x'), 16) || 0xffb703;

    const irisGeo = new THREE.SphereGeometry(1.05, 16, 16);
    const irisMat = new THREE.MeshBasicMaterial({ color: colorInt });
    group.add(new THREE.Mesh(irisGeo, irisMat));

    const pupilGeo = new THREE.BoxGeometry(0.32, 1.45, 0.5);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
    const pupilMesh = new THREE.Mesh(pupilGeo, pupilMat);
    pupilMesh.position.z = 0.88;
    group.add(pupilMesh);

    const glintGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const glintMesh = new THREE.Mesh(glintGeo, glintMat);
    glintMesh.position.set(0.32, 0.35, 0.95);
    group.add(glintMesh);

    const eyeLight = new THREE.PointLight(colorInt, 1.5, 16);
    eyeLight.position.set(0, 0, 2);
    group.add(eyeLight);

    group.position.set(side * 1.85, 16.0, 13.5);
    return group;
  }

  private loadModel() {
    const loader = new GLTFLoader();
    const modelPath = '/models/cat/source/Cat.glb';

    loader.load(
      modelPath,
      (gltf) => {
        this.catScene = gltf.scene;
        this.catScene.scale.set(this.catScale, this.catScale, this.catScale);
        this.catScene.position.set(0, -16.0, 0);

        this.catScene.traverse((child) => {
          if ((child as THREE.Bone).isBone) {
            const b = child as THREE.Bone;
            this.catBones[b.name] = b;
            this.catRestRot[b.name] = b.rotation.clone();
          }
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            m.castShadow = true;
            if (m.material) {
              const mat = m.material as THREE.MeshStandardMaterial;
              mat.roughness = 0.65;
              mat.metalness = 0.08;
              mat.side = THREE.DoubleSide;

              if (this.profile.furColorHex) {
                mat.color = new THREE.Color(this.profile.furColorHex);
              }

              if (this.profile.mode === 'patronus') {
                mat.emissive = new THREE.Color(0xddeeff);
                mat.emissiveIntensity = 0.38;
              } else {
                mat.emissive = new THREE.Color(0x000000);
                mat.emissiveIntensity = 0.0;
              }
            }

            // Surface sampling for particle convergence
            const geom = m.geometry;
            if (geom && geom.attributes.position && geom.index) {
              const posAttr = geom.attributes.position;
              const idxAttr = geom.index;
              for (let i = 0; i < idxAttr.count; i += 3) {
                const a = idxAttr.getX(i);
                const b = idxAttr.getX(i + 1);
                const c = idxAttr.getX(i + 2);

                const vA = new THREE.Vector3().fromBufferAttribute(posAttr, a).multiplyScalar(this.catScale);
                const vB = new THREE.Vector3().fromBufferAttribute(posAttr, b).multiplyScalar(this.catScale);
                const vC = new THREE.Vector3().fromBufferAttribute(posAttr, c).multiplyScalar(this.catScale);

                for (let s = 0; s < 6; s++) {
                  const r1 = Math.random();
                  const r2 = Math.random();
                  const sqrtR1 = Math.sqrt(r1);
                  const u = 1 - sqrtR1;
                  const v = r2 * sqrtR1;
                  const w = 1 - u - v;

                  const pt = new THREE.Vector3()
                    .addScaledVector(vA, u)
                    .addScaledVector(vB, v)
                    .addScaledVector(vC, w);
                  this.catTargetVertices.push(pt);
                }
              }
            }
          }
        });

        // Kehribar Gözleri Ekle
        this.eyeLeftGroup = this.createAmberEye(-1, this.profile.eyeColorHex);
        this.eyeRightGroup = this.createAmberEye(1, this.profile.eyeColorHex);
        this.catScene.add(this.eyeLeftGroup);
        this.catScene.add(this.eyeRightGroup);

        // Kutsal Taç (Patronus Modu İçin)
        const haloGeo = new THREE.TorusGeometry(3.6, 0.45, 16, 40);
        const haloMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
        this.haloMesh = new THREE.Mesh(haloGeo, haloMat);
        this.haloMesh.rotation.x = Math.PI * 0.42;
        this.haloMesh.position.set(0, 19.5, 9.5);
        this.haloMesh.visible = this.profile.mode === 'patronus';
        this.catScene.add(this.haloMesh);

        this.catScene.visible = false;
        this.scene.add(this.catScene);
        this.summon();
      },
      undefined,
      (err) => console.warn('Model loading fallback:', err)
    );
  }

  public summon() {
    this.patronusState = 'SWARM';
    this.stateStartTime = Date.now();
    this.swarmPoints.visible = true;
    if (this.catScene) this.catScene.visible = false;
    this.groundGroup.visible = false;
    this.surfacePoints.visible = false;
    this.pickNewDestination();
  }

  public setMode(mode: 'patronus' | 'living') {
    this.profile.mode = mode;
    if (this.haloMesh) this.haloMesh.visible = mode === 'patronus';
    if (this.puddleMesh) this.puddleMesh.visible = mode === 'patronus';
    if (this.surfacePoints) {
      this.surfacePoints.visible = mode === 'patronus';
      if (mode !== 'patronus') {
        // Canlı modda auranın tamamını anında temizle
        for (let i = 0; i < this.SURFACE_COUNT; i++) {
          this.surfaceList[i].active = false;
          this.surfacePos[i * 3 + 1] = -9999;
        }
        this.surfacePoints.geometry.attributes.position.needsUpdate = true;
      }
    }
    if (this.catScene) {
      this.catScene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (mat) {
            mat.emissive = mode === 'patronus' ? new THREE.Color(0xddeeff) : new THREE.Color(0x000000);
            mat.emissiveIntensity = mode === 'patronus' ? 0.38 : 0.0;
          }
        }
      });
    }
  }

  public setScaleFactor(factor: number) {
    this.currentScaleFactor = Math.max(0.3, Math.min(2.5, factor));
    if (this.catScene) {
      const s = this.catScale * this.currentScaleFactor;
      this.catScene.scale.set(s, s, s);
    }
    if (this.groundGroup) {
      this.groundGroup.scale.set(this.currentScaleFactor, 1, this.currentScaleFactor);
    }
  }

  public getScaleFactor(): number {
    return this.currentScaleFactor;
  }

  public updateProfile(newProfile: PetProfile) {
    this.profile = newProfile;
    if (this.catScene) {
      // 1. Kürk rengini ve materyalini güncelle
      this.catScene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          if (m.material) {
            const mat = m.material as THREE.MeshStandardMaterial;
            if (newProfile.furColorHex) {
              mat.color = new THREE.Color(newProfile.furColorHex);
            }
            if (newProfile.mode === 'patronus') {
              mat.emissive = new THREE.Color(0xddeeff);
              mat.emissiveIntensity = 0.38;
            } else {
              mat.emissive = new THREE.Color(0x000000);
              mat.emissiveIntensity = 0.0;
            }
          }
        }
      });

      // 2. Gözleri yeni renk ile baştan oluştur
      if (this.eyeLeftGroup) this.catScene.remove(this.eyeLeftGroup);
      if (this.eyeRightGroup) this.catScene.remove(this.eyeRightGroup);
      this.eyeLeftGroup = this.createAmberEye(-1, this.profile.eyeColorHex);
      this.eyeRightGroup = this.createAmberEye(1, this.profile.eyeColorHex);
      this.catScene.add(this.eyeLeftGroup);
      this.catScene.add(this.eyeRightGroup);

      // 3. Taç durumunu güncelle
      if (this.haloMesh) {
        this.haloMesh.visible = this.profile.mode === 'patronus';
      }
    }
    // Yeni görünümü manyetik girdapla sahneye çağır
    this.summon();
  }

  public petPet() {
    // Okşama tepkisi: Mırlama, sırtını kabartma, kafayı yukarı kaldırma ve ışık parlaması
    this.petReactTimer = 3.0;
    this.catBehavior = 'PET_REACT';
  }

  private pickNewDestination() {
    this.catTargetPos.x = (Math.random() - 0.5) * 50;
    this.catTargetPos.z = (Math.random() - 0.5) * 40;
  }

  private spawnSurfaceParticle(index: number) {
    if (this.catTargetVertices.length === 0) return;
    const p = this.surfaceList[index];
    const v = this.catTargetVertices[Math.floor(Math.random() * this.catTargetVertices.length)];

    const cosR = Math.cos(this.catRotY);
    const sinR = Math.sin(this.catRotY);
    const scale = this.currentScaleFactor;
    const wx = this.catPos.x + (v.x * cosR + v.z * sinR) * scale;
    const wy = this.catPos.y + v.y * scale;
    const wz = this.catPos.z + (-v.x * sinR + v.z * cosR) * scale;

    const isPetting = this.petReactTimer > 0;
    p.active = true;
    p.x = wx; p.y = wy; p.z = wz;
    p.vx = (Math.random() - 0.5) * (isPetting ? 0.022 : 0.012);
    p.vy = (isPetting ? 0.048 : 0.026) + Math.random() * 0.022;
    p.vz = (Math.random() - 0.5) * (isPetting ? 0.022 : 0.012);
    p.age = 0;
    p.life = 2.0 + Math.random() * 1.5;
  }

  private resetLegsToStand() {
    const legBones = [
      'Thigh_FR', 'Knee_FR', 'Foot_FR',
      'Thigh_FL', 'Knee_FL', 'Foot_FL',
      'Thigh_BR', 'Knee_BR', 'Foot_BR',
      'Thigh_BL', 'Knee_BL', 'Foot_BL',
    ];
    for (const name of legBones) {
      if (this.catBones[name] && this.catRestRot[name]) {
        this.catBones[name].rotation.x += (this.catRestRot[name].x - this.catBones[name].rotation.x) * 0.12;
        this.catBones[name].rotation.y += (this.catRestRot[name].y - this.catBones[name].rotation.y) * 0.12;
        this.catBones[name].rotation.z += (this.catRestRot[name].z - this.catBones[name].rotation.z) * 0.12;
      }
    }
  }

  private updateCatBiomechanics(time: number, dt: number) {
    if (!this.catBones['Thigh_FR']) return;

    // Timer kontrolleri
    if (this.petReactTimer > 0) {
      this.petReactTimer -= dt;
      this.catBehavior = 'PET_REACT';
    } else if (this.behaviorTimer > 0) {
      this.behaviorTimer -= dt;
      if (this.behaviorTimer <= 0 && this.catBehavior === 'IDLE') {
        this.catBehavior = 'WALK';
        this.pickNewDestination();
      }
    }

    // 1. OKŞANMA VE SEVİLME REAKSİYONU (PET_REACT)
    if (this.catBehavior === 'PET_REACT') {
      const purrWave = Math.sin(time * 18.0); // Tatlı mırlama rezonansı
      
      // Başını kullanıcının eline doğru gururla kaldırır
      if (this.catBones['Head']) {
        this.catBones['Head'].rotation.x = this.catRestRot['Head'].x + 0.38 + purrWave * 0.02;
        this.catBones['Head'].rotation.z = this.catRestRot['Head'].z + Math.sin(time * 2.5) * 0.05;
      }
      if (this.catBones['Neck']) {
        this.catBones['Neck'].rotation.x = this.catRestRot['Neck'].x + 0.18;
      }
      // Ağız hafif aralanır (sessiz mırlama)
      if (this.catBones['Jaw']) {
        this.catBones['Jaw'].rotation.x = this.catRestRot['Jaw'].x + 0.15 + purrWave * 0.02;
      }
      // Sırt kabartma (arching back)
      if (this.catBones['Torso']) {
        this.catBones['Torso'].rotation.x = this.catRestRot['Torso'].x + 0.08;
        this.catBones['Torso'].rotation.z = this.catRestRot['Torso'].z + purrWave * 0.015;
      }
      // Kuyruk neşeyle havaya kalkar ve ucu kıvrılır
      if (this.catBones['Tail_1']) this.catBones['Tail_1'].rotation.x = this.catRestRot['Tail_1'].x - 0.45;
      if (this.catBones['Tail_2']) this.catBones['Tail_2'].rotation.x = this.catRestRot['Tail_2'].x + 0.35;
      if (this.catBones['Tail_3']) {
        this.catBones['Tail_3'].rotation.x = this.catRestRot['Tail_3'].x + 0.65;
        this.catBones['Tail_3'].rotation.y = this.catRestRot['Tail_3'].y + Math.sin(time * 5.0) * 0.32;
      }
      this.resetLegsToStand();
      return;
    }

    // 2. DURUŞ & MERAKLI ETRAFA BAKINMA MODU (IDLE)
    if (this.catBehavior === 'IDLE') {
      const breath = Math.sin(time * 2.2);

      // Göğüs ve karın nefes alır gibi ritmik salınır
      if (this.catBones['Torso']) {
        this.catBones['Torso'].rotation.z = this.catRestRot['Torso'].z + breath * 0.028;
      }
      if (this.catBones['Pelvis']) {
        this.catBones['Pelvis'].rotation.x = this.catRestRot['Pelvis'].x + breath * 0.016;
      }

      // Meraklı kafa hareketleri: Etrafa bakınır, başını yana eğer
      const lookYaw = Math.sin(time * 0.75) * 0.28;
      const headTilt = Math.cos(time * 0.95) * 0.12;
      if (this.catBones['Neck']) {
        this.catBones['Neck'].rotation.y = this.catRestRot['Neck'].y + lookYaw * 0.5;
        this.catBones['Neck'].rotation.x = this.catRestRot['Neck'].x + breath * 0.02;
      }
      if (this.catBones['Head']) {
        this.catBones['Head'].rotation.y = this.catRestRot['Head'].y + lookYaw * 0.7;
        this.catBones['Head'].rotation.z = this.catRestRot['Head'].z + headTilt;
        this.catBones['Head'].rotation.x = this.catRestRot['Head'].x - 0.04 + Math.sin(time * 1.1) * 0.03;
      }

      // Kulak seğirmesi (doğal kedi refleksi)
      if (this.catBones['Ear_R1']) {
        const twitch = Math.sin(time * 4.4) > 0.92 ? Math.sin(time * 26.0) * 0.18 : 0;
        this.catBones['Ear_R1'].rotation.z = twitch;
      }
      if (this.catBones['Ear_L1']) {
        const twitchL = Math.sin(time * 3.2) > 0.93 ? Math.sin(time * 24.0) * 0.18 : 0;
        this.catBones['Ear_L1'].rotation.z = twitchL;
      }

      if (this.catBones['Jaw']) {
        this.catBones['Jaw'].rotation.x = this.catRestRot['Jaw'].x;
      }

      // Tembel kuyruk salınımı
      if (this.catBones['Tail_1']) this.catBones['Tail_1'].rotation.y = this.catRestRot['Tail_1'].y + Math.sin(time * 1.2) * 0.16;
      if (this.catBones['Tail_2']) this.catBones['Tail_2'].rotation.y = this.catRestRot['Tail_2'].y + Math.sin(time * 1.2 - 0.7) * 0.30;
      if (this.catBones['Tail_3']) this.catBones['Tail_3'].rotation.y = this.catRestRot['Tail_3'].y + Math.sin(time * 1.2 - 1.4) * 0.44;

      this.resetLegsToStand();
      return;
    }

    // 3. DOĞAL 4 AYAKLI KEDİ YÜRÜYÜŞÜ (WALK - Articulated Quadruped)
    const walkSpeed = 4.4;
    this.walkCyclePhase += dt * walkSpeed;
    const step = this.walkCyclePhase;

    // Çapraz adımlar (diagonal gait)
    const phaseA = step;
    const phaseB = step + Math.PI;

    const swingFR = Math.sin(phaseA);
    const swingFL = Math.sin(phaseB);
    const swingBR = Math.sin(phaseB);
    const swingBL = Math.sin(phaseA);

    const legAmp = 0.38;

    // --- ÖN SAĞ BACAK (FR) ---
    if (this.catBones['Thigh_FR']) {
      this.catBones['Thigh_FR'].rotation.z = this.catRestRot['Thigh_FR'].z + swingFR * legAmp;
    }
    if (this.catBones['Knee_FR']) {
      // Öne atılırken diz kırılır, pati havaya kalkar
      const kneeBend = swingFR < 0 ? -swingFR * 0.72 : swingFR * 0.14;
      this.catBones['Knee_FR'].rotation.z = this.catRestRot['Knee_FR'].z - kneeBend;
    }
    if (this.catBones['Foot_FR']) {
      this.catBones['Foot_FR'].rotation.z = this.catRestRot['Foot_FR'].z + Math.sin(phaseA - 0.4) * 0.32;
    }

    // --- ÖN SOL BACAK (FL) ---
    if (this.catBones['Thigh_FL']) {
      this.catBones['Thigh_FL'].rotation.z = this.catRestRot['Thigh_FL'].z + swingFL * legAmp;
    }
    if (this.catBones['Knee_FL']) {
      const kneeBendL = swingFL < 0 ? -swingFL * 0.72 : swingFL * 0.14;
      this.catBones['Knee_FL'].rotation.z = this.catRestRot['Knee_FL'].z - kneeBendL;
    }
    if (this.catBones['Foot_FL']) {
      this.catBones['Foot_FL'].rotation.z = this.catRestRot['Foot_FL'].z + Math.sin(phaseB - 0.4) * 0.32;
    }

    // --- ARKA SAĞ BACAK (BR) ---
    if (this.catBones['Thigh_BR']) {
      this.catBones['Thigh_BR'].rotation.x = this.catRestRot['Thigh_BR'].x + swingBR * legAmp;
    }
    if (this.catBones['Knee_BR']) {
      const rearKneeBend = swingBR > 0 ? swingBR * 0.65 : -swingBR * 0.15;
      this.catBones['Knee_BR'].rotation.x = this.catRestRot['Knee_BR'].x + rearKneeBend;
    }
    if (this.catBones['Foot_BR']) {
      this.catBones['Foot_BR'].rotation.x = this.catRestRot['Foot_BR'].x - Math.sin(phaseB - 0.3) * 0.28;
    }

    // --- ARKA SOL BACAK (BL) ---
    if (this.catBones['Thigh_BL']) {
      this.catBones['Thigh_BL'].rotation.x = this.catRestRot['Thigh_BL'].x + swingBL * legAmp;
    }
    if (this.catBones['Knee_BL']) {
      const rearKneeBendL = swingBL > 0 ? swingBL * 0.65 : -swingBL * 0.15;
      this.catBones['Knee_BL'].rotation.x = this.catRestRot['Knee_BL'].x + rearKneeBendL;
    }
    if (this.catBones['Foot_BL']) {
      this.catBones['Foot_BL'].rotation.x = this.catRestRot['Foot_BL'].x - Math.sin(phaseA - 0.3) * 0.28;
    }

    // --- OMURGA, KALÇA VE GÖĞÜS DİNAMİĞİ ---
    if (this.catBones['Pelvis']) {
      this.catBones['Pelvis'].rotation.y = this.catRestRot['Pelvis'].y + Math.sin(step) * 0.08;
      this.catBones['Pelvis'].rotation.x = this.catRestRot['Pelvis'].x + Math.cos(step * 2) * 0.04;
    }
    if (this.catBones['Torso']) {
      this.catBones['Torso'].rotation.y = this.catRestRot['Torso'].y - Math.sin(step) * 0.06;
      this.catBones['Torso'].rotation.z = this.catRestRot['Torso'].z + Math.cos(step * 2) * 0.038;
    }

    // --- BAŞ VE BOYUN DENGELEMESİ (HEAD BOBBING) ---
    if (this.catBones['Neck']) {
      this.catBones['Neck'].rotation.x = this.catRestRot['Neck'].x + Math.sin(step * 2 - 0.2) * 0.05;
      this.catBones['Neck'].rotation.y = this.catRestRot['Neck'].y + Math.sin(step) * 0.04;
    }
    if (this.catBones['Head']) {
      this.catBones['Head'].rotation.x = this.catRestRot['Head'].x - Math.sin(step * 2 - 0.2) * 0.035;
      this.catBones['Head'].rotation.y = this.catRestRot['Head'].y + Math.max(-0.4, Math.min(0.4, this.catRotYVel * 3.2));
    }

    // --- AKICI S-DALGASI KUYRUK ---
    if (this.catBones['Tail_1']) {
      this.catBones['Tail_1'].rotation.y = this.catRestRot['Tail_1'].y + Math.sin(step * 1.4) * 0.26;
      this.catBones['Tail_1'].rotation.x = this.catRestRot['Tail_1'].x + Math.cos(step * 1.4) * 0.12;
    }
    if (this.catBones['Tail_2']) {
      this.catBones['Tail_2'].rotation.y = this.catRestRot['Tail_2'].y + Math.sin(step * 1.4 - 0.6) * 0.44;
    }
    if (this.catBones['Tail_3']) {
      this.catBones['Tail_3'].rotation.y = this.catRestRot['Tail_3'].y + Math.sin(step * 1.4 - 1.2) * 0.62;
    }

    // Taç süzülmesi
    if (this.haloMesh && this.haloMesh.visible) {
      this.haloMesh.rotation.z += 0.035;
      this.haloMesh.position.y = 19.5 + Math.sin(time * 2.5) * 0.7;
    }
  }

  // Geriye dönük uyumluluk aliası
  private updateProceduralWalk(time: number) {
    this.updateCatBiomechanics(time, 0.016);
  }

  private initListeners() {
    window.addEventListener('resize', () => {
      const w = this.canvas.clientWidth || window.innerWidth;
      const h = this.canvas.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => {
        if (e.alpha !== null && e.beta !== null) {
          if (this.baseAlpha === null) {
            this.baseAlpha = e.alpha;
            this.baseBeta = e.beta;
          }
          let dAlpha = e.alpha - this.baseAlpha;
          while (dAlpha > 180) dAlpha -= 360;
          while (dAlpha < -180) dAlpha += 360;
          this.gyroYaw = (dAlpha * Math.PI) / 180 * 0.7;
          const dBeta = e.beta - (this.baseBeta || 0);
          this.gyroPitch = Math.max(-0.45, Math.min(0.45, (dBeta * Math.PI) / 180 * 0.45));
        }
      });
    }

    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.dragYaw -= dx * 0.0035;
      this.dragPitch = Math.max(-0.45, Math.min(0.45, this.dragPitch - dy * 0.0035));
    });

    this.canvas.addEventListener('pointerup', () => { this.isDragging = false; });

    // Çift Parmakla Büyütüp Küçültme (Pinch-to-zoom on Mobile)
    let initialPinchDist: number | null = null;
    let initialScale = 1.0;

    this.canvas.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDist = Math.hypot(dx, dy);
        initialScale = this.currentScaleFactor;
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDist !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDist = Math.hypot(dx, dy);
        const ratio = currentDist / initialPinchDist;
        this.setScaleFactor(initialScale * ratio);
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialPinchDist = null;
      }
    }, { passive: true });

    // Masaüstü Fare Tekerleği ile Boyut Ayarı
    this.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0012;
      this.setScaleFactor(this.currentScaleFactor + delta);
    }, { passive: false });
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

  private loop = () => {
    if (!this.isRunning) return;
    this.animFrameId = requestAnimationFrame(this.loop);

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.getElapsedTime();

    // Kamera Yönelimi
    const targetCamYaw = this.gyroYaw + this.dragYaw;
    const targetCamPitch = this.gyroPitch + this.dragPitch;
    this.camYaw += (targetCamYaw - this.camYaw) * 0.1;
    this.camPitch += (targetCamPitch - this.camPitch) * 0.1;
    this.camera.rotation.set(this.camPitch, this.camYaw, 0, 'YXZ');

    // State Machine
    if (this.patronusState !== 'IDLE') {
      const elapsed = Date.now() - this.stateStartTime;

      if (elapsed < 800) {
        // Girdap
        const t = elapsed / 800;
        for (let i = 0; i < this.SWARM_COUNT; i++) {
          const vp = this.swarmVortex[i];
          vp.angle += vp.speed;
          const curR = vp.r * (0.3 + 0.7 * t);
          this.swarmPos[i * 3] = Math.cos(vp.angle) * curR;
          this.swarmPos[i * 3 + 1] = -5 + vp.y * (1 - t * 0.3) + Math.sin(time * 4 + i) * 2;
          this.swarmPos[i * 3 + 2] = Math.sin(vp.angle) * curR;
        }
        this.swarmPoints.geometry.attributes.position.needsUpdate = true;
      } else if (elapsed < 2200) {
        // Mıknatıs Birleşme
        this.patronusState = 'CONVERGE';
        const progress = Math.min(1.0, (elapsed - 800) / 1400);
        const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const numTargets = this.catTargetVertices.length;
        for (let i = 0; i < this.SWARM_COUNT; i++) {
          const vp = this.swarmVortex[i];
          vp.angle += vp.speed * (1 - ease * 0.7);
          const vx = Math.cos(vp.angle) * vp.r * (1 - ease * 0.8);
          const vy = -5 + vp.y * (1 - ease * 0.7);
          const vz = Math.sin(vp.angle) * vp.r * (1 - ease * 0.8);

          if (numTargets > 0) {
            const target = this.catTargetVertices[i % numTargets];
            const tx = target.x + this.catPos.x;
            const ty = target.y + this.catPos.y;
            const tz = target.z + this.catPos.z;

            this.swarmPos[i * 3] = vx * (1 - ease) + tx * ease;
            this.swarmPos[i * 3 + 1] = vy * (1 - ease) + ty * ease;
            this.swarmPos[i * 3 + 2] = vz * (1 - ease) + tz * ease;
          }
        }
        this.swarmPoints.geometry.attributes.position.needsUpdate = true;
      } else {
        // Canlanma & Biyomekanik Yaşam
        if (this.patronusState !== 'ACTIVE') {
          this.patronusState = 'ACTIVE';
          if (this.catScene) this.catScene.visible = true;
          this.groundGroup.visible = true;
          this.surfacePoints.visible = this.profile.mode === 'patronus';
          this.swarmPoints.visible = false;
        }

        // Biyomekanik Yönelme ve Yürüyüş
        if (this.catBehavior === 'WALK') {
          const dx = this.catTargetPos.x - this.catPos.x;
          const dz = this.catTargetPos.z - this.catPos.z;
          const dist = Math.hypot(dx, dz);

          if (dist < 4.5) {
            // Hedefe ulaşıldı, meraklı duruş (IDLE) moduna geç
            this.catBehavior = 'IDLE';
            this.behaviorTimer = 2.5 + Math.random() * 3.0; // 2.5 - 5.5 sn mola
            this.catRotYVel = 0;
          } else {
            this.catPos.x += (dx / dist) * this.catSpeed;
            this.catPos.z += (dz / dist) * this.catSpeed;
            const targetAngle = Math.atan2(dx, dz);
            let diff = targetAngle - this.catRotY;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            const turnStep = diff * 0.08;
            this.catRotY += turnStep;
            this.catRotYVel = turnStep;
          }
        } else {
          this.catRotYVel = 0;
        }

        if (this.catScene) {
          this.catScene.position.set(this.catPos.x, this.catPos.y, this.catPos.z);
          this.catScene.rotation.y = this.catRotY;
          this.updateCatBiomechanics(time, dt);
        }

        this.groundGroup.position.set(this.catPos.x, -16.0, this.catPos.z);

        // Gövdeden Çıkan Hafif & Asil Patronus Parçacıkları (Patronus Modu)
        if (this.profile.mode === 'patronus') {
          this.surfacePoints.visible = true;
          if (this.puddleMesh) this.puddleMesh.visible = true;
          const isPetting = this.petReactTimer > 0;
          const spawnProb = isPetting ? 0.25 : 0.12;

          for (let i = 0; i < this.SURFACE_COUNT; i++) {
            const p = this.surfaceList[i];
            if (!p.active || p.age >= p.life) {
              if (Math.random() < spawnProb) this.spawnSurfaceParticle(i);
            }
            if (p.active) {
              p.age += dt;
              const progress = p.age / p.life;
              if (progress >= 1.0) {
                p.active = false;
                this.surfacePos[i * 3 + 1] = -9999;
              } else {
                p.x += p.vx + Math.sin(time * 2.0 + p.phase) * 0.012;
                p.y += p.vy;
                p.z += p.vz + Math.cos(time * 2.0 + p.phase) * 0.012;

                this.surfacePos[i * 3] = p.x;
                this.surfacePos[i * 3 + 1] = p.y;
                this.surfacePos[i * 3 + 2] = p.z;

                const alpha = Math.sin(progress * Math.PI) * (isPetting ? 0.88 : 0.68);
                this.surfaceColors[i * 3] = alpha * 0.88;
                this.surfaceColors[i * 3 + 1] = alpha * 0.94;
                this.surfaceColors[i * 3 + 2] = alpha * 1.0;
              }
            }
          }
          this.surfacePoints.geometry.attributes.position.needsUpdate = true;
          this.surfacePoints.geometry.attributes.color.needsUpdate = true;
        } else {
          // Canlı Mod: Aura ve gümüş havuz tamamen kapalı, sadece gerçekçi gölge kalır!
          this.surfacePoints.visible = false;
          if (this.puddleMesh) this.puddleMesh.visible = false;
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  };
}
