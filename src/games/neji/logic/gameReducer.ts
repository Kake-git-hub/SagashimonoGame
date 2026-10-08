/**
 * ネジはずしゲームの状態遷移
 */
import { Blocker, Stage } from '../types';
import { findBlockers } from './removable';
import { createSortState, findFreeParts, placeScrew, SortEvent, SortState } from './rules';

export type GameStatus = 'playing' | 'cleared' | 'failed';

export interface BlockedFeedback {
  seq: number;        // 連打を区別するための連番
  screwId: string;
  blockers: Blocker[];
}

// HUD のアニメーション用。seq は単調増加
export type GameEvent = SortEvent & { seq: number };

export interface NejiGameState {
  stage: Stage;
  generation: number;                   // reset のたびに増える（演出のリセット用）
  remainingScrews: ReadonlySet<string>; // 図形に残っているネジ（判定対象）
  remainingParts: ReadonlySet<string>;  // 残っているパーツ（判定対象）
  removingScrews: readonly string[];    // 取り外しアニメーション中（表示のみ）
  fallingParts: readonly string[];      // 落下アニメーション中（表示のみ）
  sort: SortState;                      // ボックスと一時置き場
  events: readonly GameEvent[];         // 直近のアクションで起きた出来事
  eventSeq: number;
  status: GameStatus;
  moves: number;
  feedback: BlockedFeedback | null;     // 外せないネジをタップしたときの情報
}

export type NejiAction =
  | { type: 'reset'; stage: Stage }
  | { type: 'tapScrew'; id: string }
  | { type: 'screwRemoveDone'; id: string }
  | { type: 'partFallDone'; id: string };

export function createInitialState(stage: Stage, generation = 0): NejiGameState {
  return {
    stage,
    generation,
    remainingScrews: new Set(stage.screws.map(s => s.id)),
    remainingParts: new Set(stage.parts.map(p => p.id)),
    removingScrews: [],
    fallingParts: [],
    sort: createSortState(stage),
    events: [],
    eventSeq: 0,
    status: 'playing',
    moves: 0,
    feedback: null,
  };
}

export function nejiReducer(state: NejiGameState, action: NejiAction): NejiGameState {
  switch (action.type) {
    case 'reset':
      return createInitialState(action.stage, state.generation + 1);

    case 'tapScrew': {
      if (state.status !== 'playing') return state;
      if (!state.remainingScrews.has(action.id)) return state;
      const screw = state.stage.screws.find(s => s.id === action.id);
      if (!screw) return state;

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

      // 行き先を決める
      const placed = placeScrew(state.stage, state.sort, screw.id, screw.color);
      let seq = state.eventSeq;
      const events: GameEvent[] = placed.events.map(e => ({ ...e, seq: ++seq }));

      let status: GameStatus = 'playing';
      if (placed.overflow) status = 'failed';
      else if (remainingScrews.size === 0) status = 'cleared';

      return {
        ...state,
        remainingScrews,
        remainingParts,
        removingScrews: [...state.removingScrews, action.id],
        fallingParts: [...state.fallingParts, ...freed],
        sort: placed.state,
        events,
        eventSeq: seq,
        status,
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
