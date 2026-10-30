/**
 * ためす（バーチャルメイク）のレイヤー状態
 * 描画はこの状態と顔の領域（regions.ts）を読むだけにして、ここはテストできる純粋なロジックに保つ
 */
import { FaceRegions, Shape } from './regions';

export type LayerId = 'base' | 'concealer' | 'blush' | 'eyeshadow' | 'eyeliner' | 'brow' | 'highlight' | 'lip';

export interface LayerStyle {
  color: string;    // #rrggbb
  opacity: number;  // 0〜1（「つよさ」）
}

export type LookState = Partial<Record<LayerId, LayerStyle>>;

// 下から順に重ねる
export const LAYER_ORDER: LayerId[] = ['base', 'concealer', 'blush', 'eyeshadow', 'eyeliner', 'brow', 'highlight', 'lip'];

export type BlendMode = 'multiply' | 'screen' | 'normal';

export interface LayerSpec {
  blend: BlendMode;
  blur: number;           // ぼかしの半径（顔の幅に対する割合）
  defaultOpacity: number; // 色を選んだときの「つよさ」
  tint: number;           // multiply のあとに普通合成で色を乗せる割合（発色を補う）
  maxAlpha: number;       // つよさ 100% のときの実際の不透明度
}

export const LAYER_SPEC: Record<LayerId, LayerSpec> = {
  base:       { blend: 'normal',   blur: 0.08,  defaultOpacity: 0.3,  tint: 0,    maxAlpha: 0.45 },
  concealer:  { blend: 'normal',   blur: 0.06,  defaultOpacity: 0.4,  tint: 0,    maxAlpha: 0.5 },
  blush:      { blend: 'multiply', blur: 0.12,  defaultOpacity: 0.55, tint: 0.55, maxAlpha: 0.9 },
  eyeshadow:  { blend: 'multiply', blur: 0.045, defaultOpacity: 0.5,  tint: 0.4,  maxAlpha: 0.8 },
  eyeliner:   { blend: 'multiply', blur: 0.006, defaultOpacity: 0.8,  tint: 0.5,  maxAlpha: 0.95 },
  brow:       { blend: 'multiply', blur: 0.012, defaultOpacity: 0.5,  tint: 0.3,  maxAlpha: 0.7 },
  highlight:  { blend: 'screen',   blur: 0.05,  defaultOpacity: 0.45, tint: 0,    maxAlpha: 0.55 },
  lip:        { blend: 'multiply', blur: 0.012, defaultOpacity: 0.6,  tint: 0.45, maxAlpha: 0.9 },
};

// レイヤーごとに塗る形
export function shapesForLayer(layer: LayerId, r: FaceRegions): Shape[] {
  switch (layer) {
    case 'base':
      return [{ kind: 'polygon', points: r.faceOval, holes: [r.eyeR, r.eyeL, r.lipsInner] }];
    case 'concealer':
      return [{ kind: 'polygon', points: r.underEyeR }, { kind: 'polygon', points: r.underEyeL }];
    case 'blush':
      return [r.cheekR, r.cheekL];
    case 'eyeshadow':
      return [{ kind: 'polygon', points: r.shadowR, holes: [r.eyeR] }, { kind: 'polygon', points: r.shadowL, holes: [r.eyeL] }];
    case 'eyeliner':
      return [r.linerR, r.linerL];
    case 'brow':
      return [{ kind: 'polygon', points: r.browR }, { kind: 'polygon', points: r.browL }];
    case 'highlight': {
      const width = r.faceWidth * 0.035;
      return [
        { kind: 'stroke', points: r.noseBridge, widths: r.noseBridge.map(() => width) },
        r.cheekboneR, r.cheekboneL, r.chinHighlight, r.foreheadHighlight,
      ];
    }
    case 'lip':
      return [{ kind: 'polygon', points: r.lipsOuter, holes: [r.lipsInner] }];
  }
}

// 状態の更新
export type LookAction =
  | { type: 'set'; layer: LayerId; style: LayerStyle }
  | { type: 'color'; layer: LayerId; color: string }      // 色だけ変える（無ければ既定のつよさで追加）
  | { type: 'opacity'; layer: LayerId; opacity: number }  // つよさだけ変える（無ければ何もしない）
  | { type: 'clear'; layer: LayerId }
  | { type: 'clearAll' }
  | { type: 'replace'; look: LookState };

export function lookReducer(state: LookState, action: LookAction): LookState {
  switch (action.type) {
    case 'set':
      return { ...state, [action.layer]: { color: action.style.color, opacity: clamp01(action.style.opacity) } };
    case 'color': {
      const current = state[action.layer];
      return { ...state, [action.layer]: { color: action.color, opacity: current?.opacity ?? LAYER_SPEC[action.layer].defaultOpacity } };
    }
    case 'opacity': {
      const current = state[action.layer];
      if (!current) return state;
      return { ...state, [action.layer]: { ...current, opacity: clamp01(action.opacity) } };
    }
    case 'clear': {
      if (!state[action.layer]) return state;
      const next = { ...state };
      delete next[action.layer];
      return next;
    }
    case 'clearAll':
      return {};
    case 'replace':
      return { ...action.look };
  }
}

export function activeLayers(state: LookState): LayerId[] {
  return LAYER_ORDER.filter(id => !!state[id]);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// 保存された状態を安全に読む
export function sanitizeLook(raw: unknown): LookState {
  if (!raw || typeof raw !== 'object') return {};
  const out: LookState = {};
  for (const id of LAYER_ORDER) {
    const v = (raw as Record<string, unknown>)[id];
    if (!v || typeof v !== 'object') continue;
    const { color, opacity } = v as { color?: unknown; opacity?: unknown };
    if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) continue;
    out[id] = { color, opacity: typeof opacity === 'number' ? clamp01(opacity) : LAYER_SPEC[id].defaultOpacity };
  }
  return out;
}
