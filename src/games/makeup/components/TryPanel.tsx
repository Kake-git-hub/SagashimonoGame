import { S } from '../strings';
import { PART_EMOJI } from '../constants';
import { LAYER_SPEC, LayerId, LookAction, LookState } from '../logic/layers';
import { PaletteMap } from '../services/contentService';

// パーツタブの順番
const PART_TABS: LayerId[] = ['lip', 'blush', 'eyeshadow', 'eyeliner', 'brow', 'highlight', 'base', 'concealer'];

interface Props {
  palettes: PaletteMap | null;
  paletteError: boolean;
  look: LookState;
  part: LayerId;
  faceVisible: boolean;
  saving: boolean;
  saveNote: string | null;
  onPart: (part: LayerId) => void;
  dispatch: (action: LookAction) => void;
  onCompare: (pressed: boolean) => void;
  onSave: () => void;
}

/**
 * ためす の操作パネル: パーツ → 色 → つよさ、くらべる / ぜんぶ けす / ほぞん
 */
export function TryPanel({ palettes, paletteError, look, part, faceVisible, saving, saveNote, onPart, dispatch, onCompare, onSave }: Props) {
  const current = look[part];
  const colors = palettes?.[part] ?? [];
  const strength = Math.round((current?.opacity ?? LAYER_SPEC[part].defaultOpacity) * 100);
  const anyLayer = Object.keys(look).length > 0;

  return (
    <div className="mmm-try">
      <div className="mmm-parts" role="tablist" aria-label={S.try.parts}>
        {PART_TABS.map(id => (
          <button
            key={id}
            role="tab"
            aria-selected={part === id}
            className={`mmm-part${part === id ? ' mmm-part-on' : ''}${look[id] ? ' mmm-part-used' : ''}`}
            onClick={() => onPart(id)}
          >
            <span className="mmm-part-emoji" aria-hidden="true">{PART_EMOJI[id]}</span>
            <span className="mmm-part-label">{S.parts[id]}</span>
            {look[id] && <span className="mmm-part-dot" style={{ background: look[id]!.color }} aria-hidden="true" />}
          </button>
        ))}
      </div>

      <div className="mmm-swatches" role="radiogroup" aria-label={S.try.colors}>
        <button
          role="radio"
          aria-checked={!current}
          aria-label={S.try.none}
          className={`mmm-swatch mmm-swatch-none${!current ? ' mmm-swatch-on' : ''}`}
          onClick={() => dispatch({ type: 'clear', layer: part })}
        >
          ✕
        </button>
        {palettes === null && !paletteError && <span className="mmm-swatch-note">{S.try.loadingPalette}</span>}
        {paletteError && <span className="mmm-swatch-note">{S.try.paletteError}</span>}
        {colors.map(c => (
          <button
            key={c.color}
            role="radio"
            aria-checked={current?.color === c.color}
            aria-label={c.name}
            title={c.name}
            className={`mmm-swatch${current?.color === c.color ? ' mmm-swatch-on' : ''}`}
            style={{ background: c.color }}
            onClick={() => dispatch({ type: 'color', layer: part, color: c.color })}
          />
        ))}
      </div>

      <label className="mmm-strength">
        <span>{S.try.strength}</span>
        <input
          type="range"
          min={5}
          max={100}
          value={strength}
          disabled={!current}
          onChange={e => dispatch({ type: 'opacity', layer: part, opacity: Number(e.target.value) / 100 })}
          aria-label={`${S.parts[part]} ${S.try.strength}`}
        />
        <span className="mmm-strength-value">{current ? `${strength}%` : '-'}</span>
      </label>

      <div className="mmm-panel-row">
        <button
          className="mmm-chip-button"
          disabled={!anyLayer}
          onPointerDown={() => onCompare(true)}
          onPointerUp={() => onCompare(false)}
          onPointerLeave={() => onCompare(false)}
          onPointerCancel={() => onCompare(false)}
          onContextMenu={e => e.preventDefault()}
        >
          👀 {S.try.compare}
        </button>
        <button className="mmm-chip-button" disabled={!anyLayer} onClick={() => dispatch({ type: 'clearAll' })}>
          🧹 {S.try.clearAll}
        </button>
        <button className="mmm-chip-button mmm-chip-primary" disabled={saving || !faceVisible} onClick={onSave}>
          📷 {saving ? S.try.saving : S.try.save}
        </button>
      </div>
      {(saveNote || !faceVisible) && (
        <p className="mmm-panel-hint">{saveNote ?? S.try.needFace}</p>
      )}
    </div>
  );
}
