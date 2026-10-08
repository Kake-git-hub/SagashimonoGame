import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage } from '../types';
import { ANIM } from '../constants';
import { useNejiGame } from '../hooks/useNejiGame';
import { useHudChoreography } from '../hooks/useHudChoreography';
import { Scene } from './Scene';
import { ScreenPoint } from './ScrewMesh';
import { BoxHud } from './BoxHud';
import { BufferHud } from './BufferHud';
import { FlyingScrewLayer } from './FlyingScrewLayer';
import { ResultOverlay } from './ResultOverlay';
import '../neji.css';

interface Props {
  stage: Stage;
  hasNextStage: boolean;
  onBack: () => void;
  onNextStage: () => void;
  onCleared: (stageId: string, moves: number) => void;
}

const DOUBLE_TAP_MS = 400;

export function NejiGameScreen({ stage, hasNextStage, onBack, onNextStage, onCleared }: Props) {
  const { state, tapScrew, screwRemoveDone, partFallDone, reset } = useNejiGame(stage);
  const [highlightActive, setHighlightActive] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [viewResetKey, setViewResetKey] = useState(0);
  const lastMissRef = useRef(0);
  const hudRef = useRef<HTMLDivElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const hud = useHudChoreography(state, hudRef);

  // 外せないネジをタップ → 邪魔している物をしばらく赤く光らせる
  useEffect(() => {
    if (!state.feedback) return;
    setHighlightActive(true);
    const timer = window.setTimeout(() => setHighlightActive(false), ANIM.BLOCKER_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [state.feedback]);

  // クリア / 失敗 → 演出が終わるのを待ってから結果画面
  useEffect(() => {
    if (state.status === 'playing') {
      setShowResult(false);
      return;
    }
    if (state.status === 'cleared') {
      onCleared(stage.id, state.moves);
    }
    const delay = ANIM.REMOVE_MS + ANIM.FLY_MS + ANIM.RESULT_DELAY_MS;
    const timer = window.setTimeout(() => setShowResult(true), delay);
    return () => window.clearTimeout(timer);
  }, [state.status, state.moves, stage.id, onCleared]);

  // 3D 上でネジが抜けきった: キャンバス内座標 → 画面座標にして飛ぶ演出へ
  const handleScrewRemoveDone = useCallback((id: string, at: ScreenPoint) => {
    const rect = canvasAreaRef.current?.getBoundingClientRect();
    hud.onScrewRemoved(id, { x: (rect?.left ?? 0) + at.x, y: (rect?.top ?? 0) + at.y });
    screwRemoveDone(id);
  }, [hud, screwRemoveDone]);

  const resetView = useCallback(() => setViewResetKey(k => k + 1), []);

  // 何もない所をすばやく 2 回タップ → 視点リセット
  const handlePointerMissed = useCallback(() => {
    const now = performance.now();
    if (now - lastMissRef.current < DOUBLE_TAP_MS) {
      lastMissRef.current = 0;
      resetView();
    } else {
      lastMissRef.current = now;
    }
  }, [resetView]);

  const handleRetry = useCallback(() => {
    setShowResult(false);
    reset();
  }, [reset]);

  const remaining = state.remainingScrews.size;
  const nextColor = stage.boxes[state.sort.nextBoxIndex] ?? null;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerSide}>
          <button onClick={onBack} style={styles.backButton} aria-label="いちらんへもどる">
            ←
          </button>
        </div>
        <h1 style={styles.title}>
          {stage.emoji ? `${stage.emoji} ` : ''}{stage.name}
        </h1>
        <div style={{ ...styles.headerSide, justifyContent: 'flex-end' }}>
          <span style={styles.remaining}>のこり {remaining}</span>
        </div>
      </header>

      <div className="neji-hud" ref={hudRef}>
        <BoxHud
          boxes={state.sort.boxes}
          capacity={stage.boxCapacity}
          nextColor={nextColor}
          hidden={hud.hidden}
          departing={hud.departing}
        />
        <BufferHud slots={state.sort.buffer} hidden={hud.hidden} />
      </div>

      <div style={styles.canvasArea} ref={canvasAreaRef}>
        <Scene
          stage={stage}
          remainingParts={state.remainingParts}
          remainingScrews={state.remainingScrews}
          removingScrews={state.removingScrews}
          fallingParts={state.fallingParts}
          feedback={state.feedback}
          highlightActive={highlightActive}
          viewResetKey={viewResetKey}
          onTapScrew={tapScrew}
          onScrewRemoveDone={handleScrewRemoveDone}
          onPartFallDone={partFallDone}
          onPointerMissed={handlePointerMissed}
        />
        <p style={styles.hint}>ドラッグでまわす・ネジをタップではずす</p>
        <button onClick={resetView} style={styles.viewResetButton} aria-label="むきをもどす" title="むきをもどす">
          ↺
        </button>
      </div>

      <FlyingScrewLayer flights={hud.flights} onDone={hud.onFlightDone} />

      {showResult && state.status !== 'playing' && (
        <ResultOverlay
          kind={state.status}
          stageName={stage.name}
          moves={state.moves}
          hasNext={hasNextStage}
          onNext={onNextStage}
          onRetry={handleRetry}
          onBack={onBack}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    backgroundColor: '#1a1a2e',
    overflow: 'hidden',
    WebkitUserSelect: 'none',
    userSelect: 'none',
    WebkitTouchCallout: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: '#16213e',
    color: 'white',
    flexShrink: 0,
  },
  headerSide: {
    flex: '0 0 90px',
    display: 'flex',
    alignItems: 'center',
  },
  backButton: {
    padding: '6px 12px',
    fontSize: '1.6rem',
    backgroundColor: 'transparent',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    lineHeight: 1,
  },
  title: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  remaining: {
    fontSize: '0.95rem',
    fontWeight: 'bold',
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: '4px 10px',
    borderRadius: '14px',
    whiteSpace: 'nowrap',
  },
  canvasArea: {
    flex: 1,
    position: 'relative',
    minHeight: 0,
    background: 'radial-gradient(circle at 50% 35%, #34446e 0%, #1a1a2e 70%)',
  },
  hint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '12px',
    margin: 0,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.55)',
    fontSize: '0.85rem',
    pointerEvents: 'none',
  },
  viewResetButton: {
    position: 'absolute',
    right: '12px',
    bottom: '12px',
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'rgba(255,255,255,0.15)',
    color: 'white',
    fontSize: '1.5rem',
    cursor: 'pointer',
  },
};
