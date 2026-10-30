/**
 * おしえて（手順ガイド）のデータ形式と、「このステップで顔の上に何を描くか」を作る純粋関数
 * レシピ JSON（public/makeup/recipes/*.json）は点や領域を名前で指し、番号は regions.ts にだけ書く
 */
import { LayerId, LookState, LAYER_ORDER } from './layers';
import { FaceRegions, GuidePathName, GuidePointName, GuideRegionName, Pt, regionShape, Shape } from './regions';

export type GuidePose = 'front' | 'smile' | 'closeEyes';
export const GUIDE_POSES: readonly GuidePose[] = ['front', 'smile', 'closeEyes'];

// ステップの種類（レイヤーに無いもの: マスカラ、仕上げ）
export type GuidePart = LayerId | 'mascara' | 'finish';
export const GUIDE_PARTS: readonly GuidePart[] = [...LAYER_ORDER, 'mascara', 'finish'];

export interface GuideStroke {
  from?: GuidePointName;
  to?: GuidePointName;
  along?: GuidePathName;
  reverse?: boolean;
}

export interface GuideMark {
  type: 'vline' | 'dot';
  anchor: GuidePointName;
}

export interface RecipeStep {
  id: string;
  part: GuidePart;
  title: string;
  text: string;
  pose?: GuidePose;
  regions?: GuideRegionName[];
  strokes?: GuideStroke[];
  marks?: GuideMark[];
  look?: { layer: LayerId; color: string; opacity: number };
}

export interface Recipe {
  id: string;
  name: string;
  emoji: string;
  description: string;
  steps: RecipeStep[];
}

export interface RecipeSummary {
  id: string;
  name: string;
  emoji: string;
  description: string;
  stepCount: number;
}

export interface GuideDrawing {
  faceWidth: number;
  regions: Shape[];
  strokes: Pt[][];                       // 矢印が流れる線（始点 → 終点の順）
  marks: ({ kind: 'vline'; x: number; y1: number; y2: number } | { kind: 'dot'; p: Pt })[];
}

export function strokePath(stroke: GuideStroke, r: FaceRegions): Pt[] | null {
  if (stroke.along) {
    const path = r.paths[stroke.along];
    if (!path) return null;
    return stroke.reverse ? [...path].reverse() : path;
  }
  if (stroke.from && stroke.to) {
    const a = r.points[stroke.from], b = r.points[stroke.to];
    if (!a || !b) return null;
    return stroke.reverse ? [b, a] : [a, b];
  }
  return null;
}

export function buildGuideDrawing(step: RecipeStep, r: FaceRegions): GuideDrawing {
  const regions = (step.regions ?? []).map(name => regionShape(r, name));
  const strokes = (step.strokes ?? []).map(s => strokePath(s, r)).filter((p): p is Pt[] => !!p && p.length >= 2);
  const marks: GuideDrawing['marks'] = [];
  for (const m of step.marks ?? []) {
    const p = r.points[m.anchor];
    if (!p) continue;
    if (m.type === 'dot') marks.push({ kind: 'dot', p });
    else {
      // 縦線: 目の下あたりから眉の上まで
      marks.push({ kind: 'vline', x: p.x, y1: p.y + r.faceWidth * 0.08, y2: p.y - r.faceWidth * 0.22 });
    }
  }
  return { faceWidth: r.faceWidth, regions, strokes, marks };
}

// レシピの look をまとめる（できあがりを みる）。upto を指定するとそのステップまで
export function recipeLook(recipe: Recipe, upto = recipe.steps.length - 1): LookState {
  const look: LookState = {};
  recipe.steps.slice(0, upto + 1).forEach(step => {
    if (step.look) look[step.look.layer] = { color: step.look.color, opacity: step.look.opacity };
  });
  return look;
}

// 表情の係数から、ステップの姿勢ができているか
export function poseSatisfied(pose: GuidePose | undefined, blendshapes: Record<string, number> | null): boolean {
  if (!pose || pose === 'front') return true;
  if (!blendshapes) return false;
  if (pose === 'smile') return ((blendshapes.mouthSmileLeft ?? 0) + (blendshapes.mouthSmileRight ?? 0)) / 2 > 0.45;
  if (pose === 'closeEyes') return ((blendshapes.eyeBlinkLeft ?? 0) + (blendshapes.eyeBlinkRight ?? 0)) / 2 > 0.5;
  return true;
}
