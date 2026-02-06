import { useState, useCallback, useEffect, useRef } from 'react';
import { Puzzle, GameState, CONSTANTS, Progress, HintState, makePositionKey, getTotalPositionCount, getHintRadius, normalizePosition, getHitRadius, Position, isPolygonPosition, isPointInPolygon, CirclePosition, getPolygonCenter } from '../types';
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

        const pos = normalizePosition(target.positions[i] as Position | [number, number]);
        
        // ポリゴンの場合はポリゴン内判定
        if (isPolygonPosition(pos)) {
          if (isPointInPolygon(clickX, clickY, pos)) {
            return posKey;
          }
        } else {
          // 円形の場合は距離判定
          const circlePos = pos as CirclePosition;
          const hitRadius = getHitRadius(circlePos.size);
          const distance = Math.hypot(clickX - circlePos.x, clickY - circlePos.y);
          if (distance < hitRadius) {
            return posKey;
          }
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

  // 特定のターゲットのヒントを表示
  const showHintForTarget = useCallback((targetTitle: string) => {
    // 前のタイマーをクリア
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
    }

    setState(prev => {
      if (!prev.puzzle) return prev;

      // 指定されたターゲットの未発見の位置を取得
      const target = prev.puzzle.targets.find(t => t.title === targetTitle);
      if (!target) return prev;

      const unfoundPositions: { positionIndex: number; position: Position }[] = [];
      for (let i = 0; i < target.positions.length; i++) {
        const posKey = makePositionKey(target.title, i);
        if (!prev.foundPositions.has(posKey)) {
          const pos = normalizePosition(target.positions[i] as Position | [number, number]);
          unfoundPositions.push({ positionIndex: i, position: pos });
        }
      }

      // このターゲットがすべて発見済みなら何もしない
      if (unfoundPositions.length === 0) return prev;

      // 最初の未発見位置を選択
      const selected = unfoundPositions[0];
      
      // 同じターゲット・位置への連打か判定（hintStateが残っていれば継続）
      let nextLevel = 0;
      let centerOffset: [number, number];

      if (prev.hintState && 
          prev.hintState.target === targetTitle && 
          prev.hintState.positionIndex === selected.positionIndex) {
        // 同じ位置でレベルアップ
        nextLevel = prev.hintState.level + 1;
        const hintRadius = getHintRadius(nextLevel);
        centerOffset = calculateRandomOffset(selected.position, hintRadius);
      } else {
        // 新しいターゲットまたは位置
        nextLevel = 0;
        const hintRadius = getHintRadius(0);
        centerOffset = calculateRandomOffset(selected.position, hintRadius);
      }

      const newHintState: HintState = {
        target: targetTitle,
        positionIndex: selected.positionIndex,
        level: nextLevel,
        centerOffset,
      };

      return {
        ...prev,
        showHint: true,
        hintTarget: targetTitle,
        hintState: newHintState,
      };
    });

    // 一定時間後にヒントを非表示（hintStateは保持してレベルを引き継ぐ）
    hintTimerRef.current = window.setTimeout(() => {
      setState(prev => ({
        ...prev,
        showHint: false,
        hintTarget: null,
        // hintStateは保持（次のヒントでレベルを引き継ぐため）
      }));
    }, CONSTANTS.HINT_DURATION);
  }, []);

  // ランダムオフセットを計算
  function calculateRandomOffset(answerPos: Position, hintRadius: number): [number, number] {
    // ポリゴンの場合は中心点を使用
    let centerX: number, centerY: number, hitRadius: number;
    if (isPolygonPosition(answerPos)) {
      const center = getPolygonCenter(answerPos);
      centerX = center.x;
      centerY = center.y;
      hitRadius = 32; // ポリゴンのデフォルト判定半径
    } else {
      const circlePos = answerPos as CirclePosition;
      centerX = circlePos.x;
      centerY = circlePos.y;
      hitRadius = getHitRadius(circlePos.size);
    }
    
    const maxOffset = Math.max(0, hintRadius - hitRadius);
    
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * maxOffset;
    
    const offsetX = Math.cos(angle) * distance;
    const offsetY = Math.sin(angle) * distance;
    
    const margin = hintRadius;
    const newX = Math.max(margin, Math.min(CONSTANTS.SCALE - margin, centerX + offsetX));
    const newY = Math.max(margin, Math.min(CONSTANTS.SCALE - margin, centerY + offsetY));
    
    return [newX - centerX, newY - centerY];
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
    showHintForTarget,
    resetGame,
  };
}
