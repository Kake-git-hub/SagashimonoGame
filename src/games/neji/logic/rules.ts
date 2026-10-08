/**
 * ゲームのルール（純粋関数）
 * リデューサー（ゲーム本体）とソルバー（ステージ検証）の両方から使う
 */
import { Vector3 } from 'three';
import { PartDef, SCREW_COLORS, ScrewColor, Stage } from '../types';
import { computeModelBounds, partCenter, toVector3 } from './geometry';

// ネジが 1 本も残っていない（固定でない）パーツ = 落ちるパーツ
export function findFreeParts(
  stage: Stage,
  remainingParts: ReadonlySet<string>,
  remainingScrews: ReadonlySet<string>,
): string[] {
  const heldParts = new Set<string>();
  for (const screw of stage.screws) {
    if (!remainingScrews.has(screw.id)) continue;
    for (const partId of screw.partIds) heldParts.add(partId);
  }
  return stage.parts
    .filter(p => remainingParts.has(p.id) && !p.fixed && !heldParts.has(p.id))
    .map(p => p.id);
}

// パーツが落ちるときに押し出される方向
export function partFallDirection(stage: Stage, part: PartDef): Vector3 {
  if (part.detachDir) {
    const d = toVector3(part.detachDir);
    if (d.lengthSq() > 1e-9) return d.normalize();
  }
  const { center } = computeModelBounds(stage);
  const d = partCenter(part).sub(center);
  if (d.lengthSq() < 1e-6) return new Vector3(0, 1, 0);
  return d.normalize();
}

// === 色仕分け（ボックス・一時置き場） ===

export interface BoxSlot {
  uid: number;        // 登場ごとに一意（アニメーションのキー）
  color: ScrewColor;
  filled: number;     // 入っているネジの本数
}

export interface BufferItem {
  screwId: string;
  color: ScrewColor;
}

export interface SortState {
  boxes: (BoxSlot | null)[];    // 表示中のボックス（null はキューが尽きた空き枠）
  nextBoxIndex: number;         // stage.boxes の次に登場するインデックス
  buffer: (BufferItem | null)[];
  nextUid: number;
}

export type BoxTarget = { kind: 'box'; uid: number; position: number; slot: number };
export type PlaceTarget = BoxTarget | { kind: 'buffer'; slot: number };

export type SortEvent =
  | { type: 'screwPlaced'; screwId: string; color: ScrewColor; target: PlaceTarget }
  | { type: 'bufferMoved'; screwId: string; color: ScrewColor; fromSlot: number; target: BoxTarget }
  | { type: 'boxFull'; uid: number; position: number; color: ScrewColor }
  | { type: 'boxArrived'; uid: number; position: number; color: ScrewColor }
  | { type: 'overflow'; screwId: string; color: ScrewColor };

export interface PlaceResult {
  state: SortState;
  events: SortEvent[];
  overflow: boolean;
}

export function createSortState(stage: Stage): SortState {
  const boxes: (BoxSlot | null)[] = [];
  let uid = 1;
  for (let i = 0; i < stage.visibleBoxes; i++) {
    const color = stage.boxes[i];
    boxes.push(color ? { uid: uid++, color, filled: 0 } : null);
  }
  return {
    boxes,
    nextBoxIndex: Math.min(stage.visibleBoxes, stage.boxes.length),
    buffer: Array.from({ length: stage.bufferSlots }, () => null),
    nextUid: uid,
  };
}

// 満杯になったボックスを退場させ、次のボックスを出し、一時置き場から同色を移す
function completeBox(stage: Stage, state: SortState, position: number, events: SortEvent[]): void {
  const full = state.boxes[position];
  if (!full) return;
  events.push({ type: 'boxFull', uid: full.uid, position, color: full.color });

  const nextColor = state.boxes.length > 0 ? stage.boxes[state.nextBoxIndex] : undefined;
  if (!nextColor) {
    state.boxes[position] = null;
    return;
  }
  state.nextBoxIndex += 1;
  const box: BoxSlot = { uid: state.nextUid++, color: nextColor, filled: 0 };
  state.boxes[position] = box;
  events.push({ type: 'boxArrived', uid: box.uid, position, color: box.color });

  // 一時置き場の同色ネジを順に移す
  for (let slot = 0; slot < state.buffer.length && box.filled < stage.boxCapacity; slot++) {
    const item = state.buffer[slot];
    if (!item || item.color !== box.color) continue;
    state.buffer[slot] = null;
    const targetSlot = box.filled;
    box.filled += 1;
    events.push({
      type: 'bufferMoved',
      screwId: item.screwId,
      color: item.color,
      fromSlot: slot,
      target: { kind: 'box', uid: box.uid, position, slot: targetSlot },
    });
  }
  if (box.filled >= stage.boxCapacity) {
    completeBox(stage, state, position, events);
  }
}

/**
 * 外したネジを行き先へ置く。
 * 同色で空きのあるボックス → 一時置き場 → どちらも無ければ overflow（失敗）
 */
export function placeScrew(stage: Stage, prev: SortState, screwId: string, color: ScrewColor): PlaceResult {
  const state: SortState = {
    boxes: prev.boxes.map(b => (b ? { ...b } : null)),
    nextBoxIndex: prev.nextBoxIndex,
    buffer: [...prev.buffer],
    nextUid: prev.nextUid,
  };
  const events: SortEvent[] = [];

  const position = state.boxes.findIndex(b => b && b.color === color && b.filled < stage.boxCapacity);
  if (position >= 0) {
    const box = state.boxes[position]!;
    const slot = box.filled;
    box.filled += 1;
    events.push({ type: 'screwPlaced', screwId, color, target: { kind: 'box', uid: box.uid, position, slot } });
    if (box.filled >= stage.boxCapacity) {
      completeBox(stage, state, position, events);
    }
    return { state, events, overflow: false };
  }

  const slot = state.buffer.findIndex(item => item === null);
  if (slot >= 0) {
    state.buffer[slot] = { screwId, color };
    events.push({ type: 'screwPlaced', screwId, color, target: { kind: 'buffer', slot } });
    return { state, events, overflow: false };
  }

  events.push({ type: 'overflow', screwId, color });
  return { state, events, overflow: true };
}

// ソルバーのメモ化用キー（ネジの id は無視し、色と本数だけを見る）
export function sortStateKey(state: SortState): string {
  const boxes = state.boxes.map(b => (b ? `${b.color}${b.filled}` : '-')).join(',');
  const buffer = state.buffer
    .map(item => (item ? item.color : ''))
    .filter(c => c !== '')
    .sort()
    .join(',');
  return `${boxes}|${state.nextBoxIndex}|${buffer}`;
}

// 色ごとのネジ本数
export function countScrewsByColor(stage: Stage): Record<ScrewColor, number> {
  const counts = Object.fromEntries(SCREW_COLORS.map(c => [c, 0])) as Record<ScrewColor, number>;
  for (const screw of stage.screws) counts[screw.color] += 1;
  return counts;
}
