/**
 * 映像の上で作った型（アルファだけの絵）を、顔メッシュを通して UV（塗る絵の座標）へ写す
 * 三角形ごとに、UV 側の画素 → 重心座標 → 元の絵の位置 を求めて、元の絵をなめらかに読む（ソフトウェアのテクスチャ貼り）。
 * 配列だけを扱うので Node のテストでも動く
 */
import { PAINT_TRIANGLES, MESH_POINT_COUNT } from './faceMesh';
import { MESH_UV } from './meshData';

export interface AlphaImage {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray; // 1 画素 1 バイト（0〜255）
}

function sample(img: AlphaImage, x: number, y: number): number {
  // 画素の中心が (i + 0.5) にあるとして、4 点をなめらかに混ぜる
  const fx = Math.max(0, Math.min(img.width - 1, x - 0.5));
  const fy = Math.max(0, Math.min(img.height - 1, y - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = Math.min(img.width - 1, x0 + 1), y1 = Math.min(img.height - 1, y0 + 1);
  const tx = fx - x0, ty = fy - y0;
  const d = img.data, w = img.width;
  const top = d[y0 * w + x0] * (1 - tx) + d[y0 * w + x1] * tx;
  const bottom = d[y1 * w + x0] * (1 - tx) + d[y1 * w + x1] * tx;
  return top * (1 - ty) + bottom * ty;
}

/**
 * @param src       元の絵（お手本の顔の上で描いた型）
 * @param points    お手本の顔の点（src の画素座標）。468 点以上
 * @param size      UV 側の絵の一辺（px）
 * @returns         size × size のアルファ。メッシュの外は 0
 */
export function warpAlphaToUV(src: AlphaImage, points: readonly { x: number; y: number }[], size: number): Uint8ClampedArray {
  if (points.length < MESH_POINT_COUNT) throw new Error('warpAlphaToUV: not enough points');
  const out = new Uint8ClampedArray(size * size);
  const T = PAINT_TRIANGLES;
  const EPS = 1e-4;
  for (let t = 0; t < T.length; t += 3) {
    const ia = T[t], ib = T[t + 1], ic = T[t + 2];
    const ax = MESH_UV[ia * 2] * size, ay = MESH_UV[ia * 2 + 1] * size;
    const bx = MESH_UV[ib * 2] * size, by = MESH_UV[ib * 2 + 1] * size;
    const cx = MESH_UV[ic * 2] * size, cy = MESH_UV[ic * 2 + 1] * size;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (area === 0) continue;
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 0.5));
    const maxX = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx) - 0.5));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy) - 0.5));
    const maxY = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy) - 0.5));
    const pa = points[ia], pb = points[ib], pc = points[ic];
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const wa = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area;
        if (wa < -EPS) continue;
        const wb = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
        if (wb < -EPS) continue;
        const wc = 1 - wa - wb;
        if (wc < -EPS) continue;
        out[y * size + x] = sample(src, pa.x * wa + pb.x * wb + pc.x * wc, pa.y * wa + pb.y * wb + pc.y * wc);
      }
    }
  }
  return out;
}

/**
 * 顔の輪郭に近づくほど 0 になる「ふち」のアルファ（UV）。
 * 輪郭は点がぶれやすく、塗りがそこでぷつっと切れると目立つので、描画のときにこれを掛けてなじませる。
 * メッシュの縁の辺（1 枚の三角形だけに属する辺）からの距離を width（UV の割合）でなだらかにする
 */
export function edgeFeatherUV(size: number, width: number): Uint8ClampedArray {
  const T = PAINT_TRIANGLES;
  // 縁の辺を集める（目・口の穴の縁は含めない: 外側の輪郭だけにするため、いちばん長い輪を選ぶ）
  const count = new Map<string, [number, number]>();
  const seen = new Map<string, number>();
  for (let t = 0; t < T.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = T[t + k], b = T[t + ((k + 1) % 3)];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      count.set(key, [a, b]);
    }
  }
  const next = new Map<number, number[]>();
  for (const [key, n] of seen) {
    if (n !== 1) continue;
    const [a, b] = count.get(key)!;
    next.set(a, [...(next.get(a) ?? []), b]);
    next.set(b, [...(next.get(b) ?? []), a]);
  }
  // 輪ごとに分ける
  const loops: number[][] = [];
  const visited = new Set<number>();
  for (const start of next.keys()) {
    if (visited.has(start)) continue;
    const loop: number[] = [];
    let cur: number | undefined = start, prev = -1;
    while (cur !== undefined && !visited.has(cur)) {
      visited.add(cur);
      loop.push(cur);
      const options: number[] = next.get(cur) ?? [];
      const step: number | undefined = options.find(o => o !== prev && !visited.has(o));
      prev = cur;
      cur = step;
    }
    loops.push(loop);
  }
  const perimeter = (loop: number[]) => loop.reduce((s, i, k) => {
    const j = loop[(k + 1) % loop.length];
    return s + Math.hypot(MESH_UV[i * 2] - MESH_UV[j * 2], MESH_UV[i * 2 + 1] - MESH_UV[j * 2 + 1]);
  }, 0);
  const outer = loops.reduce((best, l) => (perimeter(l) > perimeter(best) ? l : best), loops[0]);
  const segs: number[] = [];
  for (let k = 0; k < outer.length; k++) {
    const i = outer[k], j = outer[(k + 1) % outer.length];
    segs.push(MESH_UV[i * 2] * size, MESH_UV[i * 2 + 1] * size, MESH_UV[j * 2] * size, MESH_UV[j * 2 + 1] * size);
  }

  const out = new Uint8ClampedArray(size * size);
  const w = Math.max(1, width * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      let d2 = Infinity;
      for (let s = 0; s < segs.length; s += 4) {
        const ax = segs[s], ay = segs[s + 1], bx = segs[s + 2], by = segs[s + 3];
        const vx = bx - ax, vy = by - ay;
        const len2 = vx * vx + vy * vy || 1;
        const tt = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2));
        const dx = px - (ax + vx * tt), dy = py - (ay + vy * tt);
        const dd = dx * dx + dy * dy;
        if (dd < d2) d2 = dd;
      }
      const tnorm = Math.min(1, Math.sqrt(d2) / w);
      // なめらかな立ち上がり（smoothstep）
      out[y * size + x] = 255 * tnorm * tnorm * (3 - 2 * tnorm);
    }
  }
  return out;
}

/**
 * アルファの絵をぼかす（箱型のぼかしを 3 回 = ほぼガウスぼかし。sigma は px）。その場で書き換える
 * canvas の filter（Safari では使えない）に頼らないので、どのブラウザでも同じ結果になり、canvas も作らない
 */
export function blurAlpha(img: AlphaImage, sigma: number): void {
  const half = Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2);
  if (half < 1) return;
  const { width: w, height: h, data } = img;
  const tmp = new Float32Array(Math.max(w, h));
  const pass = (start: number, step: number, n: number) => {
    // 端は端の値が続いているものとして平均する
    const size = half * 2 + 1;
    let sum = 0;
    for (let i = -half; i <= half; i++) sum += data[start + Math.max(0, Math.min(n - 1, i)) * step];
    for (let i = 0; i < n; i++) {
      tmp[i] = sum / size;
      const add = Math.min(n - 1, i + half + 1), remove = Math.max(0, i - half);
      sum += data[start + add * step] - data[start + remove * step];
    }
    for (let i = 0; i < n; i++) data[start + i * step] = tmp[i];
  };
  for (let k = 0; k < 3; k++) {
    for (let y = 0; y < h; y++) pass(y * w, 1, w);
    for (let x = 0; x < w; x++) pass(x, w, h);
  }
}
