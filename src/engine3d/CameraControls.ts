import * as THREE from 'three';

/**
 * Jiroskop + sürükleme ile bakış yönü, pinch / tekerlek ile ölçek.
 * Tüm dinleyiciler dispose() ile kaldırılır (ekran değişince sızıntı olmasın).
 */
export class CameraControls {
  private camYaw = 0;
  private camPitch = 0;
  private gyroYaw = 0;
  private gyroPitch = 0;
  private dragYaw = 0;
  private dragPitch = 0;
  private baseAlpha: number | null = null;
  private baseBeta: number | null = null;
  private isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private pinchStartDist: number | null = null;
  private pinchStartScale = 1;
  private cleanups: (() => void)[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: THREE.PerspectiveCamera,
    private renderer: THREE.WebGLRenderer,
    private getScale: () => number,
    private setScale: (s: number) => void
  ) {
    this.on(window, 'resize', this.onResize);
    if (window.DeviceOrientationEvent) this.on(window, 'deviceorientation', this.onOrientation);
    this.on(canvas, 'pointerdown', this.onPointerDown);
    this.on(window, 'pointermove', this.onPointerMove);
    this.on(window, 'pointerup', this.onPointerUp);
    this.on(canvas, 'touchstart', this.onTouchStart, { passive: true });
    this.on(canvas, 'touchmove', this.onTouchMove, { passive: true });
    this.on(canvas, 'touchend', this.onTouchEnd, { passive: true });
    this.on(canvas, 'wheel', this.onWheel, { passive: false });
  }

  private on(target: EventTarget, type: string, fn: (e: any) => void, opts?: AddEventListenerOptions) {
    target.addEventListener(type, fn, opts);
    this.cleanups.push(() => target.removeEventListener(type, fn, opts));
  }

  dispose() {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
  }

  /** Her karede çağrılır: hedef yönelime yumuşak geçiş */
  update() {
    this.camYaw += (this.gyroYaw + this.dragYaw - this.camYaw) * 0.1;
    this.camPitch += (this.gyroPitch + this.dragPitch - this.camPitch) * 0.1;
    this.camera.rotation.set(this.camPitch, this.camYaw, 0, 'YXZ');
  }

  private onResize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onOrientation = (e: DeviceOrientationEvent) => {
    if (e.alpha === null || e.beta === null) return;
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
  };

  private onPointerDown = (e: PointerEvent) => {
    this.isDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.dragYaw -= dx * 0.0035;
    this.dragPitch = Math.max(-0.45, Math.min(0.45, this.dragPitch - dy * 0.0035));
  };

  private onPointerUp = () => {
    this.isDragging = false;
  };

  private touchDist(e: TouchEvent) {
    return Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }

  private onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      this.pinchStartDist = this.touchDist(e);
      this.pinchStartScale = this.getScale();
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && this.pinchStartDist !== null) {
      this.setScale(this.pinchStartScale * (this.touchDist(e) / this.pinchStartDist));
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) this.pinchStartDist = null;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.setScale(this.getScale() - e.deltaY * 0.0012);
  };
}
