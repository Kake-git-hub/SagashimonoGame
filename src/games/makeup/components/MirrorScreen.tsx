import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { S } from '../strings';
import { MakeupSettings } from '../types';
import { CameraHandle } from '../hooks/useCamera';
import { useFaceTracker } from '../hooks/useFaceTracker';
import { useAutoPan } from '../hooks/useAutoPan';
import { LAYER_REGIONS, LayerId, LookState, lookReducer } from '../logic/layers';
import { BrushSize } from '../logic/brush';
import { clientToFrame, frameToClient } from '../logic/viewport';
import { Recipe, recipeLook, RecipeSummary } from '../logic/guide';
import { suggest, Suggestion } from '../logic/suggest';
import { sampleSkin } from './skinSample';
import { usePoseCheck } from '../hooks/usePoseCheck';
import { fetchPalettes, fetchRecipe, fetchRecipeIndex, PaletteMap } from '../services/contentService';
import { canvasToBlob, shareOrDownload, stillFilename } from '../services/share';
import { StageSource, StageView } from './StageView';
import { GuideCanvas } from './GuideCanvas';
import { MakeupCanvas, MakeupView } from './MakeupCanvas';
import { FacePaint, PaintSnapshot } from './facePaint';
import { PaintSurface, PaintTool } from './PaintSurface';
import { SettingsSheet } from './SettingsSheet';
import { TryPanel } from './TryPanel';
import { GuidePanel } from './GuidePanel';
import { SuggestPanel } from './SuggestPanel';

type Mode = 'try' | 'guide' | 'suggest';

// 画面の大きさ・表示モード・ブラウザ（実機で不具合を切り分けるとき用）
function describeEnvironment(): string {
  if (typeof window === 'undefined') return '';
  const standalone = window.matchMedia('(display-mode: standalone)').matches ? 'PWA' : 'ブラウザ';
  const m = navigator.userAgent.match(/(SamsungBrowser|EdgA|OPR|Firefox|FxiOS|CriOS|Chrome|Version)\/(\d+)/);
  const browser = m ? `${m[1] === 'Version' ? 'Safari' : m[1]} ${m[2]}` : '?';
  const dvh = typeof CSS !== 'undefined' && CSS.supports?.('height', '100dvh') ? '' : ' / dvh なし';
  return `${window.innerWidth}×${window.innerHeight} / ${standalone} / ${browser}${dvh}`;
}

interface Props {
  source: StageSource;
  camera: CameraHandle;
  settings: MakeupSettings;
  initialLook: LookState;
  debug: boolean;
  onLookChange: (look: LookState) => void;
  onSettingsChange: (next: MakeupSettings) => void;
  onPickPhoto: () => void;
  onUseCamera: () => void;
  onBack: () => void;
}

// 「ここに ぬれるよ」の点線を出しておく時間（ms）: パーツを選んだあと / なぞり終わったあと
const OUTLINE_AFTER_SELECT_MS = 3500;
const OUTLINE_AFTER_STROKE_MS = 1200;
// 一時的な文言（ほぞんしたよ / かおの うえを なぞってね）を出しておく時間（ms）
const NOTE_MS = 3000;

/**
 * ミラー画面: ヘッダー + 映像（鏡像）+ メイク描画 + ガイド描画 + 状態 + 下部パネル（ためす / おしえて / ていあん）
 * ためす では、パレットで色を選び、映像の顔を指でなぞった所にメイクが付く
 */
export function MirrorScreen({ source, camera, settings, initialLook, debug, onLookChange, onSettingsChange, onPickPhoto, onUseCamera, onBack }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<MakeupView | null>(null);
  // 塗った絵（React の state ではなく canvas で持つ。なぞるたびに再描画しないため）
  const paint = useMemo(() => new FacePaint(), []);
  const [painted, setPainted] = useState<LayerId[]>([]);
  const [erasing, setErasing] = useState(false);
  const [brushSize, setBrushSize] = useState<BrushSize>('m');
  const [outlineOn, setOutlineOn] = useState(false);
  const outlineTimer = useRef(0);
  const noteTimer = useRef(0);
  const [frameSize, setFrameSize] = useState({ w: 960, h: 720 });
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState<Mode>('try');
  const [part, setPart] = useState<LayerId>('lip');
  const [look, dispatch] = useReducer(lookReducer, initialLook);
  const [comparing, setComparing] = useState(false);
  const [palettes, setPalettes] = useState<PaletteMap | null>(null);
  const [paletteError, setPaletteError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // おしえて
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  const [recipesError, setRecipesError] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [resultShown, setResultShown] = useState(false);
  const lookBackupRef = useRef<{ look: LookState; paint: PaintSnapshot } | null>(null);
  // ていあん
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const isPhoto = source.kind === 'photo';

  const handleFrameSize = useCallback((w: number, h: number) => {
    setFrameSize(prev => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, []);

  // 塗ってあるパーツの一覧（タブの印と、くらべる / ぜんぶ けす が押せるかに使う）
  useEffect(() => {
    setPainted(paint.paintedLayers());
    return paint.subscribe(() => setPainted(paint.paintedLayers()));
  }, [paint]);
  useEffect(() => () => {
    window.clearTimeout(outlineTimer.current);
    window.clearTimeout(noteTimer.current);
    paint.dispose();
  }, [paint]);

  const showNote = useCallback((text: string) => {
    setNote(text);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), NOTE_MS);
  }, []);

  // 「ここに ぬれるよ」の点線をしばらく出す
  const flashOutline = useCallback((ms: number) => {
    setOutlineOn(true);
    window.clearTimeout(outlineTimer.current);
    outlineTimer.current = window.setTimeout(() => setOutlineOn(false), ms);
  }, []);

  const dropBackup = useCallback(() => {
    // 取っておいた写しの canvas のメモリを返す
    lookBackupRef.current?.paint.forEach(canvas => { canvas.width = 0; canvas.height = 0; });
    lookBackupRef.current = null;
  }, []);

  const getSource = useCallback(() => (isPhoto ? imageRef.current : videoRef.current), [isPhoto]);
  const tracker = useFaceTracker({ enabled: true, delegate: settings.delegate, getSource });
  const { loadState, status, stats } = tracker;
  // 枠からはみ出した映像のうち、顔のある側を見せる
  const panRef = useAutoPan(tracker, stageRef, frameSize.w, frameSize.h);

  // 色のパレット
  useEffect(() => {
    let cancelled = false;
    fetchPalettes()
      .then(p => { if (!cancelled) setPalettes(p); })
      .catch(err => { console.error('palettes', err); if (!cancelled) setPaletteError(true); });
    return () => { cancelled = true; };
  }, []);

  // てじゅんの一覧
  useEffect(() => {
    let cancelled = false;
    fetchRecipeIndex()
      .then(list => { if (!cancelled) setRecipes(list); })
      .catch(err => { console.error('recipes', err); if (!cancelled) setRecipesError(true); });
    return () => { cancelled = true; };
  }, []);

  const handleSelectRecipe = useCallback(async (id: string) => {
    setLoadingRecipe(true);
    try {
      const loaded = await fetchRecipe(id);
      setRecipe(loaded);
      setStepIndex(0);
      setResultShown(false);
    } catch (err) {
      console.error('recipe', err);
      setRecipesError(true);
    } finally {
      setLoadingRecipe(false);
    }
  }, []);

  const handleStep = useCallback((delta: number) => {
    setStepIndex(i => Math.max(0, Math.min((recipe?.steps.length ?? 0), i + delta)));
  }, [recipe]);

  const handleRestart = useCallback(() => { setStepIndex(0); }, []);

  // できあがりを みる: レシピの色を、パーツの型どおりに自動で塗る。もどす で、塗ってあったものに戻す
  const handleToggleResult = useCallback(() => {
    if (!recipe) return;
    if (resultShown) {
      const backup = lookBackupRef.current;
      dispatch({ type: 'replace', look: backup?.look ?? {} });
      if (backup) paint.restore(backup.paint);
      else paint.clearAll();
      lookBackupRef.current = null;
      setResultShown(false);
    } else {
      dropBackup();
      lookBackupRef.current = { look, paint: paint.snapshot() };
      const next = recipeLook(recipe);
      dispatch({ type: 'replace', look: next });
      paint.fillLook(next);
      setResultShown(true);
    }
  }, [recipe, resultShown, look, paint, dropBackup]);

  const handleLeaveRecipe = useCallback(() => {
    setRecipe(null);
    setStepIndex(0);
    setResultShown(false);
    dropBackup();
  }, [dropBackup]);

  // しんだん: いまの顔の点と頬の色から
  const handleDiagnose = useCallback(() => {
    const frame = tracker.frameRef.current;
    const src = getSource();
    if (!frame || !src) return;
    const skin = sampleSkin(src, frame, frameSize.w, frameSize.h);
    setSuggestion(suggest(frame.landmarks, frameSize.w, frameSize.h, skin));
  }, [tracker, getSource, frameSize]);

  const handleOpenRecipe = useCallback((id: string) => {
    setMode('guide');
    handleSelectRecipe(id);
  }, [handleSelectRecipe]);

  // この いろで ためす: ていあん の色を、パーツの型どおりに自動で塗る
  const handleApplySuggestedLook = useCallback((next: LookState) => {
    dispatch({ type: 'replace', look: next });
    paint.fillLook(next);
    setResultShown(false);
    dropBackup();
    setMode('try');
  }, [paint, dropBackup]);

  // --- ためす: なぞって塗る ---
  const assist = settings.paintAssist;
  // いまの筆の色: 選んであればその色、まだなら そのパーツの最初の色
  const toolColor = look[part]?.color ?? palettes?.[part]?.[0]?.color ?? null;
  const tool = useMemo<PaintTool>(() => ({ layer: part, color: toolColor, erasing, size: brushSize, assist }), [part, toolColor, erasing, brushSize, assist]);

  // 「はみださない」の型は最初に使うときに作る（少し時間がかかる）ので、パーツを選んだ時点で作っておき、
  // 最初のひと塗りで引っかからないようにする
  useEffect(() => {
    if (!assist || mode !== 'try') return;
    const timer = window.setTimeout(() => paint.mask(part), 150);
    return () => window.clearTimeout(timer);
  }, [paint, part, assist, mode]);

  const handlePart = useCallback((next: LayerId) => {
    setPart(next);
    setErasing(false);
    flashOutline(OUTLINE_AFTER_SELECT_MS);
  }, [flashOutline]);

  const handleAssist = useCallback((next: boolean) => {
    onSettingsChange({ ...settings, paintAssist: next });
    if (next) flashOutline(OUTLINE_AFTER_SELECT_MS);
  }, [settings, onSettingsChange, flashOutline]);

  const handleStrokeStart = useCallback(() => {
    // なぞっている間は点線を出したままにする
    window.clearTimeout(outlineTimer.current);
    setOutlineOn(true);
    // 塗り始めたら「できあがり」の表示ではなくなる（もどす で消えないように）
    setResultShown(false);
    dropBackup();
  }, [dropBackup]);

  const handleStrokeEnd = useCallback((hit: boolean) => {
    flashOutline(OUTLINE_AFTER_STROKE_MS);
    if (!hit) showNote(tracker.frameRef.current ? S.try.missHint : S.try.needFace);
  }, [flashOutline, showNote, tracker]);

  const handleClearAll = useCallback(() => {
    paint.clearAll();
    setResultShown(false);
    dropBackup();
  }, [paint, dropBackup]);

  const currentStep = mode === 'guide' && recipe && stepIndex < recipe.steps.length ? recipe.steps[stepIndex] : null;
  const poseOk = usePoseCheck(tracker, currentStep?.pose);

  // 選んだ色は次回のために覚えておく
  useEffect(() => { onLookChange(look); }, [look, onLookChange]);

  // 自動テスト用: ?makeupdebug=1 のとき最新の結果を window に出す
  const mirrored = settings.mirrored && !isPhoto;
  // ためす で「はみださない」のとき、選んだパーツの塗れる所を点線で見せる
  const paintOutline = mode === 'try' && assist && !erasing && outlineOn ? LAYER_REGIONS[part] : null;
  const latestRef = useRef({ status, loadState, stats, frameSize, look, currentStep, poseOk, suggestion, mode, mirrored, paintOutline });
  latestRef.current = { status, loadState, stats, frameSize, look, currentStep, poseOk, suggestion, mode, mirrored, paintOutline };
  useEffect(() => {
    if (!debug) return;
    const w = window as unknown as { __makeupDebug?: unknown };
    w.__makeupDebug = {
      get frame() { return tracker.frameRef.current; },
      get status() { return latestRef.current.status; },
      get loadState() { return latestRef.current.loadState; },
      get stats() { return latestRef.current.stats; },
      get frameSize() { return latestRef.current.frameSize; },
      get look() { return latestRef.current.look; },
      get makeupDrawn() { return viewRef.current?.lastDrew ?? false; },
      get painted() { return paint.paintedLayers(); },
      get outline() { return latestRef.current.paintOutline; },
      get pan() { return panRef.current; },
      // 顔の点（番号）が画面のどこにあるか（自動テストが顔の上をなぞるのに使う）
      facePoint(index: number) {
        const frame = tracker.frameRef.current;
        const el = stageRef.current;
        if (!frame || !el) return null;
        const { frameSize, mirrored } = latestRef.current;
        const p = frame.landmarks[index];
        return frameToClient(el.getBoundingClientRect(), frameSize.w, frameSize.h, mirrored, p.x, p.y, panRef.current);
      },
      get guideStep() { return latestRef.current.currentStep?.id ?? null; },
      get poseOk() { return latestRef.current.poseOk; },
      get suggestion() { return latestRef.current.suggestion; },
      get mode() { return latestRef.current.mode; },
      // 画面のその位置のあたりに、いま見えている色（映像 + メイク）。自動テストが「なぞった所に色が付いたか」を確かめるのに使う
      pixelAt(clientX: number, clientY: number) {
        const el = stageRef.current;
        const canvas = viewRef.current?.capture(false);
        if (!el || !canvas) return null;
        const { frameSize, mirrored } = latestRef.current;
        const p = clientToFrame(el.getBoundingClientRect(), frameSize.w, frameSize.h, mirrored, clientX, clientY, panRef.current);
        // 顔の点は 1px ほど揺れるので、まわり 7×7 の平均にする
        const N = 7;
        const d = canvas.getContext('2d')?.getImageData(Math.round(p.x * canvas.width) - 3, Math.round(p.y * canvas.height) - 3, N, N).data;
        canvas.width = 0;
        canvas.height = 0;
        if (!d) return null;
        const sum = [0, 0, 0];
        for (let i = 0; i < d.length; i += 4) { sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; }
        return sum.map(v => Math.round(v / (N * N)));
      },
      applyLook(next: LookState) {
        dispatch({ type: 'replace', look: next });
        paint.fillLook(next);
      },
    };
    return () => { delete w.__makeupDebug; };
  }, [debug, tracker, paint, panRef]);

  // 状態欄の文言
  const statusText = useMemo(() => {
    if (loadState.phase === 'downloading') {
      const pct = loadState.total > 0 ? Math.min(99, Math.round((loadState.loaded / loadState.total) * 100)) : 0;
      return `${S.loading.downloading} ${pct}%`;
    }
    if (loadState.phase === 'starting' || loadState.phase === 'idle') return S.loading.starting;
    if (loadState.phase === 'error') return S.loading.error;
    if (!isPhoto && camera.status !== 'running') {
      return camera.status === 'error' ? `${S.camera.errorTitle} ${S.camera[camera.error ?? 'unknown']}` : S.camera.interrupted;
    }
    return S.face[status];
  }, [loadState, isPhoto, camera.status, camera.error, status]);
  const statusKind = loadState.phase === 'error' || (!isPhoto && camera.status === 'error') ? 'error' : loadState.phase !== 'ready' ? 'loading' : status;

  const faceVisible = loadState.phase === 'ready' && status !== 'none';

  // 顔が見えるようになったら、「ここに ぬれるよ」の点線を出して、なぞる場所を知らせる
  useEffect(() => {
    if (faceVisible) flashOutline(OUTLINE_AFTER_SELECT_MS);
  }, [faceVisible, flashOutline]);

  // 実機での切り分け用（はやさを みせる のときだけ表示）: 画面の大きさ・表示モード・ブラウザ
  const envInfo = settings.showStats ? describeEnvironment() : '';

  // ほぞん: いま見えている絵を共有 / ダウンロード
  const handleSave = useCallback(async () => {
    const view = viewRef.current;
    if (!view || saving) return;
    setSaving(true);
    setNote(null);
    try {
      const canvas = view.capture(mirrored);
      if (!canvas) throw new Error('nothing to capture');
      const blob = await canvasToBlob(canvas);
      // 写しはもう要らないのでメモリを返す
      canvas.width = 0;
      canvas.height = 0;
      const result = await shareOrDownload(blob, stillFilename());
      if (result === 'shared') showNote(S.try.shared);
      else if (result === 'downloaded') showNote(S.try.saved);
    } catch (err) {
      console.error('save failed', err);
      showNote(S.try.saveFailed);
    } finally {
      setSaving(false);
    }
  }, [mirrored, saving, showNote]);

  return (
    <div className="mmm-screen">
      <header className="mmm-header">
        <button className="mmm-icon-button" onClick={onBack} aria-label={S.back} title={S.back}>←</button>
        <h1 className="mmm-title">💄 {S.title}</h1>
        <button className="mmm-icon-button" onClick={() => setShowSettings(true)} aria-label={S.mirror.settings} title={S.mirror.settings}>⚙️</button>
      </header>

      <div className="mmm-body">
        <StageView source={source} mirrored={mirrored} videoRef={videoRef} imageRef={imageRef} stageRef={stageRef} onFrameSize={handleFrameSize}>
          <MakeupCanvas
            tracker={tracker}
            paint={paint}
            look={look}
            hidden={comparing}
            width={frameSize.w}
            height={frameSize.h}
            getSource={getSource}
            viewRef={viewRef}
          />
          <GuideCanvas
            tracker={tracker}
            width={frameSize.w}
            height={frameSize.h}
            showLandmarks={settings.showLandmarks}
            showNumbers={debug && settings.showLandmarks}
            mirrored={mirrored}
            step={currentStep}
            opacity={settings.guideOpacity}
            outline={paintOutline}
          />
          {mode === 'try' && (
            <PaintSurface
              tracker={tracker}
              paint={paint}
              tool={tool}
              mirrored={mirrored}
              frameWidth={frameSize.w}
              frameHeight={frameSize.h}
              panRef={panRef}
              onStrokeStart={handleStrokeStart}
              onStrokeEnd={handleStrokeEnd}
            />
          )}
          <div className="mmm-status" role="status" data-status={statusKind} data-face={loadState.phase === 'ready' ? status : 'loading'}>
            {statusText}
          </div>
          {loadState.phase === 'downloading' && (
            <div className="mmm-loading" aria-hidden="true">
              <div className="mmm-progress">
                <div className="mmm-progress-bar" style={{ width: `${loadState.total > 0 ? Math.min(100, (loadState.loaded / loadState.total) * 100) : 0}%` }} />
              </div>
            </div>
          )}
          {loadState.phase === 'error' && (
            <div className="mmm-loading">
              <button className="mmm-secondary-button" onClick={tracker.reload}>{S.loading.retry}</button>
            </div>
          )}
          {settings.showStats && (
            <div className="mmm-stats">
              {stats.fps} fps / {stats.inferenceMs} ms / {stats.delegate ?? '-'}{stats.skipping ? ` / ${S.mirror.skipping}` : ''}{stats.padded ? ` / ${S.mirror.padded}` : ''}
              <br />{frameSize.w}×{frameSize.h} / {envInfo}
            </div>
          )}
        </StageView>

        <div className="mmm-panel">
          <div className="mmm-modes" role="tablist">
            {(['try', 'guide', 'suggest'] as Mode[]).map(m => (
              <button key={m} role="tab" aria-selected={mode === m} className="mmm-mode" onClick={() => setMode(m)}>
                {S.modes[m]}
              </button>
            ))}
          </div>

          {mode === 'try' ? (
            <TryPanel
              palettes={palettes}
              paletteError={paletteError}
              look={look}
              part={part}
              color={toolColor}
              painted={painted}
              erasing={erasing}
              brushSize={brushSize}
              assist={assist}
              faceVisible={faceVisible}
              saving={saving}
              note={note}
              onPart={handlePart}
              onErasing={setErasing}
              onBrushSize={setBrushSize}
              onAssist={handleAssist}
              dispatch={dispatch}
              onCompare={setComparing}
              onClearAll={handleClearAll}
              onSave={handleSave}
            />
          ) : mode === 'guide' ? (
            <GuidePanel
              recipes={recipes}
              recipesError={recipesError}
              recipe={recipe}
              loadingRecipe={loadingRecipe}
              stepIndex={stepIndex}
              poseOk={poseOk}
              faceVisible={faceVisible}
              resultShown={resultShown}
              onSelectRecipe={handleSelectRecipe}
              onStep={handleStep}
              onRestart={handleRestart}
              onLeaveRecipe={handleLeaveRecipe}
              onToggleResult={handleToggleResult}
            />
          ) : (
            <SuggestPanel
              suggestion={suggestion}
              faceVisible={faceVisible}
              recipes={recipes}
              onDiagnose={handleDiagnose}
              onOpenRecipe={handleOpenRecipe}
              onApplyLook={handleApplySuggestedLook}
            />
          )}

          <div className="mmm-panel-row">
            {isPhoto ? (
              <>
                <button className="mmm-chip-button" onClick={onPickPhoto}>🖼️ {S.photo.change}</button>
                <button className="mmm-chip-button" onClick={onUseCamera}>📷 {S.photo.useCamera}</button>
              </>
            ) : (
              <button className="mmm-chip-button" onClick={onPickPhoto}>🖼️ {S.photo.pick}</button>
            )}
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsSheet
          settings={settings}
          stats={stats}
          isPhoto={isPhoto}
          onChange={onSettingsChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
