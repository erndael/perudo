import type { Face } from "@perudo/engine";
import { CanvasTexture, SRGBColorSpace } from "three";

/** Pip positions on a unit square, per Face. */
const PIPS: Record<Face, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]],
};

let textures: Record<Face, CanvasTexture> | null = null;

/**
 * One texture per Face, drawn on a 2D canvas (no image assets), shared by every die.
 * Browser-only: needs `document`.
 */
export function faceTextures(): Record<Face, CanvasTexture> {
  textures ??= {
    1: drawFace(1),
    2: drawFace(2),
    3: drawFace(3),
    4: drawFace(4),
    5: drawFace(5),
    6: drawFace(6),
  };
  return textures;
}

function drawFace(face: Face, size = 128): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f5f0e6";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#d8cfbd";
  ctx.lineWidth = size * 0.04;
  ctx.strokeRect(0, 0, size, size);
  // A Paco's single pip is red and larger, as on traditional dice.
  ctx.fillStyle = face === 1 ? "#b8322a" : "#1b1b1b";
  const radius = size * (face === 1 ? 0.13 : 0.085);
  for (const [x, y] of PIPS[face]) {
    ctx.beginPath();
    ctx.arc(x * size, y * size, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
