// ネジはずしゲームの型定義

export type Vec3 = [number, number, number];

// ネジの色（ボックスの色と共通）
export const SCREW_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const;
export type ScrewColor = (typeof SCREW_COLORS)[number];

// === ステージ定義（public/neji/stages/*.json） ===

interface PartBase {
  id: string;
  position: Vec3;      // ワールド座標（パーツ中心）
  rotation?: Vec3;     // オイラー角（度）。省略時は回転なし
  color?: string;      // CSS カラー。省略時は既定色
  fixed?: boolean;     // true なら最後まで落ちない（土台）
  detachDir?: Vec3;    // 落下時に押し出す方向。省略時は図形中心から外向き
}

export interface BoxPartDef extends PartBase {
  shape: 'box';
  size: Vec3;          // 幅・高さ・奥行き
}

export interface CylinderPartDef extends PartBase {
  shape: 'cylinder';
  radius: number;
  height: number;      // ローカル Y 軸方向の長さ
}

export interface SpherePartDef extends PartBase {
  shape: 'sphere';
  radius: number;
}

export type PartDef = BoxPartDef | CylinderPartDef | SpherePartDef;

export interface ScrewDef {
  id: string;
  color: ScrewColor;
  position: Vec3;      // ネジの頭が乗っている面上の点
  dir: Vec3;           // 外向き（抜ける方向）。正規化されていなくてもよい
  length?: number;     // 面から内部へ入る軸の長さ。省略時は既定値
  partIds: string[];   // このネジが固定しているパーツ（先頭が頭の乗っているパーツ）
}

export interface StageDef {
  id: string;
  name: string;
  emoji?: string;
  difficulty: number;      // 1〜5
  boxCapacity?: number;    // ボックス 1 個に入るネジの本数（既定 3）
  visibleBoxes?: number;   // 同時に表示するボックス数（既定 2）
  bufferSlots?: number;    // 一時置き場の穴数（既定 5）
  boxes: ScrewColor[];     // ボックスが登場する順番
  parts: PartDef[];
  screws: ScrewDef[];
}

// 既定値を埋めた後のステージ
export type Stage = Required<Pick<StageDef, 'boxCapacity' | 'visibleBoxes' | 'bufferSlots'>> & StageDef;

// public/neji/index.json の 1 件
export interface StageSummary {
  id: string;
  name: string;
  emoji?: string;
  difficulty: number;
  screwCount: number;
}

// === 進捗 ===

export interface NejiStageProgress {
  cleared: boolean;
  clearedAt?: number;
  bestMoves?: number;
}

export type NejiProgressMap = Record<string, NejiStageProgress>;

// === ゲーム中の状態 ===

// ネジを外せない原因
export interface Blocker {
  kind: 'part' | 'screw';
  id: string;
  distance: number; // ネジ先端からの距離（近い順に並べる用）
}
