import * as THREE from 'three';
import { CoatPattern } from '../types/pet';

/**
 * Şablon kedi modelinin dokularını profile göre yeniden boyar.
 * Orijinal dokunun parlaklık detayı (tüy, gölge) korunur; renk ve desen
 * (düz / tekir / iki renk / calico / siyam) UV uzayında prosedürel üretilir.
 *
 * Cat.glb materyalleri: 'Body_Eye' (gövde, 512²), 'Head' (256²), 'Tail' (256²).
 */

export interface FurOptions {
  furHex: string;
  secondaryHex: string;
  pattern: CoatPattern;
  seed: number;
}

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Tohumlu, döşenebilir değer gürültüsü (2 oktav) */
function makeNoise(seed: number) {
  const N = 16;
  const grid = new Float32Array(N * N);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < grid.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    grid[i] = s / 0xffffffff;
  }
  const lattice = (u: number, v: number, f: number) => {
    const x = u * f, y = v * f;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const g = (i: number, j: number) => grid[(((j % N) + N) % N) * N + (((i % N) + N) % N)];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * sx;
    const b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
  return (u: number, v: number, f: number) => lattice(u, v, f) * 0.7 + lattice(u, v, f * 2) * 0.3;
}

const CALICO_ORANGE: RGB = [214, 120, 52];
const CALICO_BLACK: RGB = [38, 34, 32];

function patternColor(
  part: 'body' | 'head' | 'tail',
  u: number,
  v: number,
  fur: RGB,
  secondary: RGB,
  pattern: CoatPattern,
  noise: (u: number, v: number, f: number) => number
): RGB {
  switch (pattern) {
    case 'tabby': {
      // Dalgalı çizgiler; kuyrukta halka
      const warp = noise(u, v, 4) * 2.4;
      const coord = part === 'tail' ? u * 10 : v * 13 + warp;
      const stripe = smoothstep(0.35, 0.75, Math.sin(coord * Math.PI) * 0.5 + 0.5);
      return mix(fur, mix(fur, [20, 16, 14], 0.55), stripe);
    }
    case 'bicolor': {
      // Gövdenin göğüs/karın bölgesi (dokunun orta-alt kısmı) ikincil renk
      if (part !== 'body') return fur;
      const dx = (u - 0.5) / 0.24, dy = (v - 0.6) / 0.34;
      const d = Math.sqrt(dx * dx + dy * dy) + (noise(u, v, 5) - 0.5) * 0.5;
      return mix(secondary, fur, smoothstep(0.75, 1.05, d));
    }
    case 'calico': {
      // Beyaz zemin üzerinde turuncu ve koyu yamalar
      const base = mix(secondary, [245, 240, 230], 0.6);
      const a = smoothstep(0.55, 0.62, noise(u, v, 3));
      const b = smoothstep(0.58, 0.65, noise(u + 0.37, v + 0.71, 3));
      return mix(mix(base, CALICO_ORANGE, a), CALICO_BLACK, b * (1 - a));
    }
    case 'points': {
      // Siyam: açık gövde, koyu yüz ve kuyruk
      if (part === 'body') return secondary;
      if (part === 'tail') return mix(secondary, fur, smoothstep(0.1, 0.6, u));
      return fur;
    }
    default:
      return fur;
  }
}

function partOf(materialName: string): 'body' | 'head' | 'tail' {
  const n = materialName.toLowerCase();
  if (n.includes('head')) return 'head';
  if (n.includes('tail')) return 'tail';
  return 'body';
}

/** Kaynak dokudan yeni bir CanvasTexture üretir; kaynak görüntü değişmez. */
export function recolorFurTexture(source: THREE.Texture, materialName: string, opts: FurOptions): THREE.Texture | null {
  const image = source.image as CanvasImageSource & { width: number; height: number };
  if (!image || !image.width) return null;

  const w = image.width, h = image.height;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;

  // Ortalama parlaklık: detay oranı bunun etrafında ölçülür
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  const mean = Math.max(sum / (px.length / 4), 1);

  const fur = hexToRgb(opts.furHex);
  const secondary = hexToRgb(opts.secondaryHex);
  const noise = makeNoise(opts.seed);
  const part = partOf(materialName);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      // Tüy detayını koru ama aşırı kontrastı yumuşat
      const detail = Math.max(0.55, Math.min(1.45, 1 + (lum / mean - 1) * 0.9));
      const c = patternColor(part, x / w, y / h, fur, secondary, opts.pattern, noise);
      px[i] = Math.min(255, c[0] * detail);
      px[i + 1] = Math.min(255, c[1] * detail);
      px[i + 2] = Math.min(255, c[2] * detail);
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = source.flipY;
  tex.colorSpace = source.colorSpace;
  tex.wrapS = source.wrapS;
  tex.wrapT = source.wrapT;
  tex.magFilter = source.magFilter;
  tex.minFilter = source.minFilter;
  tex.anisotropy = source.anisotropy;
  return tex;
}

/** Profil id'sinden kararlı bir tohum (aynı pet her açılışta aynı deseni alır) */
export function seedFromId(id: string): number {
  let hsh = 2166136261;
  for (let i = 0; i < id.length; i++) hsh = Math.imul(hsh ^ id.charCodeAt(i), 16777619);
  return hsh >>> 0;
}
