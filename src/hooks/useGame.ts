import { useState, useCallback, useEffect, useRef } from 'react';
import { Puzzle, GameState, CONSTANTS, Progress, HintState, makePositionKey, getTotalPositionCount, getHintRadius } from '../types';
import { saveProgress, getProgress } from '../services/storageService';

export function useGame(puzzle: Puzzle | null) {
  const [state, setState] = useState<GameState>({
    puzzle: null,
    foundPositions: new Set(),
    isCompleted: false,
    showHint: false,
    hintTarget: null,
    hintState: null,
  });

  const hintTimerRef = useRef<number | null>(null);

  // パズルが変わったら状態をリセット（進捗があれば復元）
  useEffect(() => {
    if (!puzzle) {
      setState({
        puzzle: null,
        foundPositions: new Set(),
        isCompleted: false,
        showHint: false,
        hintTarget: null,
        hintState: null,
      });
      return;
    }

    // 保存された進捗を復元
    const progress = getProgress(puzzle.id);
    const foundPositions = new Set(progress?.foundPositions || []);
    const totalPositions = getTotalPositionCount(puzzle);
    const isCompleted = progress?.completed || foundPositions.size >= totalPositions;

    setState({
      puzzle,
      foundPositions,
      isCompleted,
      showHint: false,
      hintTarget: null,
      hintState: null,
    });
  }, [puzzle]);

  // クリック位置をチェック（0-1000スケールの座標を受け取る）
  // 見つかった場合は位置キー "title:index" を返す
  const checkTarget = useCallback((clickX: number, clickY: number): string | null => {
    if (!state.puzzle || state.isCompleted) return null;

    for (const target of state.puzzle.targets) {
      for (let i = 0; i < target.positions.length; i++) {
        const posKey = makePositionKey(target.title, i);
        // すでに発見済みならスキップ
        if (state.foundPositions.has(posKey)) continue;

        const [targetX, targetY] = target.positions[i];
        const distance = Math.hypot(clickX - targetX, clickY - targetY);
        if (distance < CONSTANTS.HIT_RADIUS) {
          return posKey;
        }
      }
    }

    return null;
  }, [state.puzzle, state.foundPositions, state.isCompleted]);

  // 位置を発見済みにする
  const markFound = useCallback((positionKey: string) => {
    setState(prev => {
      if (!prev.puzzle) return prev;
      if (prev.foundPositions.has(positionKey)) return prev;

      const newFoundPositions = new Set(prev.foundPositions);
      newFoundPositions.add(positionKey);
      
      const totalPositions = getTotalPositionCount(prev.puzzle);
      const isCompleted = newFoundPositions.size >= totalPositions;

      // 進捗を保存
      const progress: Progress = {
        puzzleId: prev.puzzle.id,
        foundPositions: Array.from(newFoundPositions),
        completed: isCompleted,
        lastPlayed: Date.now(),
      };
      saveProgress(progress);

      return {
        ...prev,
        foundPositions: newFoundPositions,
        isCompleted,
      };
    });
  }, []);

  // ヒントを表示（連打で段階的に狭まる）
  const triggerHint = useCallback(() => {
    // 前のタイマーをクリア
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
    }

    setState(prev => {
      if (!prev.puzzle) return prev;

      // 未発見の位置を取得
      const unfound: { target: string; positionIndex: number; position: [number, number] }[] = [];
      for (const target of prev.puzzle.targets) {
        for (let i = 0; i < target.positions.length; i++) {
          const posKey = makePositionKey(target.title, i);
          if (!prev.foundPositions.has(posKey)) {
            unfound.push({
              target: target.title,
              positionIndex: i,
              position: target.positions[i],
            });
          }
        }
      }

      if (unfound.length === 0) return prev;

      // 同じターゲット・位置への連打か判定
      let nextLevel = 0;
      let selectedTarget: string;
      let selectedPositionIndex: number;
      let selectedPosition: [number, number];
      let centerOffset: [number, number];

      if (prev.showHint && prev.hintState) {
        // 既にヒント表示中
        const stillUnfound = unfound.find(
          u => u.target === prev.hintState!.target && u.positionIndex === prev.hintState!.positionIndex
        );
        
        if (stillUnfound) {
          // 同じ位置でレベルアップ
          selectedTarget = prev.hintState.target;
          selectedPositionIndex = prev.hintState.positionIndex;
          selectedPosition = stillUnfound.position;
          nextLevel = prev.hintState.level + 1;
          
          // レベルが上がったらオフセットを再計算
          const hintRadius = getHintRadius(nextLevel);
          centerOffset = calculateRandomOffset(selectedPosition, hintRadius);
        } else {
          // 前の位置が見つかった → 新しい位置
          const random = unfound[Math.floor(Math.random() * unfound.length)];
          selectedTarget = random.target;
          selectedPositionIndex = random.positionIndex;
          selectedPosition = random.position;
          nextLevel = 0;
          const hintRadius = getHintRadius(0);
          centerOffset = calculateRandomOffset(selectedPosition, hintRadius);
        }
      } else {
        // 新規ヒント
        const random = unfound[Math.floor(Math.random() * unfound.length)];
        selectedTarget = random.target;
        selectedPositionIndex = random.positionIndex;
        selectedPosition = random.position;
        nextLevel = 0;
        const hintRadius = getHintRadius(0);
        centerOffset = calculateRandomOffset(selectedPosition, hintRadius);
      }

      const newHintState: HintState = {
        target: selectedTarget,
        positionIndex: selectedPositionIndex,
        level: nextLevel,
        centerOffset,
      };

      return {
        ...prev,
        showHint: true,
        hintTarget: selectedTarget,
        hintState: newHintState,
      };
    });

    // 一定時間後にヒントを非表示
    hintTimerRef.current = window.setTimeout(() => {
      setState(prev => ({
        ...prev,
        showHint: false,
        hintTarget: null,
        hintState: null,
      }));
    }, CONSTANTS.HINT_DURATION);
  }, []);

  // ランダムオフセットを計算
  function calculateRandomOffset(answerPos: [number, number], hintRadius: number): [number, number] {
    const maxOffset = Math.max(0, hintRadius - CONSTANTS.HIT_RADIUS);
    
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * maxOffset;
    
    const offsetX = Math.cos(angle) * distance;
    const offsetY = Math.sin(angle) * distance;
    
    const margin = hintRadius;
    const newX = Math.max(margin, Math.min(CONSTANTS.SCALE - margin, answerPos[0] + offsetX));
    const newY = Math.max(margin, Math.min(CONSTANTS.SCALE - margin, answerPos[1] + offsetY));
    
    return [newX - answerPos[0], newY - answerPos[1]];
  }

  // ゲームをリセット
  const resetGame = useCallback(() => {
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
    }
    
    setState(prev => {
      if (!prev.puzzle) return prev;

      const progress: Progress = {
        puzzleId: prev.puzzle.id,
        foundPositions: [],
        completed: false,
        lastPlayed: Date.now(),
      };
      saveProgress(progress);

      return {
        ...prev,
        foundPositions: new Set(),
        isCompleted: false,
        showHint: false,
        hintTarget: null,
        hintState: null,
      };
    });
  }, []);

  return {
    ...state,
    checkTarget,
    markFound,
    triggerHint,
    resetGame,
  };
}
