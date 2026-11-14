import { describe, expect, it } from 'vitest';
import fixture from './fixtures/portrait-frame.json';
import { Point3 } from '../types';
import { locateOnFace, meshUV, MESH_POINT_COUNT, PAINT_TRIANGLES, projectFromFace, UV_FACE_WIDTH } from './faceMesh';
import { MESH_TRIANGLES, MESH_UV } from './meshData';
import { IDX, faceRegions, polygonCenter } from './regions';

const landmarks: Point3[] = (fixture.landmarks as number[][]).map(([x, y, z]) => ({ x, y, z }));

describe('顔メッシュのデータ', () => {
  it('三角形は 468 点の中の番号だけを使い、UV は 0〜1 に収まる', () => {
    expect(MESH_UV.length).toBe(MESH_POINT_COUNT * 2);
    expect(MESH_TRIANGLES.length % 3).toBe(0);
    for (const i of MESH_TRIANGLES) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(MESH_POINT_COUNT);
    }
    for (const v of MESH_UV) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    // 額は上、あごは下。自分の右頬は左側
    expect(meshUV(10).v).toBeLessThan(meshUV(152).v);
    expect(meshUV(234).u).toBeLessThan(meshUV(454).u);
    expect(UV_FACE_WIDTH).toBeGreaterThan(0.8);
  });

  it('塗る三角形は UV の上でも、正面の顔の上でも同じ向き（裏返りが無い）', () => {
    const T = PAINT_TRIANGLES;
    expect(T.length).toBeGreaterThan(800 * 3);
    let flipped = 0;
    for (let t = 0; t < T.length; t += 3) {
      const [a, b, c] = [T[t], T[t + 1], T[t + 2]];
      const uvCross = (MESH_UV[b * 2] - MESH_UV[a * 2]) * (MESH_UV[c * 2 + 1] - MESH_UV[a * 2 + 1])
        - (MESH_UV[b * 2 + 1] - MESH_UV[a * 2 + 1]) * (MESH_UV[c * 2] - MESH_UV[a * 2]);
      expect(uvCross).toBeGreaterThan(0);
      const pa = landmarks[a], pb = landmarks[b], pc = landmarks[c];
      if ((pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x) <= 0) flipped++;
    }
    // 正面の写真では、輪郭のごく一部を除いて表を向いている
    expect(flipped / (T.length / 3)).toBeLessThan(0.03);
  });

  it('目の中と口の中には三角形が無い（白目や歯に色が乗らない）', () => {
    const r = faceRegions(landmarks, fixture.width, fixture.height);
    for (const poly of [r.eyeR, r.eyeL, r.lipsInner]) {
      const c = polygonCenter(poly);
      expect(locateOnFace(landmarks, c.x / fixture.width, c.y / fixture.height)).toBeNull();
    }
    for (const ring of [IDX.eyeR, IDX.eyeL, IDX.lipsInner]) {
      const set = new Set<number>(ring);
      for (let t = 0; t < PAINT_TRIANGLES.length; t += 3) {
        expect(set.has(PAINT_TRIANGLES[t]) && set.has(PAINT_TRIANGLES[t + 1]) && set.has(PAINT_TRIANGLES[t + 2])).toBe(false);
      }
    }
  });
});

describe('locateOnFace / projectFromFace', () => {
  it('顔の点の位置は、その点の UV になる', () => {
    for (const i of [1, 4, 50, 280, 205, 425, 151, 199]) {
      const uv = locateOnFace(landmarks, landmarks[i].x, landmarks[i].y);
      expect(uv).not.toBeNull();
      expect(uv!.u).toBeCloseTo(meshUV(i).u, 2);
      expect(uv!.v).toBeCloseTo(meshUV(i).v, 2);
    }
  });

  it('顔の外は null', () => {
    expect(locateOnFace(landmarks, 0.02, 0.02)).toBeNull();
    expect(locateOnFace(landmarks, 0.98, 0.9)).toBeNull();
    expect(locateOnFace([], 0.5, 0.5)).toBeNull();
  });

  it('映像 → UV → 映像 で元の位置に戻る（頬・額・あご）', () => {
    const r = faceRegions(landmarks, fixture.width, fixture.height);
    const spots = [r.points.cheekCenterR, r.points.cheekCenterL, r.points.foreheadLower, r.points.noseTip, { x: r.points.chin.x, y: r.points.chin.y - r.faceWidth * 0.1 }];
    for (const p of spots) {
      const x = p.x / fixture.width, y = p.y / fixture.height;
      const uv = locateOnFace(landmarks, x, y);
      expect(uv).not.toBeNull();
      const back = projectFromFace(landmarks, uv!);
      expect(back).not.toBeNull();
      expect(back!.x).toBeCloseTo(x, 4);
      expect(back!.y).toBeCloseTo(y, 4);
    }
  });

  it('顔が動いても、同じ肌の場所は同じ UV になる（塗った所が付いてくる）', () => {
    // 顔全体を右下へずらして 1.3 倍にした点群
    const moved = landmarks.map(p => ({ x: (p.x - 0.5) * 1.3 + 0.55, y: (p.y - 0.5) * 1.3 + 0.52, z: p.z * 1.3 }));
    const cheek = { x: (landmarks[50].x + landmarks[205].x) / 2, y: (landmarks[50].y + landmarks[205].y) / 2 };
    const before = locateOnFace(landmarks, cheek.x, cheek.y)!;
    const after = locateOnFace(moved, (cheek.x - 0.5) * 1.3 + 0.55, (cheek.y - 0.5) * 1.3 + 0.52)!;
    expect(after.u).toBeCloseTo(before.u, 5);
    expect(after.v).toBeCloseTo(before.v, 5);
  });
});
