import { useState, useCallback, useEffect } from 'react';
import { Puzzle, GameState, CONSTANTS, Progress } from '../types';
import { saveProgress, getProgress } from '../services/storageService';

export function useGame(puzzle: Puzzle | null) {
  const [state, setState] = useState<GameState>({
    puzzle: null,
    foundTargets: [],
    isCompleted: false,
    showHint: false,
    hintTarget: null,
  });

  // パズルが変わったら状態をリセット（進捗があれば復元）
  useEffect(() => {
    if (!puzzle) {
      setState({
        puzzle: null,
        foundTargets: [],
        isCompleted: false,
        showHint: false,
        hintTarget: null,
      });
      return;
    }

    // 保存された進捗を復元
    const progress = getProgress(puzzle.id);
    const foundTargets = progress?.foundTargets || [];
    const isCompleted = progress?.completed || false;

    setState({
      puzzle,
      foundTargets,
      isCompleted,
      showHint: false,
      hintTarget: null,
    });
  }, [puzzle]);

  // クリック位置をチェック（0-1000スケールの座標を受け取る）
  const checkTarget = useCallback((clickX: number, clickY: number): string | null => {
    if (!state.puzzle || state.isCompleted) return null;

    for (const target of state.puzzle.targets) {
      // すでに発見済みならスキップ
      if (state.foundTargets.includes(target.title)) continue;

      const [targetX, targetY] = target.position;
      const distance = Math.hypot(clickX - targetX, clickY - targetY);

      if (distance < CONSTANTS.HIT_RADIUS) {
        return target.title;
      }
    }

    return null;
  }, [state.puzzle, state.foundTargets, state.isCompleted]);

  // ターゲットを発見済みにする
  const markFound = useCallback((title: string) => {
    setState(prev => {
      if (!prev.puzzle) return prev;
      if (prev.foundTargets.includes(title)) return prev;

      const newFoundTargets = [...prev.foundTargets, title];
      const isCompleted = newFoundTargets.length === prev.puzzle.targets.length;

      // 進捗を保存
      const progress: Progress = {
        puzzleId: prev.puzzle.id,
        foundTargets: newFoundTargets,
        completed: isCompleted,
        lastPlayed: Date.now(),
      };
      saveProgress(progress);

      return {
        ...prev,
        foundTargets: newFoundTargets,
        isCompleted,
      };
    });
  }, []);

  // ヒントを表示
  const triggerHint = useCallback(() => {
    setState(prev => {
      if (!prev.puzzle) return prev;

      // 未発見のターゲットからランダムに1つ選ぶ
      const unfoundTargets = prev.puzzle.targets.filter(
        t => !prev.foundTargets.includes(t.title)
      );

      if (unfoundTargets.length === 0) return prev;

      const randomTarget = unfoundTargets[Math.floor(Math.random() * unfoundTargets.length)];

      return {
        ...prev,
        showHint: true,
        hintTarget: randomTarget.title,
      };
    });

    // 一定時間後にヒントを非表示
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        showHint: false,
        hintTarget: null,
      }));
    }, CONSTANTS.HINT_DURATION);
  }, []);

  // ゲームをリセット
  const resetGame = useCallback(() => {
    setState(prev => {
      if (!prev.puzzle) return prev;

      // 進捗をリセット
      const progress: Progress = {
        puzzleId: prev.puzzle.id,
        foundTargets: [],
        completed: false,
        lastPlayed: Date.now(),
      };
      saveProgress(progress);

      return {
        ...prev,
        foundTargets: [],
        isCompleted: false,
        showHint: false,
        hintTarget: null,
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
