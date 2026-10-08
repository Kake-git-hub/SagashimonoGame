import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { rayBoxEntry, rayCylinderEntry, rayPartEntry, rayScrewEntry, raySphereEntry, screwTip } from './geometry';
import { BoxPartDef, CylinderPartDef, ScrewDef } from '../types';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);

describe('rayBoxEntry', () => {
  const half = new Vector3(1, 1, 1);
  it('外から当たる', () => {
    expect(rayBoxEntry(new Vector3(-3, 0, 0), X, half)).toBeCloseTo(2);
  });
  it('内部から始まると 0', () => {
    expect(rayBoxEntry(new Vector3(0, 0, 0), X, half)).toBe(0);
  });
  it('外れる', () => {
    expect(rayBoxEntry(new Vector3(-3, 2, 0), X, half)).toBeNull();
  });
  it('後ろにあると当たらない', () => {
    expect(rayBoxEntry(new Vector3(3, 0, 0), X, half)).toBeNull();
  });
});

describe('rayCylinderEntry', () => {
  it('側面に当たる', () => {
    expect(rayCylinderEntry(new Vector3(-3, 0, 0), X, 1, 2)).toBeCloseTo(2);
  });
  it('上の蓋に当たる', () => {
    expect(rayCylinderEntry(new Vector3(0.5, 5, 0), new Vector3(0, -1, 0), 1, 2)).toBeCloseTo(3);
  });
  it('軸と平行で内部なら 0', () => {
    expect(rayCylinderEntry(new Vector3(0.5, 0, 0), Y, 1, 2)).toBe(0);
  });
  it('軸と平行で外側なら当たらない', () => {
    expect(rayCylinderEntry(new Vector3(1.5, -5, 0), Y, 1, 2)).toBeNull();
  });
  it('高さの外を通ると当たらない', () => {
    expect(rayCylinderEntry(new Vector3(-3, 2.5, 0), X, 1, 2)).toBeNull();
  });
});

describe('raySphereEntry', () => {
  it('当たる', () => {
    expect(raySphereEntry(new Vector3(-3, 0, 0), X, new Vector3(0, 0, 0), 1)).toBeCloseTo(2);
  });
  it('内部なら 0', () => {
    expect(raySphereEntry(new Vector3(0.2, 0, 0), X, new Vector3(0, 0, 0), 1)).toBe(0);
  });
  it('外れる', () => {
    expect(raySphereEntry(new Vector3(-3, 1.5, 0), X, new Vector3(0, 0, 0), 1)).toBeNull();
  });
});

describe('rayPartEntry（回転あり）', () => {
  it('90度回した直方体に当たる', () => {
    // 幅 4・高さ 1 の板を Z 軸まわりに 90 度回す → 幅 1・高さ 4 になる
    const part: BoxPartDef = { id: 'p', shape: 'box', size: [4, 1, 1], position: [0, 0, 0], rotation: [0, 0, 90] };
    expect(rayPartEntry(new Vector3(0, 5, 0), new Vector3(0, -1, 0), part)).toBeCloseTo(3);
    expect(rayPartEntry(new Vector3(-5, 0, 0), X, part)).toBeCloseTo(4.5);
  });
  it('横に倒した円柱に当たる', () => {
    const part: CylinderPartDef = { id: 'c', shape: 'cylinder', radius: 0.5, height: 4, position: [0, 0, 0], rotation: [0, 0, 90] };
    expect(rayPartEntry(new Vector3(0, 5, 0), new Vector3(0, -1, 0), part)).toBeCloseTo(4.5);
    expect(rayPartEntry(new Vector3(-5, 0, 0), X, part)).toBeCloseTo(3);
  });
});

describe('rayScrewEntry', () => {
  const screw: ScrewDef = { id: 's', color: 'red', position: [0, 1, 0], dir: [0, 1, 0], length: 1, partIds: [] };
  it('先端は面から length 下', () => {
    expect(screwTip(screw).y).toBeCloseTo(0);
  });
  it('軸に横から当たる', () => {
    expect(rayScrewEntry(new Vector3(-2, 0.5, 0), X, screw)).toBeCloseTo(2 - 0.12);
  });
  it('頭に横から当たる', () => {
    expect(rayScrewEntry(new Vector3(-2, 1.1, 0), X, screw)).toBeCloseTo(2 - 0.3);
  });
  it('頭より上は当たらない', () => {
    expect(rayScrewEntry(new Vector3(-2, 1.5, 0), X, screw)).toBeNull();
  });
});
