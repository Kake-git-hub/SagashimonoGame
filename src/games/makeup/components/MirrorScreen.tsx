import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { S } from '../strings';
import { MakeupSettings } from '../types';
import { CameraHandle } from '../hooks/useCamera';
import { useFaceTracker } from '../hooks/useFaceTracker';
import { LayerId, LookState, lookReducer } from '../logic/layers';
import { fetchPalettes, PaletteMap } from '../services/contentService';
import { canvasToBlob, shareOrDownload, stillFilename } from '../services/share';
import { StageSource, StageView } from './StageView';
import { GuideCanvas } from './GuideCanvas';
import { MakeupCanvas } from './MakeupCanvas';
import { MakeupPainter } from './makeupPainter';
import { SettingsSheet } from './SettingsSheet';
import { TryPanel } from './TryPanel';

type Mode = 'try' | 'guide' | 'suggest';

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

/**
 * ミラー画面: ヘッダー + 映像（鏡像）+ メイク描画 + ガイド描画 + 状態 + 下部パネル（ためす / おしえて / ていあん）
 */
export function MirrorScreen({ source, camera, settings, initialLook, debug, onLookChange, onSettingsChange, onPickPhoto, onUseCamera, onBack }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const painterRef = useRef<MakeupPainter | null>(null);
  const [frameSize, setFrameSize] = useState({ w: 1280, h: 720 });
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState<Mode>('try');
  const [part, setPart] = useState<LayerId>('lip');
  const [look, dispatch] = useReducer(lookReducer, initialLook);
  const [comparing, setComparing] = useState(false);
  const [palettes, setPalettes] = useState<PaletteMap | null>(null);
  const [paletteError, setPaletteError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const isPhoto = source.kind === 'photo';

  const handleFrameSize = useCallback((w: number, h: number) => {
    setFrameSize(prev => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, []);

  const getSource = useCallback(() => (isPhoto ? imageRef.current : videoRef.current), [isPhoto]);
  const tracker = useFaceTracker({ enabled: true, delegate: settings.delegate, getSource });
  const { loadState, status, stats } = tracker;

  // 色のパレット
  useEffect(() => {
    let cancelled = false;
    fetchPalettes()
      .then(p => { if (!cancelled) setPalettes(p); })
      .catch(err => { console.error('palettes', err); if (!cancelled) setPaletteError(true); });
    return () => { cancelled = true; };
  }, []);

  // 選んだ色は次回のために覚えておく
  useEffect(() => { onLookChange(look); }, [look, onLookChange]);

  // 自動テスト用: ?makeupdebug=1 のとき最新の結果を window に出す
  const latestRef = useRef({ status, loadState, stats, frameSize, look });
  latestRef.current = { status, loadState, stats, frameSize, look };
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
      get makeupDrawn() { return painterRef.current?.lastDrew ?? false; },
      applyLook(next: LookState) { dispatch({ type: 'replace', look: next }); },
    };
    return () => { delete w.__makeupDebug; };
  }, [debug, tracker]);

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

  const mirrored = settings.mirrored && !isPhoto;
  const faceVisible = loadState.phase === 'ready' && status !== 'none';

  // ほぞん: いま見えている絵を共有 / ダウンロード
  const handleSave = useCallback(async () => {
    const painter = painterRef.current;
    const src = getSource();
    if (!painter || !src || saving) return;
    setSaving(true);
    setSaveNote(null);
    try {
      const canvas = painter.capture(src, mirrored);
      const blob = await canvasToBlob(canvas);
      const result = await shareOrDownload(blob, stillFilename());
      if (result === 'shared') setSaveNote(S.try.shared);
      else if (result === 'downloaded') setSaveNote(S.try.saved);
    } catch (err) {
      console.error('save failed', err);
      setSaveNote(S.try.saveFailed);
    } finally {
      setSaving(false);
      window.setTimeout(() => setSaveNote(null), 3000);
    }
  }, [getSource, mirrored, saving]);

  return (
    <div className="mmm-screen">
      <header className="mmm-header">
        <button className="mmm-icon-button" onClick={onBack} aria-label={S.back} title={S.back}>←</button>
        <h1 className="mmm-title">💄 {S.title}</h1>
        <button className="mmm-icon-button" onClick={() => setShowSettings(true)} aria-label={S.mirror.settings} title={S.mirror.settings}>⚙️</button>
      </header>

      <div className="mmm-body">
        <StageView source={source} mirrored={mirrored} videoRef={videoRef} imageRef={imageRef} onFrameSize={handleFrameSize}>
          <MakeupCanvas
            tracker={tracker}
            look={look}
            hidden={comparing}
            width={frameSize.w}
            height={frameSize.h}
            getSource={getSource}
            painterRef={painterRef}
          />
          <GuideCanvas
            tracker={tracker}
            width={frameSize.w}
            height={frameSize.h}
            showLandmarks={settings.showLandmarks}
            showNumbers={debug && settings.showLandmarks}
            mirrored={mirrored}
          />
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
              {stats.fps} fps / {stats.inferenceMs} ms / {stats.delegate ?? '-'}{stats.skipping ? ` / ${S.mirror.skipping}` : ''}
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
              faceVisible={faceVisible}
              saving={saving}
              saveNote={saveNote}
              onPart={setPart}
              dispatch={dispatch}
              onCompare={setComparing}
              onSave={handleSave}
            />
          ) : (
            <div className="mmm-panel-placeholder">{S.modes[mode]}は {S.mirror.comingSoon}</div>
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
