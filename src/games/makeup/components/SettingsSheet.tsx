import { S } from '../strings';
import { MakeupSettings } from '../types';
import { TrackerStats } from '../hooks/useFaceTracker';
import { forgetGpuFailure } from '../services/gpuGuard';

interface Props {
  settings: MakeupSettings;
  stats?: TrackerStats;     // ミラー画面から開いたときだけ（いま使っている GPU / CPU を出す）
  isPhoto: boolean;
  onChange: (next: MakeupSettings) => void;
  onOpenDebug?: () => void; // デバッグの記録を見る（あそびひろば側の画面）
  onClose: () => void;
}

/**
 * せってい（ミラー画面に重なるシート）
 */
export function SettingsSheet({ settings, stats, isPhoto, onChange, onOpenDebug, onClose }: Props) {
  const toggle = (key: 'mirrored' | 'showLandmarks' | 'showStats' | 'debugNoTracking' | 'debugNoRender' | 'debugLowRes') => onChange({ ...settings, [key]: !settings[key] });
  const row = (label: string, checked: boolean, onToggle: () => void, disabled = false) => (
    <label className="mmm-setting-row">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={onToggle} disabled={disabled} />
    </label>
  );

  return (
    <div className="mmm-sheet-backdrop" onClick={onClose}>
      <div className="mmm-sheet" role="dialog" aria-label={S.settings.title} onClick={e => e.stopPropagation()}>
        <div className="mmm-sheet-handle" aria-hidden="true" />
        <h2 className="mmm-sheet-title">⚙️ {S.settings.title}</h2>
        {row(S.settings.mirrored, settings.mirrored, () => toggle('mirrored'), isPhoto)}
        {row(S.settings.showLandmarks, settings.showLandmarks, () => toggle('showLandmarks'))}
        {row(S.settings.showStats, settings.showStats, () => toggle('showStats'))}
        <div className="mmm-setting-row">
          <span>{S.settings.delegate}</span>
          <div className="mmm-segment" role="radiogroup" aria-label={S.settings.delegate}>
            {(['GPU', 'CPU'] as const).map(d => (
              <button
                key={d}
                role="radio"
                aria-checked={settings.delegate === d}
                className={settings.delegate === d ? 'mmm-segment-on' : ''}
                onClick={() => {
                  // GPU を選び直したら、前に固まった記録を忘れて、もう一度ためせるようにする
                  if (d === 'GPU') forgetGpuFailure();
                  onChange({ ...settings, delegate: d, delegateChosen: true });
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <p className="mmm-sheet-note">{S.settings.delegateNote}{stats?.delegate ? `（いま: ${stats.delegate}）` : ''}</p>
        <h3 className="mmm-sheet-subtitle">🐞 {S.settings.debugTitle}</h3>
        {row(S.settings.debugNoTracking, settings.debugNoTracking, () => toggle('debugNoTracking'))}
        {row(S.settings.debugNoRender, settings.debugNoRender, () => toggle('debugNoRender'))}
        {row(S.settings.debugLowRes, settings.debugLowRes, () => toggle('debugLowRes'))}
        <p className="mmm-sheet-note">{S.settings.debugNote}</p>
        {onOpenDebug && <button className="mmm-secondary-button" onClick={onOpenDebug}>🐞 {S.settings.openDebug}</button>}
        <button className="mmm-secondary-button" onClick={onClose}>{S.settings.close}</button>
      </div>
    </div>
  );
}
