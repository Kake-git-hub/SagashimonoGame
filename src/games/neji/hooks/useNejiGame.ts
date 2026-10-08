import { useCallback, useEffect, useReducer } from 'react';
import { Stage } from '../types';
import { createInitialState, nejiReducer } from '../logic/gameReducer';

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

  return { state, tapScrew, screwRemoveDone, partFallDone, reset };
}
