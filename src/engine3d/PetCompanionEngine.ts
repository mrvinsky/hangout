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

  // Zemin & Gölge
  private groundGroup!: THREE.Group;

  // Parçacık Sistemleri
  private readonly SWARM_COUNT = 24000;
  private swarmPoints!: THREE.Points;
  private swarmPos!: Float32Array;
  private swarmVortex: { angle: number; r: number; y: number; speed: number }[] = [];

  // Gövdeden Süzülen Yüzey Buharı
  private readonly SURFACE_COUNT = 200;
  private surfacePoints!: THREE.Points;
  private surfacePos!: Float32Array;
  private surfaceColors!: Float32Array;
  private surfaceList: {
    active: boolean;
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    age: number; life: number; phase: number;
  }[] = [];

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

    const puddleMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 54),
      new THREE.MeshBasicMaterial({ map: puddleTex, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    puddleMesh.rotation.x = -Math.PI * 0.5;
    this.groundGroup.add(puddleMesh);

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
      size: 3.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
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
    const modelPath = 'assets/models/cat/source/Cat.glb';

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

  public petPet() {
    // Okşama tepkisi: Kafa hafifçe kalkar, gözler kısılır, kutsal ışık parlar
    if (this.catBones['Head']) {
      this.catBones['Head'].rotation.x += 0.25;
      setTimeout(() => {
        if (this.catBones['Head']) this.catBones['Head'].rotation.x -= 0.25;
      }, 400);
    }
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
    const wx = this.catPos.x + v.x * cosR + v.z * sinR;
    const wy = this.catPos.y + v.y;
    const wz = this.catPos.z - v.x * sinR + v.z * cosR;

    p.active = true;
    p.x = wx; p.y = wy; p.z = wz;
    p.vx = (Math.random() - 0.5) * 0.016;
    p.vy = 0.042 + Math.random() * 0.032;
    p.vz = (Math.random() - 0.5) * 0.016;
    p.age = 0;
    p.life = 2.4 + Math.random() * 1.4;
  }

  private updateProceduralWalk(time: number) {
    if (!this.catBones['Thigh_FR']) return;
    const walkSpeed = 4.8;
    const legAmp = 0.34;
    const step = time * walkSpeed;

    const swingR = Math.sin(step);
    const swingL = Math.sin(step + Math.PI);

    // Bacaklar
    if (this.catBones['Thigh_FR']) {
      this.catBones['Thigh_FR'].rotation.z = this.catRestRot['Thigh_FR'].z + swingR * legAmp;
    }
    if (this.catBones['Thigh_FL']) {
      this.catBones['Thigh_FL'].rotation.z = this.catRestRot['Thigh_FL'].z + swingL * legAmp;
    }
    if (this.catBones['Thigh_BR']) {
      this.catBones['Thigh_BR'].rotation.x = this.catRestRot['Thigh_BR'].x + swingL * legAmp;
    }
    if (this.catBones['Thigh_BL']) {
      this.catBones['Thigh_BL'].rotation.x = this.catRestRot['Thigh_BL'].x + swingR * legAmp;
    }

    // Kuyruk S-dalgası
    if (this.catBones['Tail_1']) this.catBones['Tail_1'].rotation.y = this.catRestRot['Tail_1'].y + Math.sin(time * 2.2) * 0.22;
    if (this.catBones['Tail_2']) this.catBones['Tail_2'].rotation.y = this.catRestRot['Tail_2'].y + Math.sin(time * 2.2 - 0.6) * 0.32;
    if (this.catBones['Tail_3']) this.catBones['Tail_3'].rotation.y = this.catRestRot['Tail_3'].y + Math.sin(time * 2.2 - 1.2) * 0.42;

    // Torso & Taç
    if (this.catBones['Torso']) {
      this.catBones['Torso'].rotation.z = this.catRestRot['Torso'].z + Math.cos(time * 1.8) * 0.035;
    }
    if (this.haloMesh && this.haloMesh.visible) {
      this.haloMesh.rotation.z += 0.035;
      this.haloMesh.position.y = 19.5 + Math.sin(time * 2.5) * 0.7;
    }
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

    window.addEventListener('pointerup', () => { this.isDragging = false; });
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
        // Canlanma & Yürüyüş
        if (this.patronusState !== 'ACTIVE') {
          this.patronusState = 'ACTIVE';
          if (this.catScene) this.catScene.visible = true;
          this.groundGroup.visible = true;
          this.surfacePoints.visible = this.profile.mode === 'patronus';
          this.swarmPoints.visible = false;
        }

        // Yürüyüş
        const dx = this.catTargetPos.x - this.catPos.x;
        const dz = this.catTargetPos.z - this.catPos.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 3) {
          this.pickNewDestination();
        } else {
          this.catPos.x += (dx / dist) * this.catSpeed;
          this.catPos.z += (dz / dist) * this.catSpeed;
          const targetAngle = Math.atan2(dx, dz);
          let diff = targetAngle - this.catRotY;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          this.catRotY += diff * 0.08;
        }

        if (this.catScene) {
          this.catScene.position.set(this.catPos.x, this.catPos.y, this.catPos.z);
          this.catScene.rotation.y = this.catRotY;
          this.updateProceduralWalk(time);
        }

        this.groundGroup.position.set(this.catPos.x, -16.0, this.catPos.z);

        // Gövdeden Çıkan Parçacıklar (Patronus Modu)
        if (this.profile.mode === 'patronus') {
          for (let i = 0; i < this.SURFACE_COUNT; i++) {
            const p = this.surfaceList[i];
            if (!p.active || p.age >= p.life) {
              if (Math.random() < 0.1) this.spawnSurfaceParticle(i);
            }
            if (p.active) {
              p.age += 0.016;
              const progress = p.age / p.life;
              if (progress >= 1.0) {
                p.active = false;
                this.surfacePos[i * 3 + 1] = -9999;
              } else {
                p.x += p.vx + Math.sin(time * 1.8 + p.phase) * 0.015;
                p.y += p.vy;
                p.z += p.vz + Math.cos(time * 1.8 + p.phase) * 0.015;

                this.surfacePos[i * 3] = p.x;
                this.surfacePos[i * 3 + 1] = p.y;
                this.surfacePos[i * 3 + 2] = p.z;

                const alpha = Math.sin(progress * Math.PI) * 0.9;
                this.surfaceColors[i * 3] = alpha * 0.95;
                this.surfaceColors[i * 3 + 1] = alpha * 0.98;
                this.surfaceColors[i * 3 + 2] = alpha * 1.0;
              }
            }
          }
          this.surfacePoints.geometry.attributes.position.needsUpdate = true;
          this.surfacePoints.geometry.attributes.color.needsUpdate = true;
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  };
}
