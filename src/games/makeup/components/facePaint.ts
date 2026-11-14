/**
 * 塗ったメイクの絵（レイヤーごとに 1 枚、顔を平らに開いた UV 空間の canvas）
 * - なぞる: 筆のスタンプを UV の位置に押す（「はみださない」のときはパーツの型で切り抜く）
 * - 自動で塗る: パーツの型どおりに色を入れる（できあがりを みる / ていあん の色で ためす）
 * - けしゴム: すべてのレイヤーから消す
 * 描画（makeupRenderer）は、この canvas をテクスチャにして今の顔のメッシュへ貼る。
 * canvas はレイヤーごとに 1 回だけ作って使い回す（毎フレーム作ると iOS でメモリが尽きる）
 */
import { BrushSpec } from '../logic/brush';
import { FaceUV } from '../logic/faceMesh';
import { LAYER_ORDER, LAYER_SPEC, LayerId, LookState, shapesForLayer } from '../logic/layers';
import { blurAlpha, edgeFeatherUV, warpAlphaToUV } from '../logic/maskWarp';
import { referenceFace } from '../logic/referenceFace';
import { faceRegions, Pt, Shape } from '../logic/regions';

// 塗る絵の一辺（px）。顔ぜんたいで 512 なので、唇でおよそ 120px
export const PAINT_SIZE = 512;
// 型を作るときの「お手本の顔」の絵の幅（px）
const REFERENCE_WIDTH = 512;
// 顔の輪郭でなじませる幅（UV の割合）と、その絵の一辺
const EDGE_FEATHER_WIDTH = 0.035;
const EDGE_FEATHER_SIZE = 256;

interface Surface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

function makeSurface(w: number, h: number): Surface {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  return { canvas, ctx };
}

// 使い終わった canvas のメモリをすぐ返す（iOS は canvas の合計メモリに上限がある）
function releaseSurface(s: Surface | null) {
  if (!s) return;
  s.canvas.width = 0;
  s.canvas.height = 0;
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

// アルファの配列を、白 + アルファの canvas にする
function alphaToSurface(alpha: Uint8ClampedArray, size: number): Surface {
  const surface = makeSurface(size, size);
  const image = surface.ctx.createImageData(size, size);
  for (let i = 0; i < alpha.length; i++) {
    image.data[i * 4] = 255;
    image.data[i * 4 + 1] = 255;
    image.data[i * 4 + 2] = 255;
    image.data[i * 4 + 3] = alpha[i];
  }
  surface.ctx.putImageData(image, 0, 0);
  return surface;
}

// 筆先（白い円。中心から hardness までは濃く、外へ向かってぼける）
const TIP_SIZE = 64;
function makeTip(hardness: number): Surface {
  const tip = makeSurface(TIP_SIZE, TIP_SIZE);
  const r = TIP_SIZE / 2;
  const g = tip.ctx.createRadialGradient(r, r, 0, r, r, r);
  const h = Math.max(0, Math.min(0.95, hardness));
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(h, 'rgba(255,255,255,1)');
  g.addColorStop(h + (1 - h) * 0.5, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  tip.ctx.fillStyle = g;
  tip.ctx.fillRect(0, 0, TIP_SIZE, TIP_SIZE);
  return tip;
}

interface PaintLayer extends Surface {
  version: number;   // 描き変わるたびに増える（テクスチャの送り直しの判定）
  painted: boolean;  // 何か塗ってあるか（けしゴムで全部消しても true のまま。けす で false）
  // 塗ってある範囲（px）。けしゴムが、関係ないレイヤーを GPU へ送り直さないために持つ
  box: { x0: number; y0: number; x1: number; y1: number } | null;
}

function growBox(layer: PaintLayer, x: number, y: number, w: number, h: number) {
  const b = layer.box;
  layer.box = b
    ? { x0: Math.min(b.x0, x), y0: Math.min(b.y0, y), x1: Math.max(b.x1, x + w), y1: Math.max(b.y1, y + h) }
    : { x0: x, y0: y, x1: x + w, y1: y + h };
}

export type PaintSnapshot = Map<LayerId, HTMLCanvasElement>;

export class FacePaint {
  private layers = new Map<LayerId, PaintLayer>();
  private masks = new Map<LayerId, Surface>();
  private tips = new Map<number, Surface>();
  private scratch: Surface | null = null;
  private edge: Surface | null = null;
  private listeners = new Set<() => void>();
  // どれかのレイヤーが変わるたびに増える
  version = 0;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private changed(layer: PaintLayer | null, notify: boolean) {
    if (layer) layer.version++;
    this.version++;
    if (notify) this.listeners.forEach(l => l());
  }

  // 塗ってあるレイヤー（下から重ねる順）
  paintedLayers(): LayerId[] {
    return LAYER_ORDER.filter(id => this.layers.get(id)?.painted);
  }

  layerCanvas(id: LayerId): HTMLCanvasElement | null {
    return this.layers.get(id)?.canvas ?? null;
  }

  layerVersion(id: LayerId): number {
    return this.layers.get(id)?.version ?? 0;
  }

  private layer(id: LayerId): PaintLayer {
    let l = this.layers.get(id);
    if (!l) {
      l = { ...makeSurface(PAINT_SIZE, PAINT_SIZE), version: 0, painted: false, box: null };
      this.layers.set(id, l);
    }
    return l;
  }

  private getScratch(): Surface {
    if (!this.scratch) this.scratch = makeSurface(PAINT_SIZE, PAINT_SIZE);
    return this.scratch;
  }

  private tip(hardness: number): Surface {
    const key = Math.round(hardness * 20);
    let t = this.tips.get(key);
    if (!t) {
      t = makeTip(key / 20);
      this.tips.set(key, t);
    }
    return t;
  }

  /**
   * パーツの型（UV、白 + アルファ）。お手本の顔の上で形を描いてぼかし、顔メッシュを通して UV へ写す。
   * UV は変わらないので、レイヤーごとに 1 回だけ作る
   */
  mask(id: LayerId): HTMLCanvasElement {
    let m = this.masks.get(id);
    if (!m) {
      const ref = referenceFace(REFERENCE_WIDTH);
      const regions = faceRegions(ref.landmarks, ref.width, ref.height);
      const work = makeSurface(ref.width, ref.height);
      work.ctx.fillStyle = '#fff';
      for (const shape of shapesForLayer(id, regions)) drawShape(work.ctx, shape);
      const rgba = work.ctx.getImageData(0, 0, ref.width, ref.height).data;
      releaseSurface(work);
      const alpha = new Uint8ClampedArray(ref.width * ref.height);
      for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
      const image = { width: ref.width, height: ref.height, data: alpha };
      blurAlpha(image, LAYER_SPEC[id].blur * regions.faceWidth);
      const points = ref.landmarks.map(p => ({ x: p.x * ref.width, y: p.y * ref.height }));
      m = alphaToSurface(warpAlphaToUV(image, points, PAINT_SIZE), PAINT_SIZE);
      this.masks.set(id, m);
    }
    return m.canvas;
  }

  // 顔の輪郭でなじませるための絵（UV、白 + アルファ）。描画がテクスチャとして使う
  edgeFeather(): HTMLCanvasElement {
    if (!this.edge) this.edge = alphaToSurface(edgeFeatherUV(EDGE_FEATHER_SIZE, EDGE_FEATHER_WIDTH), EDGE_FEATHER_SIZE);
    return this.edge.canvas;
  }

  /**
   * なぞった所に塗る / 消す
   * @param target  塗るレイヤー。null なら けしゴム（すべてのレイヤーから消す）
   * @param stamps  スタンプを押す位置（UV）
   * @param color   塗る色（#rrggbb）。けしゴムのときは使わない
   * @param assist  true ならパーツの型で切り抜く（はみださない）
   */
  stroke(target: LayerId | null, stamps: readonly FaceUV[], brush: BrushSpec, color: string, assist: boolean): void {
    if (stamps.length === 0) return;
    const S = PAINT_SIZE;
    const r = Math.max(1, brush.radius * S);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of stamps) {
      minX = Math.min(minX, p.u * S - r); maxX = Math.max(maxX, p.u * S + r);
      minY = Math.min(minY, p.v * S - r); maxY = Math.max(maxY, p.v * S + r);
    }
    const bx = Math.max(0, Math.floor(minX) - 1), by = Math.max(0, Math.floor(minY) - 1);
    const bw = Math.min(S, Math.ceil(maxX) + 1) - bx, bh = Math.min(S, Math.ceil(maxY) + 1) - by;
    if (bw <= 0 || bh <= 0) return;

    // 作業用の canvas に、変わる範囲だけスタンプを押す
    const scratch = this.getScratch();
    const sctx = scratch.ctx;
    const tip = this.tip(brush.hardness).canvas;
    sctx.save();
    sctx.beginPath();
    sctx.rect(bx, by, bw, bh);
    sctx.clip();
    sctx.clearRect(bx, by, bw, bh);
    sctx.globalAlpha = Math.max(0.05, Math.min(1, brush.flow));
    for (const p of stamps) sctx.drawImage(tip, p.u * S - r, p.v * S - r, r * 2, r * 2);
    sctx.globalAlpha = 1;

    if (target === null) {
      sctx.restore();
      for (const layer of this.layers.values()) {
        const b = layer.box;
        if (!layer.painted || !b || b.x1 <= bx || b.x0 >= bx + bw || b.y1 <= by || b.y0 >= by + bh) continue;
        layer.ctx.globalCompositeOperation = 'destination-out';
        layer.ctx.drawImage(scratch.canvas, bx, by, bw, bh, bx, by, bw, bh);
        layer.ctx.globalCompositeOperation = 'source-over';
        layer.version++;
      }
      this.changed(null, false);
      return;
    }

    if (assist) {
      sctx.globalCompositeOperation = 'destination-in';
      sctx.drawImage(this.mask(target), bx, by, bw, bh, bx, by, bw, bh);
    }
    sctx.globalCompositeOperation = 'source-in';
    sctx.fillStyle = color;
    sctx.fillRect(bx, by, bw, bh);
    sctx.restore();

    const layer = this.layer(target);
    layer.ctx.drawImage(scratch.canvas, bx, by, bw, bh, bx, by, bw, bh);
    growBox(layer, bx, by, bw, bh);
    const first = !layer.painted;
    layer.painted = true;
    this.changed(layer, first);
  }

  // パーツの型どおりに色を入れる（そのレイヤーに塗ってあったものは置き換える）
  fill(id: LayerId, color: string, notify = true): void {
    const layer = this.layer(id);
    const ctx = layer.ctx;
    ctx.clearRect(0, 0, PAINT_SIZE, PAINT_SIZE);
    ctx.drawImage(this.mask(id), 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, PAINT_SIZE, PAINT_SIZE);
    ctx.globalCompositeOperation = 'source-over';
    layer.painted = true;
    layer.box = { x0: 0, y0: 0, x1: PAINT_SIZE, y1: PAINT_SIZE };
    this.changed(layer, notify);
  }

  // 塗ってあるものを全部消して、look の色を型どおりに塗る
  fillLook(look: LookState): void {
    this.clearAll(false);
    for (const id of LAYER_ORDER) {
      const style = look[id];
      if (style) this.fill(id, style.color, false);
    }
    this.changed(null, true);
  }

  clear(id: LayerId, notify = true): void {
    const layer = this.layers.get(id);
    if (!layer || !layer.painted) return;
    layer.ctx.clearRect(0, 0, PAINT_SIZE, PAINT_SIZE);
    layer.painted = false;
    layer.box = null;
    this.changed(layer, notify);
  }

  clearAll(notify = true): void {
    for (const id of LAYER_ORDER) this.clear(id, false);
    this.changed(null, notify);
  }

  // いま塗ってあるものの写し（できあがりを みる の前に取っておき、もどす で戻す）
  snapshot(): PaintSnapshot {
    const out: PaintSnapshot = new Map();
    for (const id of this.paintedLayers()) {
      const copy = makeSurface(PAINT_SIZE, PAINT_SIZE);
      copy.ctx.drawImage(this.layers.get(id)!.canvas, 0, 0);
      out.set(id, copy.canvas);
    }
    return out;
  }

  restore(snapshot: PaintSnapshot): void {
    this.clearAll(false);
    for (const [id, canvas] of snapshot) {
      const layer = this.layer(id);
      layer.ctx.drawImage(canvas, 0, 0);
      layer.painted = true;
      layer.box = { x0: 0, y0: 0, x1: PAINT_SIZE, y1: PAINT_SIZE };
      layer.version++;
      // 写しはもう要らないのでメモリを返す
      canvas.width = 0;
      canvas.height = 0;
    }
    this.changed(null, true);
  }

  // 画面を離れるとき: canvas のメモリを返す
  dispose(): void {
    for (const l of this.layers.values()) releaseSurface(l);
    for (const m of this.masks.values()) releaseSurface(m);
    for (const t of this.tips.values()) releaseSurface(t);
    releaseSurface(this.scratch);
    releaseSurface(this.edge);
    this.layers.clear();
    this.masks.clear();
    this.tips.clear();
    this.scratch = null;
    this.edge = null;
    this.listeners.clear();
  }
}
