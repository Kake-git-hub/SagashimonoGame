/**
 * ためす（バーチャルメイク）の描画
 * - 顔の点が来るたびに、レイヤーごとの「ぼかした色のマスク」を作り直す（映像の半分の解像度）
 * - 毎フレーム、映像を canvas に描いてから、マスクを合成モード（multiply / screen / 普通）で重ねる
 *   映像そのものを canvas に描くのは、<video> の上に乗せた要素の mix-blend-mode が iOS で効かないことがあるため
 */
import { FaceFrame } from '../types';
import { faceRegions, Pt, Shape } from '../logic/regions';
import { activeLayers, LAYER_SPEC, LayerId, LookState, shapesForLayer } from '../logic/layers';
import { FrameSource } from '../services/faceTracker';

const MASK_SCALE = 0.5;

interface Layer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

function makeLayer(w: number, h: number): Layer {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  return { canvas, ctx };
}

// 太さが変わる線を、両側に広げた多角形にして塗る
function strokePolygon(points: Pt[], widths: number[]): Pt[] {
  const left: Pt[] = [], right: Pt[] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
    let tx = next.x - prev.x, ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len; ty /= len;
    const hw = widths[i] / 2;
    left.push({ x: points[i].x - ty * hw, y: points[i].y + tx * hw });
    right.push({ x: points[i].x + ty * hw, y: points[i].y - tx * hw });
  }
  return [...left, ...right.reverse()];
}

function pathPolygon(ctx: CanvasRenderingContext2D, points: Pt[]) {
  if (points.length === 0) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.beginPath();
  switch (shape.kind) {
    case 'polygon':
      pathPolygon(ctx, shape.points);
      shape.holes?.forEach(h => pathPolygon(ctx, h));
      ctx.fill('evenodd');
      break;
    case 'ellipse':
      ctx.ellipse(shape.cx, shape.cy, Math.max(0.5, shape.rx), Math.max(0.5, shape.ry), shape.rotation, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'stroke':
      pathPolygon(ctx, strokePolygon(shape.points, shape.widths));
      ctx.fill();
      break;
  }
}

export class MakeupPainter {
  readonly output: HTMLCanvasElement;
  private readonly outCtx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private masks = new Map<LayerId, Layer>();
  private scratch: Layer | null = null;
  private small: Layer | null = null;
  private hasFace = false;
  private readonly supportsFilter: boolean;
  // 直前の render で映像とメイクを描いたか（保存のとき、この canvas を使えるか）
  lastDrew = false;

  constructor(output: HTMLCanvasElement) {
    this.output = output;
    const ctx = output.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.outCtx = ctx;
    this.supportsFilter = typeof (ctx as CanvasRenderingContext2D & { filter?: unknown }).filter === 'string';
  }

  resize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.output.width = w;
    this.output.height = h;
    this.scratch = makeLayer(w * MASK_SCALE, h * MASK_SCALE);
    this.small = makeLayer(1, 1);
    this.masks.clear();
  }

  private maskFor(id: LayerId): Layer {
    let m = this.masks.get(id);
    if (!m) {
      m = makeLayer(this.w * MASK_SCALE, this.h * MASK_SCALE);
      this.masks.set(id, m);
    }
    return m;
  }

  // ぼかし: ctx.filter があればそれを使い、無ければ縮小→拡大で近似する
  private blurInto(src: HTMLCanvasElement, dst: Layer, radius: number) {
    const dctx = dst.ctx;
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.clearRect(0, 0, dst.canvas.width, dst.canvas.height);
    dctx.imageSmoothingEnabled = true;
    if (radius < 0.75) {
      dctx.drawImage(src, 0, 0);
      return;
    }
    if (this.supportsFilter) {
      dctx.filter = `blur(${radius.toFixed(2)}px)`;
      dctx.drawImage(src, 0, 0);
      dctx.filter = 'none';
      return;
    }
    const small = this.small!;
    let cur: HTMLCanvasElement = src;
    let cw = src.width, ch = src.height;
    // 半分ずつ縮めていく（それぞれが箱型フィルタになる）
    let steps = Math.max(1, Math.round(Math.log2(Math.max(2, radius))));
    const tmpA = makeLayer(cw, ch), tmpB = makeLayer(cw, ch);
    let target = tmpA;
    while (steps-- > 0 && cw > 2 && ch > 2) {
      const nw = Math.max(1, Math.round(cw / 2)), nh = Math.max(1, Math.round(ch / 2));
      target.ctx.setTransform(1, 0, 0, 1, 0, 0);
      target.ctx.clearRect(0, 0, target.canvas.width, target.canvas.height);
      target.ctx.imageSmoothingEnabled = true;
      target.ctx.drawImage(cur, 0, 0, cw, ch, 0, 0, nw, nh);
      cur = target.canvas;
      cw = nw; ch = nh;
      target = target === tmpA ? tmpB : tmpA;
    }
    small.canvas.width = cw;
    small.canvas.height = ch;
    small.ctx.imageSmoothingEnabled = true;
    small.ctx.drawImage(cur, 0, 0, cw, ch, 0, 0, cw, ch);
    dctx.imageSmoothingQuality = 'high';
    dctx.drawImage(small.canvas, 0, 0, cw, ch, 0, 0, dst.canvas.width, dst.canvas.height);
  }

  // 顔の点が来たら、使っているレイヤーのマスクを作り直す
  updateMasks(frame: FaceFrame | null, look: LookState) {
    if (!frame || !this.scratch) {
      this.hasFace = false;
      return;
    }
    this.hasFace = true;
    const regions = faceRegions(frame.landmarks, this.w, this.h);
    const active = activeLayers(look);
    for (const id of Array.from(this.masks.keys())) {
      if (!active.includes(id)) this.masks.delete(id);
    }
    const sctx = this.scratch.ctx;
    for (const id of active) {
      const style = look[id]!;
      const spec = LAYER_SPEC[id];
      sctx.setTransform(MASK_SCALE, 0, 0, MASK_SCALE, 0, 0);
      sctx.clearRect(0, 0, this.w, this.h);
      sctx.fillStyle = style.color;
      for (const shape of shapesForLayer(id, regions)) drawShape(sctx, shape);
      this.blurInto(this.scratch.canvas, this.maskFor(id), spec.blur * regions.faceWidth * MASK_SCALE);
    }
  }

  // 毎フレーム: 映像を描き、マスクを重ねる。描くものが無ければ透明にする（下の <video> が見える）
  render(source: FrameSource | null, look: LookState, hidden: boolean): boolean {
    const ctx = this.outCtx;
    const layers = activeLayers(look);
    if (!source || hidden || layers.length === 0 || !this.hasFace || this.w === 0) {
      if (this.lastDrew || hidden) ctx.clearRect(0, 0, this.w, this.h);
      this.lastDrew = false;
      return false;
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    try {
      ctx.drawImage(source, 0, 0, this.w, this.h);
    } catch {
      this.lastDrew = false;
      return false;
    }
    for (const id of layers) {
      const mask = this.masks.get(id);
      if (!mask) continue;
      const style = look[id]!;
      const spec = LAYER_SPEC[id];
      const alpha = Math.max(0, Math.min(1, style.opacity)) * spec.maxAlpha;
      if (alpha <= 0) continue;
      ctx.globalCompositeOperation = spec.blend === 'normal' ? 'source-over' : spec.blend;
      ctx.globalAlpha = alpha;
      ctx.drawImage(mask.canvas, 0, 0, this.w, this.h);
      if (spec.tint > 0) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = alpha * spec.tint;
        ctx.drawImage(mask.canvas, 0, 0, this.w, this.h);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    this.lastDrew = true;
    return true;
  }

  // 保存用: いま見えている絵（鏡像なら左右反転）を新しい canvas に描く
  capture(source: FrameSource | null, mirrored: boolean): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext('2d')!;
    if (mirrored) {
      ctx.translate(this.w, 0);
      ctx.scale(-1, 1);
    }
    if (this.lastDrew) ctx.drawImage(this.output, 0, 0);
    else if (source) ctx.drawImage(source, 0, 0, this.w, this.h);
    return canvas;
  }
}
