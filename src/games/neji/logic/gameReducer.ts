/**
 * ネジはずしゲームの状態遷移
 */
import { Blocker, Stage } from '../types';
import { findBlockers } from './removable';
import { addBoxSlot, addBufferSlot, createSortState, findFreeParts, placeScrew, SortEvent, SortState } from './rules';

export type GameStatus = 'playing' | 'cleared' | 'failed';

export interface BlockedFeedback {
  seq: number;        // 連打を区別するための連番
  screwId: string;
  blockers: Blocker[];
}

// HUD のアニメーション用。seq は単調増加
export type GameEvent = SortEvent & { seq: number };

// 「もどす」用に 1 手ごとに取っておく状態
interface MoveSnapshot {
  remainingScrews: ReadonlySet<string>;
  remainingParts: ReadonlySet<string>;
  sort: SortState;
  moves: number;
}

export interface NejiGameState {
  stage: Stage;
  generation: number;                   // reset / もどす のたびに増える（演出のリセット用）
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
  history: readonly MoveSnapshot[];     // 直前までの手（もどす用）
  extraBoxes: number;                   // このステージで「＋はこ」した回数
  extraBuffer: number;                  // このステージで「＋おきば」した回数
}

export type NejiAction =
  | { type: 'reset'; stage: Stage }
  | { type: 'tapScrew'; id: string }
  | { type: 'screwRemoveDone'; id: string }
  | { type: 'partFallDone'; id: string }
  | { type: 'addBox' }
  | { type: 'addBuffer' }
  | { type: 'rewind'; moves: number }; // 指定した手数だけ戻して遊べる状態にする

export const REWIND_MOVES = 3;

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
    history: [],
    extraBoxes: 0,
    extraBuffer: 0,
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

      const snapshot: MoveSnapshot = {
        remainingScrews: state.remainingScrews,
        remainingParts: state.remainingParts,
        sort: state.sort,
        moves: state.moves,
      };

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
        history: [...state.history, snapshot],
      };
    }

    case 'screwRemoveDone':
      if (!state.removingScrews.includes(action.id)) return state;
      return { ...state, removingScrews: state.removingScrews.filter(id => id !== action.id) };

    case 'partFallDone':
      if (!state.fallingParts.includes(action.id)) return state;
      return { ...state, fallingParts: state.fallingParts.filter(id => id !== action.id) };

    case 'addBox': {
      if (state.status !== 'playing') return state;
      const added = addBoxSlot(state.stage, state.sort);
      if (added.state === state.sort) return state;
      let seq = state.eventSeq;
      const events: GameEvent[] = added.events.map(e => ({ ...e, seq: ++seq }));
      return { ...state, sort: added.state, events, eventSeq: seq, extraBoxes: state.extraBoxes + 1 };
    }

    case 'addBuffer': {
      if (state.status !== 'playing') return state;
      return { ...state, sort: addBufferSlot(state.sort), extraBuffer: state.extraBuffer + 1 };
    }

    case 'rewind': {
      const count = Math.min(Math.max(1, action.moves), state.history.length);
      if (count === 0) return state;
      const target = state.history[state.history.length - count];
      return {
        ...state,
        generation: state.generation + 1,
        remainingScrews: target.remainingScrews,
        remainingParts: target.remainingParts,
        removingScrews: [],
        fallingParts: [],
        sort: target.sort,
        events: [],
        status: 'playing',
        moves: target.moves,
        feedback: null,
        history: state.history.slice(0, state.history.length - count),
      };
    }

    default:
      return state;
  }
}
