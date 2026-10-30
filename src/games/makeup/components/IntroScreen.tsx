import { S } from '../strings';
import { CameraErrorKind } from '../services/camera';
import { CameraStatus } from '../hooks/useCamera';
import { useTapGuard } from '../../../hooks/useTapGuard';

interface Props {
  status: CameraStatus;
  error: CameraErrorKind | null;
  onStart: () => void;
  onPickPhoto: () => void;
  onExit: () => void;
}

/**
 * はじめに: カメラを使うことと、映像を外に出さないことを説明してから許可を求める
 */
export function IntroScreen({ status, error, onStart, onPickPhoto, onExit }: Props) {
  const ready = useTapGuard();
  const starting = status === 'starting';

  return (
    <div className="mmm-intro">
      <header className="mmm-intro-header">
        <button className="mmm-icon-button" onClick={onExit} aria-label={S.backToHome} title={S.backToHome}>←</button>
        <h1 className="mmm-intro-title">💄 {S.title}</h1>
      </header>
      <div className="mmm-intro-scroll">
        <div className="mmm-intro-card">
          <div className="mmm-intro-visual" aria-hidden="true">🪞</div>
          <h2 className="mmm-intro-heading">{S.intro.heading}</h2>
          <ul className="mmm-intro-points">
            {S.intro.points.map(p => <li key={p}>{p}</li>)}
          </ul>
          <section className="mmm-intro-note">
            <h3>🔒 {S.intro.privacyTitle}</h3>
            <p>{S.intro.privacy}</p>
            <p>{S.intro.download}</p>
          </section>
          {status === 'error' && (
            <div className="mmm-intro-error" role="alert">
              <strong>{S.camera.errorTitle}</strong>
              <p>{S.camera[error ?? 'unknown']}</p>
            </div>
          )}
          <button
            className="mmm-primary-button"
            onClick={onStart}
            disabled={!ready || starting}
            aria-busy={starting}
          >
            {starting ? S.camera.starting : status === 'error' ? S.camera.retry : `📷 ${S.intro.start}`}
          </button>
          <button className="mmm-secondary-button" onClick={onPickPhoto} disabled={!ready || starting}>
            🖼️ {S.photo.pick}
          </button>
        </div>
      </div>
    </div>
  );
}
