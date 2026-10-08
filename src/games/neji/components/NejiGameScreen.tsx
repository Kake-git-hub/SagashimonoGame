import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Stage } from '../types';
import { ANIM } from '../constants';
import { useNejiGame } from '../hooks/useNejiGame';
import { useHudChoreography } from '../hooks/useHudChoreography';
import { hasQueuedBox } from '../logic/rules';
import { REWIND_MOVES } from '../logic/gameReducer';
import { Scene, ViewInsets } from './Scene';
import { ScreenPoint } from './ScrewMesh';
import { BoxHud } from './BoxHud';
import { BufferHud } from './BufferHud';
import { FlyingScrewLayer } from './FlyingScrewLayer';
import { ResultOverlay, TreasureResult } from './ResultOverlay';
import { useIsLandscape } from '../../../hooks/useMediaQuery';
import { QuizGate } from '../../../hooks/useQuizGate';
import { getAppSettings } from '../../../services/appSettingsService';
import '../neji.css';

interface Props {
  stage: Stage;
  hasNextStage: boolean;
  quiz: QuizGate;
  onBack: () => void;
  onNextStage: () => void;
  // クリアを記録する。たからものがあれば結果画面に出す情報を返す
  onCleared: (stageId: string, moves: number) => TreasureResult | null;
}

const DOUBLE_TAP_MS = 400;
const ZERO_INSETS: ViewInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export function NejiGameScreen({ stage, hasNextStage, quiz, onBack, onNextStage, onCleared }: Props) {
  const { state, tapScrew, screwRemoveDone, partFallDone, reset, addBox, addBuffer, rewind } = useNejiGame(stage);
  const [highlightActive, setHighlightActive] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [treasure, setTreasure] = useState<TreasureResult | null>(null);
  const [viewResetKey, setViewResetKey] = useState(0);
  const [insets, setInsets] = useState<ViewInsets>(ZERO_INSETS);
  const lastMissRef = useRef(0);
  const screenRef = useRef<HTMLDivElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const boxesRef = useRef<HTMLDivElement>(null);
  const bufferRef = useRef<HTMLDivElement>(null);
  const isLandscape = useIsLandscape();
  const hud = useHudChoreography(state, screenRef);
  const settings = getAppSettings();

  // HUD が重なる領域を測って、3D 図形がその内側に収まるようにする
  useLayoutEffect(() => {
    const measure = () => {
      const area = canvasAreaRef.current?.getBoundingClientRect();
      if (!area) return;
      const header = headerRef.current?.getBoundingClientRect();
      const boxes = boxesRef.current?.getBoundingClientRect();
      const buffer = bufferRef.current?.getBoundingClientRect();
      const next: ViewInsets = isLandscape
        ? {
            top: header ? Math.max(0, header.bottom - area.top) : 0,
            bottom: 0,
            left: boxes ? Math.max(0, boxes.right - area.left) : 0,
            right: buffer ? Math.max(0, area.right - buffer.left) : 0,
          }
        : {
            top: boxes ? Math.max(0, boxes.bottom - area.top) : header ? Math.max(0, header.bottom - area.top) : 0,
            bottom: buffer ? Math.max(0, area.bottom - buffer.top) : 0,
            left: 0,
            right: 0,
          };
      setInsets(prev =>
        prev.top === next.top && prev.bottom === next.bottom && prev.left === next.left && prev.right === next.right
          ? prev
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const el of [canvasAreaRef.current, headerRef.current, boxesRef.current, bufferRef.current]) {
      if (el) observer.observe(el);
    }
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [isLandscape, state.sort.boxes.length, state.sort.buffer.length]);

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
      setTreasure(onCleared(stage.id, state.moves));
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

  // --- おたすけ（クイズに正解すると使える） ---
  const canAddBox =
    state.status === 'playing' && hasQueuedBox(stage, state.sort) && state.extraBoxes < settings.nejiMaxExtraBoxes;
  const canAddBuffer = state.status === 'playing' && state.extraBuffer < settings.nejiMaxExtraBuffer;
  const canContinue = state.status === 'failed' && state.history.length > 0;

  const handleAddBox = useCallback(async () => {
    if (await quiz.ask('addBox')) addBox();
  }, [quiz, addBox]);

  const handleAddBuffer = useCallback(async () => {
    if (await quiz.ask('addBuffer')) addBuffer();
  }, [quiz, addBuffer]);

  const handleContinue = useCallback(async () => {
    if (await quiz.ask('continue')) {
      setShowResult(false);
      rewind(REWIND_MOVES);
    }
  }, [quiz, rewind]);

  const quizMark = (trigger: Parameters<QuizGate['isQuizRequired']>[0]) => (quiz.isQuizRequired(trigger) ? '✏️' : '');
  const remaining = state.remainingScrews.size;

  return (
    <div className="neji-screen" ref={screenRef}>
      <div className="neji-canvas" ref={canvasAreaRef}>
        <Scene
          stage={stage}
          remainingParts={state.remainingParts}
          remainingScrews={state.remainingScrews}
          removingScrews={state.removingScrews}
          fallingParts={state.fallingParts}
          feedback={state.feedback}
          highlightActive={highlightActive}
          viewResetKey={viewResetKey}
          insets={insets}
          onTapScrew={tapScrew}
          onScrewRemoveDone={handleScrewRemoveDone}
          onPartFallDone={partFallDone}
          onPointerMissed={handlePointerMissed}
        />
      </div>

      <header className="neji-header" ref={headerRef}>
        <div className="neji-header-side">
          <button onClick={onBack} className="neji-icon-button" aria-label="いちらんへもどる">
            ←
          </button>
        </div>
        <h1 className="neji-title">
          {stage.emoji ? `${stage.emoji} ` : ''}{stage.name}
        </h1>
        <div className="neji-header-side">
          <span className="neji-remaining">のこり {remaining}</span>
          <button onClick={resetView} className="neji-icon-button" aria-label="むきをもどす" title="むきをもどす">
            ↺
          </button>
        </div>
      </header>

      <div className="neji-hud-boxes" ref={boxesRef}>
        <BoxHud
          boxes={state.sort.boxes}
          capacity={stage.boxCapacity}
          hidden={hud.hidden}
          departing={hud.departing}
          onAddBox={canAddBox ? handleAddBox : null}
          addBoxLabel={`${quizMark('addBox')}＋はこ`}
        />
      </div>

      <div className="neji-hud-buffer" ref={bufferRef}>
        <BufferHud
          slots={state.sort.buffer}
          hidden={hud.hidden}
          onAddSlot={canAddBuffer ? handleAddBuffer : null}
          addSlotLabel={`${quizMark('addBuffer')}＋おきば`}
        />
      </div>

      {state.moves === 0 && <p className="neji-hint">まわして さがそう。したにも ネジがあるよ</p>}

      <FlyingScrewLayer flights={hud.flights} onDone={hud.onFlightDone} />

      {showResult && state.status !== 'playing' && (
        <ResultOverlay
          kind={state.status}
          stageName={stage.name}
          moves={state.moves}
          hasNext={hasNextStage}
          treasure={treasure}
          canContinue={canContinue}
          continueLabel={`${quizMark('continue')} つづきから（${REWIND_MOVES} てまえ）`}
          nextLabel={`${quizMark('nextStage')} つぎのステージへ →`}
          onNext={onNextStage}
          onContinue={handleContinue}
          onRetry={handleRetry}
          onBack={onBack}
        />
      )}
    </div>
  );
}
