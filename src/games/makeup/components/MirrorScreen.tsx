import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { S } from '../strings';
import { MakeupSettings } from '../types';
import { CameraHandle } from '../hooks/useCamera';
import { useFaceTracker } from '../hooks/useFaceTracker';
import { StageSource, StageView } from './StageView';
import { GuideCanvas } from './GuideCanvas';
import { SettingsSheet } from './SettingsSheet';

interface Props {
  source: StageSource;
  camera: CameraHandle;
  settings: MakeupSettings;
  debug: boolean;
  onSettingsChange: (next: MakeupSettings) => void;
  onPickPhoto: () => void;
  onUseCamera: () => void;
  onBack: () => void;
}

/**
 * ミラー画面: ヘッダー + 映像（鏡像）+ 顔認識の重ね描き + 状態 + 下部パネル
 */
export function MirrorScreen({ source, camera, settings, debug, onSettingsChange, onPickPhoto, onUseCamera, onBack }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [frameSize, setFrameSize] = useState({ w: 1280, h: 720 });
  const [showSettings, setShowSettings] = useState(false);
  const isPhoto = source.kind === 'photo';

  const handleFrameSize = useCallback((w: number, h: number) => {
    setFrameSize(prev => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, []);

  const getSource = useCallback(() => (isPhoto ? imageRef.current : videoRef.current), [isPhoto]);
  const tracker = useFaceTracker({ enabled: true, delegate: settings.delegate, getSource });
  const { loadState, status, stats } = tracker;

  // 自動テスト用: ?makeupdebug=1 のとき最新の結果を window に出す
  const latestRef = useRef({ status, loadState, stats, frameSize });
  latestRef.current = { status, loadState, stats, frameSize };
  useEffect(() => {
    if (!debug) return;
    const w = window as unknown as { __makeupDebug?: unknown };
    w.__makeupDebug = {
      get frame() { return tracker.frameRef.current; },
      get status() { return latestRef.current.status; },
      get loadState() { return latestRef.current.loadState; },
      get stats() { return latestRef.current.stats; },
      get frameSize() { return latestRef.current.frameSize; },
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

  return (
    <div className="mmm-screen">
      <header className="mmm-header">
        <button className="mmm-icon-button" onClick={onBack} aria-label={S.back} title={S.back}>←</button>
        <h1 className="mmm-title">💄 {S.title}</h1>
        <button className="mmm-icon-button" onClick={() => setShowSettings(true)} aria-label={S.mirror.settings} title={S.mirror.settings}>⚙️</button>
      </header>

      <div className="mmm-body">
        <StageView source={source} mirrored={mirrored} videoRef={videoRef} imageRef={imageRef} onFrameSize={handleFrameSize}>
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
          <p className="mmm-panel-note">{S.mirror.comingSoon}</p>
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
