/**
 * パーツ・ネジの形状計算
 * three.js の数学クラスだけを使い、WebGL のシーンに依存しない（Node のテストでも動く）
 */
import { Box3, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { PartDef, ScrewDef, Stage, Vec3 } from '../types';
import { SCREW } from '../constants';

const EPS = 1e-9;
const UP = new Vector3(0, 1, 0);

export function toVector3(v: Vec3): Vector3 {
  return new Vector3(v[0], v[1], v[2]);
}

function deg(d: number): number {
  return (d * Math.PI) / 180;
}

// === パーツ ===

export function partQuaternion(part: PartDef): Quaternion {
  const rot = part.rotation ?? [0, 0, 0];
  return new Quaternion().setFromEuler(new Euler(deg(rot[0]), deg(rot[1]), deg(rot[2]), 'XYZ'));
}

export function partMatrix(part: PartDef): Matrix4 {
  return new Matrix4().compose(toVector3(part.position), partQuaternion(part), new Vector3(1, 1, 1));
}

// パーツのローカル AABB の 8 頂点をワールド座標で返す（バウンディング計算用）
export function partCornerPoints(part: PartDef): Vector3[] {
  let half: Vector3;
  switch (part.shape) {
    case 'box':
      half = new Vector3(part.size[0] / 2, part.size[1] / 2, part.size[2] / 2);
      break;
    case 'cylinder':
      half = new Vector3(part.radius, part.height / 2, part.radius);
      break;
    case 'sphere':
      half = new Vector3(part.radius, part.radius, part.radius);
      break;
  }
  const m = partMatrix(part);
  const points: Vector3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    points.push(new Vector3(half.x * sx, half.y * sy, half.z * sz).applyMatrix4(m));
  }
  return points;
}

// === ネジ ===

export function screwDirection(screw: ScrewDef): Vector3 {
  const d = toVector3(screw.dir);
  if (d.lengthSq() < EPS) return UP.clone();
  return d.normalize();
}

export function screwLength(screw: ScrewDef): number {
  return screw.length ?? SCREW.DEFAULT_LENGTH;
}

// ローカル +Y を抜ける方向に向ける回転
export function screwQuaternion(screw: ScrewDef): Quaternion {
  return new Quaternion().setFromUnitVectors(UP, screwDirection(screw));
}

export function screwMatrix(screw: ScrewDef): Matrix4 {
  return new Matrix4().compose(toVector3(screw.position), screwQuaternion(screw), new Vector3(1, 1, 1));
}

// ネジの先端（面から内部へ length だけ入った点）
export function screwTip(screw: ScrewDef): Vector3 {
  return toVector3(screw.position).addScaledVector(screwDirection(screw), -screwLength(screw));
}

// ネジの頭の上面の中心
export function screwHeadTop(screw: ScrewDef): Vector3 {
  return toVector3(screw.position).addScaledVector(screwDirection(screw), SCREW.HEAD_HEIGHT);
}

// dir に直交する 2 本の単位ベクトル
export function perpendicularBasis(dir: Vector3): [Vector3, Vector3] {
  const helper = Math.abs(dir.y) < 0.9 ? UP : new Vector3(1, 0, 0);
  const u = new Vector3().crossVectors(dir, helper).normalize();
  const v = new Vector3().crossVectors(dir, u).normalize();
  return [u, v];
}

// === レイ交差（入口の距離 t を返す。原点が内部なら 0、当たらなければ null） ===

interface Interval {
  tMin: number;
  tMax: number;
}

// 区間 [-h, h] のスラブとレイの交差を iv に絞り込む
function clipSlab(o: number, d: number, h: number, iv: Interval): boolean {
  if (Math.abs(d) < EPS) {
    return Math.abs(o) <= h;
  }
  let t1 = (-h - o) / d;
  let t2 = (h - o) / d;
  if (t1 > t2) [t1, t2] = [t2, t1];
  iv.tMin = Math.max(iv.tMin, t1);
  iv.tMax = Math.min(iv.tMax, t2);
  return iv.tMin <= iv.tMax;
}

function entryOf(iv: Interval): number | null {
  if (iv.tMax < 0) return null;
  return Math.max(iv.tMin, 0);
}

// 原点中心の直方体（半サイズ half）
export function rayBoxEntry(o: Vector3, d: Vector3, half: Vector3): number | null {
  const iv: Interval = { tMin: -Infinity, tMax: Infinity };
  if (!clipSlab(o.x, d.x, half.x, iv)) return null;
  if (!clipSlab(o.y, d.y, half.y, iv)) return null;
  if (!clipSlab(o.z, d.z, half.z, iv)) return null;
  return entryOf(iv);
}

// 原点中心・Y 軸方向の円柱
export function rayCylinderEntry(o: Vector3, d: Vector3, radius: number, halfHeight: number): number | null {
  const iv: Interval = { tMin: -Infinity, tMax: Infinity };
  const a = d.x * d.x + d.z * d.z;
  const b = 2 * (o.x * d.x + o.z * d.z);
  const c = o.x * o.x + o.z * o.z - radius * radius;
  if (a < EPS) {
    // 軸と平行
    if (c > 0) return null;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    iv.tMin = (-b - s) / (2 * a);
    iv.tMax = (-b + s) / (2 * a);
  }
  if (!clipSlab(o.y, d.y, halfHeight, iv)) return null;
  return entryOf(iv);
}

// 球
export function raySphereEntry(o: Vector3, d: Vector3, center: Vector3, radius: number): number | null {
  const m = o.clone().sub(center);
  const b = m.dot(d);
  const c = m.dot(m) - radius * radius;
  if (c > 0 && b > 0) return null;
  const disc = b * b - c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const tMax = -b + s;
  if (tMax < 0) return null;
  return Math.max(-b - s, 0);
}

// レイをオブジェクトのローカル座標へ変換（スケールなし前提）
function toLocal(o: Vector3, d: Vector3, matrix: Matrix4): { lo: Vector3; ld: Vector3 } {
  const inv = matrix.clone().invert();
  return {
    lo: o.clone().applyMatrix4(inv),
    ld: d.clone().transformDirection(inv),
  };
}

export function rayPartEntry(o: Vector3, d: Vector3, part: PartDef): number | null {
  switch (part.shape) {
    case 'box': {
      const { lo, ld } = toLocal(o, d, partMatrix(part));
      return rayBoxEntry(lo, ld, new Vector3(part.size[0] / 2, part.size[1] / 2, part.size[2] / 2));
    }
    case 'cylinder': {
      const { lo, ld } = toLocal(o, d, partMatrix(part));
      return rayCylinderEntry(lo, ld, part.radius, part.height / 2);
    }
    case 'sphere':
      return raySphereEntry(o, d, toVector3(part.position), part.radius);
  }
}

// ネジ（軸の円柱 + 頭の円柱）
export function rayScrewEntry(o: Vector3, d: Vector3, screw: ScrewDef): number | null {
  const { lo, ld } = toLocal(o, d, screwMatrix(screw));
  const len = screwLength(screw);
  // 軸: 中心がローカル y = -len/2
  const shaft = rayCylinderEntry(lo.clone().setY(lo.y + len / 2), ld, SCREW.SHAFT_RADIUS, len / 2);
  // 頭: 中心がローカル y = +HEAD_HEIGHT/2
  const head = rayCylinderEntry(lo.clone().setY(lo.y - SCREW.HEAD_HEIGHT / 2), ld, SCREW.HEAD_RADIUS, SCREW.HEAD_HEIGHT / 2);
  if (shaft === null) return head;
  if (head === null) return shaft;
  return Math.min(shaft, head);
}

// === 図形全体の大きさ（カメラ合わせ用） ===

export interface ModelBounds {
  center: Vector3;
  radius: number;
}

export function computeModelBounds(stage: Stage): ModelBounds {
  const box = new Box3();
  for (const part of stage.parts) {
    for (const p of partCornerPoints(part)) box.expandByPoint(p);
  }
  for (const screw of stage.screws) {
    box.expandByPoint(screwHeadTop(screw));
    box.expandByPoint(screwTip(screw));
  }
  if (box.isEmpty()) {
    return { center: new Vector3(), radius: 1 };
  }
  const center = new Vector3();
  box.getCenter(center);
  const size = new Vector3();
  box.getSize(size);
  return { center, radius: Math.max(size.length() / 2, 0.5) };
}

export function partCenter(part: PartDef): Vector3 {
  return toVector3(part.position);
}
