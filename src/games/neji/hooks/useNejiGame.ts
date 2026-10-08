import { useCallback, useEffect, useReducer } from 'react';
import { Stage } from '../types';
import { createInitialState, nejiReducer, REWIND_MOVES } from '../logic/gameReducer';

export function useNejiGame(stage: Stage) {
  const [state, dispatch] = useReducer(nejiReducer, stage, createInitialState);

  // ステージが変わったら最初から
  useEffect(() => {
    dispatch({ type: 'reset', stage });
  }, [stage]);

  const tapScrew = useCallback((id: string) => dispatch({ type: 'tapScrew', id }), []);
  const screwRemoveDone = useCallback((id: string) => dispatch({ type: 'screwRemoveDone', id }), []);
  const partFallDone = useCallback((id: string) => dispatch({ type: 'partFallDone', id }), []);
  const reset = useCallback(() => dispatch({ type: 'reset', stage }), [stage]);
  const addBox = useCallback(() => dispatch({ type: 'addBox' }), []);
  const addBuffer = useCallback(() => dispatch({ type: 'addBuffer' }), []);
  const rewind = useCallback((moves: number = REWIND_MOVES) => dispatch({ type: 'rewind', moves }), []);

  return { state, tapScrew, screwRemoveDone, partFallDone, reset, addBox, addBuffer, rewind };
}
