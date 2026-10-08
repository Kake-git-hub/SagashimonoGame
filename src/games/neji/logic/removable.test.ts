import { describe, expect, it } from 'vitest';
import { findBlockers, listRemovableScrews } from './removable';
import { normalizeStage } from './normalize';
import { StageDef } from '../types';

function snapshot(def: StageDef, removedScrews: string[] = [], removedParts: string[] = []) {
  const stage = normalizeStage(def);
  return {
    stage,
    remainingParts: new Set(stage.parts.map(p => p.id).filter(id => !removedParts.includes(id))),
    remainingScrews: new Set(stage.screws.map(s => s.id).filter(id => !removedScrews.includes(id))),
  };
}

const lidStage: StageDef = {
  id: 'lid', name: 'ふた', difficulty: 1, boxes: [],
  parts: [
    { id: 'base', shape: 'box', size: [4, 1.2, 4], position: [0, 0, 0], fixed: true },
    { id: 'lid', shape: 'box', size: [4.4, 0.4, 4.4], position: [0, 0.8, 0] },
  ],
  screws: [
    { id: 'lidA', color: 'green', position: [1.6, 1.0, 1.6], dir: [0, 1, 0], length: 1.0, partIds: ['lid', 'base'] },
    { id: 'lidB', color: 'green', position: [-1.6, 1.0, -1.6], dir: [0, 1, 0], length: 1.0, partIds: ['lid', 'base'] },
    { id: 'under', color: 'red', position: [0, 0.6, 0], dir: [0, 1, 0], length: 0.8, partIds: ['base'] },
    { id: 'side', color: 'blue', position: [0, 0, 2], dir: [0, 0, 1], length: 1.0, partIds: ['base'] },
  ],
};

describe('パーツ重なり', () => {
  it('ふたの下のネジはふたに邪魔される', () => {
    const blockers = findBlockers(snapshot(lidStage), 'under');
    expect(blockers.map(b => b.id)).toEqual(['lid']);
  });
  it('ふたのネジと横のネジは外せる', () => {
    expect(listRemovableScrews(snapshot(lidStage)).sort()).toEqual(['lidA', 'lidB', 'side']);
  });
  it('ふたが落ちれば下のネジも外せる', () => {
    const snap = snapshot(lidStage, ['lidA', 'lidB'], ['lid']);
    expect(findBlockers(snap, 'under')).toEqual([]);
  });
});

const pinStage: StageDef = {
  id: 'pin', name: 'ピン', difficulty: 2, boxes: [],
  parts: [
    { id: 'base', shape: 'box', size: [5, 1, 5], position: [0, 0, 0], fixed: true },
    { id: 'pillar', shape: 'box', size: [1.2, 3, 1.2], position: [0, 2, 0] },
  ],
  screws: [
    // 柱を上から止めるネジ（中心をずらして横ピンと交差させない）
    { id: 'top', color: 'red', position: [0.35, 3.5, -0.35], dir: [0, 1, 0], length: 3.2, partIds: ['pillar', 'base'] },
    // 柱を貫いて反対側へ 1.0 飛び出すピン
    { id: 'pinX', color: 'blue', position: [0.6, 1.5, 0], dir: [1, 0, 0], length: 2.2, partIds: ['pillar'] },
    { id: 'pinZ', color: 'blue', position: [0, 1.2, 0.6], dir: [0, 0, 1], length: 2.2, partIds: ['pillar'] },
    // 飛び出したピンの真下にある土台のネジ
    { id: 'underX', color: 'red', position: [-1.2, 0.5, 0], dir: [0, 1, 0], length: 1.0, partIds: ['base'] },
    { id: 'underZ', color: 'red', position: [0, 0.5, -1.2], dir: [0, 1, 0], length: 1.0, partIds: ['base'] },
    // 何にも邪魔されない土台のネジ
    { id: 'free', color: 'green', position: [1.5, 0.5, 1.5], dir: [0, 1, 0], length: 1.0, partIds: ['base'] },
    // 隣り合う平行なネジ同士は邪魔しない
    { id: 'near1', color: 'green', position: [-1.5, 0.5, 1.5], dir: [0, 1, 0], length: 1.0, partIds: ['base'] },
    { id: 'near2', color: 'green', position: [-1.5, 0.5, 2.15], dir: [0, 1, 0], length: 1.0, partIds: ['base'] },
  ],
};

describe('ネジ同士の干渉', () => {
  it('飛び出したピンの下のネジはピンに邪魔される', () => {
    expect(findBlockers(snapshot(pinStage), 'underX').map(b => b.id)).toEqual(['pinX']);
    expect(findBlockers(snapshot(pinStage), 'underZ').map(b => b.id)).toEqual(['pinZ']);
  });
  it('ピンを抜けば下のネジが外せる', () => {
    expect(findBlockers(snapshot(pinStage, ['pinX']), 'underX')).toEqual([]);
  });
  it('高さの違うピン同士・上のネジ・隣り合うネジは互いに邪魔しない', () => {
    const removable = listRemovableScrews(snapshot(pinStage)).sort();
    expect(removable).toEqual(['free', 'near1', 'near2', 'pinX', 'pinZ', 'top']);
  });
});
