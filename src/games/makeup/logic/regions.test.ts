import { describe, expect, it } from 'vitest';
import fixture from './fixtures/portrait-frame.json';
import { Point3 } from '../types';
import { faceRegions, pointInPolygon, polygonArea, polygonCenter } from './regions';
import { LAYER_ORDER, shapesForLayer } from './layers';

const landmarks: Point3[] = (fixture.landmarks as number[][]).map(([x, y, z]) => ({ x, y, z }));
const W = fixture.width, H = fixture.height;
const r = faceRegions(landmarks, W, H);

describe('faceRegions（サンプルの顔写真）', () => {
  it('唇は内側が外側に含まれ、面積がある', () => {
    expect(polygonArea(r.lipsOuter)).toBeGreaterThan(polygonArea(r.lipsInner));
    for (const p of r.lipsInner) expect(pointInPolygon(p, r.lipsOuter)).toBe(true);
    expect(polygonArea(r.lipsOuter)).toBeGreaterThan(r.faceWidth * r.faceWidth * 0.01);
  });

  it('目は左右で同じくらいの大きさで、自分の右目は映像の左側にある', () => {
    const a = polygonArea(r.eyeR), b = polygonArea(r.eyeL);
    expect(a / b).toBeGreaterThan(0.6);
    expect(a / b).toBeLessThan(1.6);
    expect(polygonCenter(r.eyeR).x).toBeLessThan(polygonCenter(r.eyeL).x);
  });

  it('アイシャドウの帯は目の上にあり、目は含まない', () => {
    const eye = polygonCenter(r.eyeR);
    const shadow = polygonCenter(r.shadowR);
    expect(shadow.y).toBeLessThan(eye.y);
    expect(pointInPolygon(eye, r.shadowR)).toBe(false);
    // 眉の下側の点は帯の縁なので、眉の中心は帯の外
    expect(pointInPolygon(polygonCenter(r.browR), r.shadowR)).toBe(false);
  });

  it('眉は目の上、目の下の領域は目の下にある', () => {
    expect(polygonCenter(r.browR).y).toBeLessThan(polygonCenter(r.eyeR).y);
    expect(polygonCenter(r.browL).y).toBeLessThan(polygonCenter(r.eyeL).y);
    expect(polygonCenter(r.underEyeR).y).toBeGreaterThan(polygonCenter(r.eyeR).y);
  });

  it('チークは目より下・口より上で、こめかみに向かって傾いている', () => {
    for (const [cheek, eye, temple] of [[r.cheekR, r.eyeR, r.points.templeR], [r.cheekL, r.eyeL, r.points.templeL]] as const) {
      expect(cheek.cy).toBeGreaterThan(polygonCenter(eye).y);
      expect(cheek.cy).toBeLessThan(r.points.lipTop.y);
      expect(pointInPolygon({ x: cheek.cx, y: cheek.cy }, r.faceOval)).toBe(true);
      // 楕円の長い方向の先がこめかみ側（x が外側）を向いている
      const dx = Math.cos(cheek.rotation) * cheek.rx;
      expect(Math.sign(dx)).toBe(Math.sign(temple.x - cheek.cx));
    }
  });

  it('アイラインは目尻側が太く、跳ね上げは目尻の外側にある', () => {
    const l = r.linerR;
    expect(l.widths[1]).toBeGreaterThan(l.widths[l.widths.length - 1]);
    expect(l.points[0].x).toBeLessThan(r.points.eyeOuterR.x);
    expect(l.points[0].y).toBeLessThan(r.points.eyeOuterR.y);
    const m = r.linerL;
    expect(m.points[0].x).toBeGreaterThan(r.points.eyeOuterL.x);
  });

  it('ハイライトの位置は顔の中にある', () => {
    for (const e of [r.cheekboneR, r.cheekboneL, r.chinHighlight, r.foreheadHighlight]) {
      expect(pointInPolygon({ x: e.cx, y: e.cy }, r.faceOval)).toBe(true);
    }
  });

  it('すべてのレイヤーに塗る形がある', () => {
    for (const id of LAYER_ORDER) {
      expect(shapesForLayer(id, r).length).toBeGreaterThan(0);
    }
  });
});
