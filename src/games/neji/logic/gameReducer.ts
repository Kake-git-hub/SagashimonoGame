/**
 * ネジはずしゲームの状態遷移
 */
import { Blocker, Stage } from '../types';
import { findBlockers } from './removable';
import { findFreeParts } from './rules';

export type GameStatus = 'playing' | 'cleared';

export interface BlockedFeedback {
  seq: number;        // 連打を区別するための連番
  screwId: string;
  blockers: Blocker[];
}

export interface NejiGameState {
  stage: Stage;
  remainingScrews: ReadonlySet<string>; // 図形に残っているネジ（判定対象）
  remainingParts: ReadonlySet<string>;  // 残っているパーツ（判定対象）
  removingScrews: readonly string[];    // 取り外しアニメーション中（表示のみ）
  fallingParts: readonly string[];      // 落下アニメーション中（表示のみ）
  status: GameStatus;
  moves: number;
  feedback: BlockedFeedback | null;     // 外せないネジをタップしたときの情報
}

export type NejiAction =
  | { type: 'reset'; stage: Stage }
  | { type: 'tapScrew'; id: string }
  | { type: 'screwRemoveDone'; id: string }
  | { type: 'partFallDone'; id: string };

export function createInitialState(stage: Stage): NejiGameState {
  return {
    stage,
    remainingScrews: new Set(stage.screws.map(s => s.id)),
    remainingParts: new Set(stage.parts.map(p => p.id)),
    removingScrews: [],
    fallingParts: [],
    status: 'playing',
    moves: 0,
    feedback: null,
  };
}

export function nejiReducer(state: NejiGameState, action: NejiAction): NejiGameState {
  switch (action.type) {
    case 'reset':
      return createInitialState(action.stage);

    case 'tapScrew': {
      if (state.status !== 'playing') return state;
      if (!state.remainingScrews.has(action.id)) return state;

      const blockers = findBlockers(state, action.id);
      if (blockers.length > 0) {
        return {
          ...state,
          feedback: { seq: (state.feedback?.seq ?? 0) + 1, screwId: action.id, blockers },
        };
      }

      const remainingScrews = new Set(state.remainingScrews);
      remainingScrews.delete(action.id);

      // ネジが無くなったパーツは落ちる
      const freed = findFreeParts(state.stage, state.remainingParts, remainingScrews);
      const remainingParts = new Set(state.remainingParts);
      for (const id of freed) remainingParts.delete(id);

      return {
        ...state,
        remainingScrews,
        remainingParts,
        removingScrews: [...state.removingScrews, action.id],
        fallingParts: [...state.fallingParts, ...freed],
        status: remainingScrews.size === 0 ? 'cleared' : 'playing',
        moves: state.moves + 1,
      };
    }

    case 'screwRemoveDone':
      if (!state.removingScrews.includes(action.id)) return state;
      return { ...state, removingScrews: state.removingScrews.filter(id => id !== action.id) };

    case 'partFallDone':
      if (!state.fallingParts.includes(action.id)) return state;
      return { ...state, fallingParts: state.fallingParts.filter(id => id !== action.id) };

    default:
      return state;
  }
}
