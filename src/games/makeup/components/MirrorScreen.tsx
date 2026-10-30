import { useRef } from 'react';
import { S } from '../strings';
import { CameraHandle } from '../hooks/useCamera';
import { CameraView } from './CameraView';

interface Props {
  camera: CameraHandle;
  onBack: () => void;
}

/**
 * ミラー画面: ヘッダー + 状態 + カメラ映像（鏡像）+ 下部パネル
 * フェーズ 0 では映像と枠だけ。顔認識・メイク描画・ガイドはこの上に足していく
 */
export function MirrorScreen({ camera, onBack }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  let statusText: string;
  if (camera.status === 'running') statusText = S.mirror.cameraOk;
  else if (camera.status === 'error') statusText = `${S.camera.errorTitle} ${S.camera[camera.error ?? 'unknown']}`;
  else statusText = S.camera.interrupted;

  return (
    <div className="mmm-screen">
      <header className="mmm-header">
        <button className="mmm-icon-button" onClick={onBack} aria-label={S.back} title={S.back}>←</button>
        <h1 className="mmm-title">💄 {S.title}</h1>
        <span className="mmm-header-spacer" aria-hidden="true" />
      </header>

      <div className="mmm-body">
        <CameraView stream={camera.stream} mirrored videoRef={videoRef}>
          <div className="mmm-status" role="status" data-status={camera.status}>{statusText}</div>
        </CameraView>

        <div className="mmm-panel">
          <p className="mmm-panel-note">{S.mirror.comingSoon}</p>
        </div>
      </div>
    </div>
  );
}
