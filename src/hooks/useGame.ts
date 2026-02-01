import { useState, useCallback, useEffect, useRef } from 'react';
import { Puzzle, GameState, CONSTANTS, Progress, HintState } from '../types';
import { saveProgress, getProgress } from '../services/storageService';

export function useGame(puzzle: Puzzle | null) {
  const [state, setState] = useState<GameState>({
    puzzle: null,
    foundTargets: [],
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
        foundTargets: [],
        isCompleted: false,
        showHint: false,
        hintTarget: null,
        hintState: null,
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
      hintState: null,
    });
  }, [puzzle]);

  // クリック位置をチェック（0-1000スケールの座標を受け取る）
  const checkTarget = useCallback((clickX: number, clickY: number): string | null => {
    if (!state.puzzle || state.isCompleted) return null;

    for (const target of state.puzzle.targets) {
      // すでに発見済みならスキップ
      if (state.foundTargets.includes(target.title)) continue;

      // 複数座標のいずれかにヒットすればOK
      for (const [targetX, targetY] of target.positions) {
        const distance = Math.hypot(clickX - targetX, clickY - targetY);
        if (distance < CONSTANTS.HIT_RADIUS) {
          return target.title;
        }
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

  // ヒントを表示（連打で段階的に狭まる）
  const triggerHint = useCallback(() => {
    // 前のタイマーをクリア
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
    }

    setState(prev => {
      if (!prev.puzzle) return prev;

      // 未発見のターゲットからランダムに1つ選ぶ
      const unfoundTargets = prev.puzzle.targets.filter(
        t => !prev.foundTargets.includes(t.title)
      );

      if (unfoundTargets.length === 0) return prev;

      // 同じターゲットへの連打か、新しいターゲットか判定
      let nextLevel = 0;
      let targetName: string;
      let centerOffset: [number, number];

      if (prev.showHint && prev.hintState) {
        // 既にヒント表示中 → レベルアップ（同じターゲット）
        const currentTarget = unfoundTargets.find(t => t.title === prev.hintState!.target);
        if (currentTarget) {
          // 同じターゲットでレベルアップ
          targetName = prev.hintState.target;
          nextLevel = Math.min(prev.hintState.level + 1, CONSTANTS.HINT_RADII.length - 1);
          
          // レベルが上がったらオフセットを再計算（より精密に）
          const hintRadius = CONSTANTS.HINT_RADII[nextLevel];
          centerOffset = calculateRandomOffset(currentTarget.positions[0], hintRadius);
        } else {
          // 前のターゲットが見つかった後の連打 → 新しいターゲット
          const randomTarget = unfoundTargets[Math.floor(Math.random() * unfoundTargets.length)];
          targetName = randomTarget.title;
          nextLevel = 0;
          const hintRadius = CONSTANTS.HINT_RADII[0];
          centerOffset = calculateRandomOffset(randomTarget.positions[0], hintRadius);
        }
      } else {
        // 新規ヒント
        const randomTarget = unfoundTargets[Math.floor(Math.random() * unfoundTargets.length)];
        targetName = randomTarget.title;
        nextLevel = 0;
        const hintRadius = CONSTANTS.HINT_RADII[0];
        centerOffset = calculateRandomOffset(randomTarget.positions[0], hintRadius);
      }

      const newHintState: HintState = {
        target: targetName,
        level: nextLevel,
        centerOffset,
      };

      return {
        ...prev,
        showHint: true,
        hintTarget: targetName,
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

  // ランダムオフセットを計算（答えがヒント円内に収まる範囲で）
  // 答えの位置からmaxOffset以内のランダムな位置を返す
  function calculateRandomOffset(answerPos: [number, number], hintRadius: number): [number, number] {
    // 答えの判定半径を考慮して、ヒント円の中心をずらせる最大距離
    const maxOffset = Math.max(0, hintRadius - CONSTANTS.HIT_RADIUS);
    
    // ランダムな角度と距離
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * maxOffset;
    
    const offsetX = Math.cos(angle) * distance;
    const offsetY = Math.sin(angle) * distance;
    
    // 画面外にはみ出ないよう調整
    const margin = hintRadius;
    const newX = Math.max(margin, Math.min(CONSTANTS.SCALE - margin, answerPos[0] + offsetX));
    const newY = Math.max(margin, Math.min(CONSTANTS.SCALE - margin, answerPos[1] + offsetY));
    
    // オフセットとして返す（実際の中心位置 - 答えの位置）
    return [newX - answerPos[0], newY - answerPos[1]];
  }

  // ゲームをリセット
  const resetGame = useCallback(() => {
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
    }
    
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
