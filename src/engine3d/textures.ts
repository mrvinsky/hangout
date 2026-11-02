import * as THREE from 'three';

/** Kenarları yumuşak dairesel gradyan doku (parçacıklar ve zemin efektleri için). */
export function createRadialTexture(size: number, stops: [number, string][], radius = size / 2): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, radius);
  for (const [offset, color] of stops) grad.addColorStop(offset, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

export function createSoftTexture(): THREE.CanvasTexture {
  return createRadialTexture(64, [
    [0, 'rgba(255, 255, 255, 1.0)'],
    [0.4, 'rgba(235, 245, 255, 0.88)'],
    [0.75, 'rgba(180, 210, 245, 0.35)'],
    [1.0, 'rgba(140, 180, 240, 0.0)'],
  ]);
}
