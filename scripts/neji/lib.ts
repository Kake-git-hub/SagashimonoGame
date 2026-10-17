/**
 * ステージ生成の道具（npm run gen:neji）
 * パーツ・ネジを短く書くための関数と、発掘ステージ（土のブロック + ふた + 石）の生成
 * ネジの色はここでは決めない（logic/colorize.ts が後で混ぜて決める）
 */
import { PartDef, ScrewDef, StageDef, TreasureDef, Vec3 } from '../../src/games/neji/types';

type PartExtra = Partial<Pick<PartDef, 'rotation' | 'fixed' | 'detachDir' | 'unfold'>> & { segments?: number };

export function box(id: string, size: Vec3, position: Vec3, color: string, extra: PartExtra = {}): PartDef {
  const { segments: _ignored, ...rest } = extra;
  void _ignored;
  return { id, shape: 'box', size, position, color, ...rest };
}

export function cyl(id: string, radius: number, height: number, position: Vec3, color: string, extra: PartExtra = {}): PartDef {
  return { id, shape: 'cylinder', radius, height, position, color, ...extra };
}

export function sph(id: string, radius: number, position: Vec3, color: string, extra: PartExtra = {}): PartDef {
  const { segments: _ignored, ...rest } = extra;
  void _ignored;
  return { id, shape: 'sphere', radius, position, color, ...rest };
}

export function fancy(
  id: string,
  shape: 'star' | 'heart' | 'gem' | 'bone' | 'egg' | 'ring' | 'crown' | 'shell',
  radius: number,
  height: number,
  position: Vec3,
  color: string,
  extra: PartExtra = {},
): PartDef {
  const { segments: _ignored, ...rest } = extra;
  void _ignored;
  return { id, shape, radius, height, position, color, ...rest };
}

// 色は仮（あとで colorize が決める）
export function screw(id: string, position: Vec3, dir: Vec3, length: number, partIds: string[]): ScrewDef {
  return { id, color: 'red', position, dir, length, partIds };
}

export const UP: Vec3 = [0, 1, 0];
export const DOWN: Vec3 = [0, -1, 0];
export const FRONT: Vec3 = [0, 0, 1];
export const BACK: Vec3 = [0, 0, -1];
export const RIGHT: Vec3 = [1, 0, 0];
export const LEFT: Vec3 = [-1, 0, 0];

export const r2 = (x: number): number => Math.round(x * 100) / 100;
export const v = (x: number, y: number, z: number): Vec3 => [r2(x), r2(y), r2(z)];

export interface StageSpec {
  id: string;
  name: string;
  emoji: string;
  difficulty: number;
  parts: PartDef[];
  screws: ScrewDef[];
  treasure?: TreasureDef;
  bufferSlots?: number;
  visibleBoxes?: number;
}

export function toStageDef(spec: StageSpec): StageDef {
  const def: StageDef = {
    id: spec.id,
    name: spec.name,
    emoji: spec.emoji,
    difficulty: spec.difficulty,
    boxes: [],
    parts: spec.parts,
    screws: spec.screws,
  };
  if (spec.treasure) def.treasure = spec.treasure;
  if (spec.bufferSlots !== undefined) def.bufferSlots = spec.bufferSlots;
  if (spec.visibleBoxes !== undefined) def.visibleBoxes = spec.visibleBoxes;
  return def;
}

// === 発掘ステージ ===

export interface DigSpec {
  id: string;
  name: string;
  emoji: string;
  difficulty: number;
  treasure: { id: string; name: string; emoji: string; parts: PartDef[] }; // parts は fixed にする
  cell: [number, number];     // ブロック 1 個の幅・高さ（すきま込み）
  depth: number;              // ブロックの奥行き（z）
  cols: number;               // 列数（中央の列に核が入る。奇数）
  rows: number;               // 行数（中央の行に核が入る。奇数）
  coreRows?: number;          // 核が占める行数（1 か 2。2 なら中央とその上）
  blockColors: string[];      // 土の色（順に使う）
  lidColor: string;
  lids: { front?: boolean; back?: boolean; top?: boolean; bottom?: boolean };
  planks?: number;            // 前のふたを横長の板に分ける枚数（1 なら 1 枚）
  stones?: { color: string; count: number }; // 前のふたの上に乗せる石（ふたのネジをふさぐ）
  extraScrews?: number;       // ネジの本数を 3 の倍数に合わせるために足す本数（側面に足す）
}

/**
 * 土のブロックを格子に並べ、ふた（板）と石で覆う。
 * - ブロック 1 個につきネジ 1 本（上の行は上向き、下の行は下向き、中段は前後向き）
 * - ふたのネジはブロックまでねじ込む（partIds: [ふた, ブロック]）。ふたの下のネジはふたが落ちるまで外せない
 * - 石は前のふたの上に 0.25 浮かせて置き、ふたのネジの 1 本を覆う
 */
export function buildDig(spec: DigSpec): StageSpec {
  const [cw, ch] = spec.cell;
  const { depth, cols, rows } = spec;
  const coreRows = spec.coreRows ?? 1;
  const parts: PartDef[] = [];
  const screws: ScrewDef[] = [];
  const gap = 0.2; // ブロック同士のすきま
  const bw = cw - gap;
  const bh = ch - gap;
  const x0 = -((cols - 1) * cw) / 2;
  const y0 = -((rows - 1) * ch) / 2;
  const midCol = (cols - 1) / 2;
  const midRow = (rows - 1) / 2;
  const isCore = (c: number, r: number) => c === midCol && r >= midRow && r < midRow + coreRows;

  for (const p of spec.treasure.parts) parts.push({ ...p, fixed: true });

  // ブロック
  let colorIndex = 0;
  const blockAt: Record<string, string> = {};
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isCore(c, r)) continue;
      const id = `d${c}${r}`;
      const x = x0 + c * cw;
      const y = y0 + r * ch;
      parts.push(box(id, v(bw, bh, depth), v(x, y, 0), spec.blockColors[colorIndex++ % spec.blockColors.length]));
      blockAt[`${c},${r}`] = id;
      if (r === rows - 1) {
        screws.push(screw(`t${c}`, v(x, y + bh / 2, 0), UP, Math.min(1.0, bh - 0.2), [id]));
      } else if (r === 0) {
        screws.push(screw(`b${c}`, v(x, y - bh / 2, 0), DOWN, Math.min(1.0, bh - 0.2), [id]));
      } else if (c < midCol) {
        screws.push(screw(`f${c}${r}`, v(x, y, depth / 2), FRONT, Math.min(1.0, depth - 0.2), [id]));
      } else if (c > midCol) {
        screws.push(screw(`k${c}${r}`, v(x, y, -depth / 2), BACK, Math.min(1.0, depth - 0.2), [id]));
      } else {
        // 核の上下（中央の列）: 前向き
        screws.push(screw(`f${c}${r}`, v(x, y, depth / 2), FRONT, Math.min(1.0, depth - 0.2), [id]));
      }
    }
  }

  const totalW = cols * cw - gap;
  const totalH = rows * ch - gap;
  const lidT = 0.5;
  const lidGap = 0.25;
  const lidLen = lidT + lidGap + 0.5;

  // ふたのネジ: ブロックの中心から (±0.55, ±0.45) ずらした点（ブロックのネジと交差しない）
  const lidScrewSpots = (lidId: string, zSign: 1 | -1, cells: [number, number][], prefix: string) => {
    for (const [c, r] of cells) {
      const blockId = blockAt[`${c},${r}`];
      if (!blockId) continue;
      const x = x0 + c * cw + (c <= midCol ? 0.55 : -0.55);
      const y = y0 + r * ch + (r <= midRow ? 0.45 : -0.45);
      screws.push(screw(`${prefix}${c}${r}`, v(x, y, zSign * (depth / 2 + lidGap + lidT)), zSign > 0 ? FRONT : BACK, lidLen, [lidId, blockId]));
    }
  };

  const lidCellsFront: [number, number][] = [];
  const lidCellsBack: [number, number][] = [];
  // 角 2 つ + 中段の端（前）／角 2 つ + 中段の端（後）
  lidCellsFront.push([0, rows - 1], [cols - 1, 0]);
  lidCellsBack.push([cols - 1, rows - 1], [0, 0]);
  if (rows >= 3) {
    lidCellsFront.push([cols - 1, Math.floor(midRow)]);
    lidCellsBack.push([0, Math.floor(midRow)]);
  }

  if (spec.lids.front) {
    const planks = spec.planks ?? 1;
    if (planks <= 1) {
      parts.push(box('front', v(totalW, totalH, lidT), v(0, 0, depth / 2 + lidGap + lidT / 2), spec.lidColor));
      lidScrewSpots('front', 1, lidCellsFront, 'F');
    } else {
      // 横長の板を縦に並べる。各板はその板が覆うブロックへねじ込む
      const ph = (totalH - gap * (planks - 1)) / planks;
      for (let i = 0; i < planks; i++) {
        const y = -totalH / 2 + ph / 2 + i * (ph + gap);
        const id = `plank${i}`;
        parts.push(box(id, v(totalW, ph, lidT), v(0, y, depth / 2 + lidGap + lidT / 2), spec.lidColor));
        // 板の左右の端に 1 本ずつ（その位置にあるブロックへ）
        for (const c of [0, cols - 1]) {
          const r = Math.max(0, Math.min(rows - 1, Math.round((y - y0) / ch)));
          const blockId = blockAt[`${c},${r}`];
          if (!blockId) continue;
          const x = x0 + c * cw + (c <= midCol ? 0.55 : -0.55);
          screws.push(screw(`P${i}${c}`, v(x, y + (i % 2 === 0 ? 0.1 : -0.1), depth / 2 + lidGap + lidT), FRONT, lidLen, [id, blockId]));
        }
      }
    }
  }
  if (spec.lids.back) {
    parts.push(box('back', v(totalW, totalH, lidT), v(0, 0, -(depth / 2 + lidGap + lidT / 2)), spec.lidColor));
    lidScrewSpots('back', -1, lidCellsBack, 'K');
  }
  if (spec.lids.top) {
    const y = y0 + (rows - 1) * ch + bh / 2 + lidGap + lidT / 2;
    parts.push(box('cap', v(totalW, lidT, depth), v(0, y, 0), spec.lidColor));
    for (let c = 0; c < cols; c++) {
      const blockId = blockAt[`${c},${rows - 1}`];
      if (!blockId) continue;
      const x = x0 + c * cw + (c < midCol ? 0.6 : c > midCol ? -0.6 : 0.6);
      screws.push(screw(`C${c}`, v(x, y + lidT / 2, 0), UP, lidLen, ['cap', blockId]));
    }
  }
  if (spec.lids.bottom) {
    const y = y0 - bh / 2 - lidGap - lidT / 2;
    parts.push(box('tray', v(totalW, lidT, depth), v(0, y, 0), spec.lidColor));
    for (let c = 0; c < cols; c++) {
      const blockId = blockAt[`${c},0`];
      if (!blockId) continue;
      const x = x0 + c * cw + (c < midCol ? -0.6 : c > midCol ? 0.6 : -0.6);
      screws.push(screw(`B${c}`, v(x, y - lidT / 2, 0), DOWN, lidLen, ['tray', blockId]));
    }
  }

  // 石: 前のふたのネジの上に浮かせて置く（石のネジは横にずらして、ふた → ブロックまでねじ込む）
  if (spec.stones && spec.lids.front) {
    const frontScrews = screws.filter(s => s.id.startsWith('F') || s.id.startsWith('P'));
    const zFace = depth / 2 + lidGap + lidT;
    for (let i = 0; i < Math.min(spec.stones.count, frontScrews.length); i++) {
      const target = frontScrews[i];
      const radius = 0.7;
      const id = `stone${i}`;
      const cx = target.position[0];
      const cy = target.position[1];
      const cz = zFace + lidGap + radius;
      parts.push(sph(id, radius, v(cx, cy, cz), spec.stones.color));
      // 石のネジ: 中心から 0.45 ずらした所から石を貫く（ふたのネジの頭には当たらない）
      const ox = cx < 0 ? -0.45 : 0.45;
      const half = Math.sqrt(radius * radius - 0.45 * 0.45);
      screws.push(screw(`S${i}`, v(cx + ox, cy, cz + half), FRONT, r2(half * 2 - 0.05), [id]));
    }
  }

  // 本数合わせ: 側面（左右の端のブロック）に横向きのネジを足す
  const extra = spec.extraScrews ?? ((3 - (screws.length % 3)) % 3);
  const sideCells: [number, number, 1 | -1][] = [];
  for (let r = 0; r < rows; r++) {
    sideCells.push([cols - 1, r, 1], [0, r, -1]);
  }
  for (let i = 0; i < extra; i++) {
    const [c, r, sign] = sideCells[i % sideCells.length];
    const blockId = blockAt[`${c},${r}`];
    if (!blockId) continue;
    const x = x0 + c * cw + (sign * bw) / 2;
    const y = y0 + r * ch + (i >= sideCells.length ? -0.5 : 0.3);
    screws.push(screw(`E${i}`, v(x, y, 0), sign > 0 ? RIGHT : LEFT, 0.6, [blockId]));
  }

  return {
    id: spec.id,
    name: spec.name,
    emoji: spec.emoji,
    difficulty: spec.difficulty,
    parts,
    screws,
    treasure: { id: spec.treasure.id, name: spec.treasure.name, emoji: spec.treasure.emoji, partIds: spec.treasure.parts.map(p => p.id) },
  };
}
