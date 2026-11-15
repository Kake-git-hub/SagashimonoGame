import { S } from '../strings';
import { PART_EMOJI } from '../constants';
import { BRUSH_SIZES, BrushSize } from '../logic/brush';
import { LAYER_SPEC, LayerId, LookAction, LookState } from '../logic/layers';
import { PaletteMap } from '../services/contentService';

// パーツタブの順番
const PART_TABS: LayerId[] = ['lip', 'blush', 'eyeshadow', 'eyeliner', 'brow', 'highlight', 'base', 'concealer'];

// ふとさ のボタンに出す丸の大きさ（px）
const SIZE_DOT: Record<BrushSize, number> = { s: 8, m: 14, l: 22 };

interface Props {
  // どちらの部分を描くか。tools = パーツ・ふとさ・つよさ、colors = 色・ボタン・ひとこと。
  // 横向きでは映像の左右に、縦向きでは映像の下に続けて置く
  section: 'tools' | 'colors';
  palettes: PaletteMap | null;
  paletteError: boolean;
  look: LookState;          // パーツごとに選んでいる色と つよさ
  part: LayerId;
  color: string | null;     // いまの筆の色（選んでいなければ、そのパーツの最初の色）
  painted: LayerId[];       // 塗ってあるパーツ
  erasing: boolean;
  brushSize: BrushSize;
  assist: boolean;
  faceVisible: boolean;
  saving: boolean;
  note: string | null;      // ほぞん の結果や「かおの うえを なぞってね」など、一時的に出す文言
  onPart: (part: LayerId) => void;
  onErasing: (erasing: boolean) => void;
  onBrushSize: (size: BrushSize) => void;
  onAssist: (assist: boolean) => void;
  dispatch: (action: LookAction) => void;
  onCompare: (pressed: boolean) => void;
  onClearAll: () => void;
  onSave: () => void;
}

/**
 * ためす の操作パネル（パレット）: パーツ → 色（または けしゴム）→ ふとさ・つよさ、はみださない / くらべる / ぜんぶ けす / ほぞん
 * 色を選んだだけでは顔に付かない。映像の上を指でなぞった所に付く
 */
export function TryPanel({
  section, palettes, paletteError, look, part, color, painted, erasing, brushSize, assist, faceVisible, saving, note,
  onPart, onErasing, onBrushSize, onAssist, dispatch, onCompare, onClearAll, onSave,
}: Props) {
  const colors = palettes?.[part] ?? [];
  const strength = Math.round((look[part]?.opacity ?? LAYER_SPEC[part].defaultOpacity) * 100);
  const anyPaint = painted.length > 0;
  const hint = note ?? (!faceVisible ? S.try.needFace : erasing ? S.try.eraseHint : assist ? S.try.paintHintAssist : S.try.paintHint);

  const pickColor = (next: string) => {
    onErasing(false);
    dispatch({ type: 'color', layer: part, color: next });
  };
  const setStrength = (value: number) => {
    if (!color) return;
    dispatch({ type: 'set', layer: part, style: { color, opacity: value / 100 } });
  };

  const brushRow = (
    <div className="mmm-brush-row">
      <div className="mmm-sizes" role="radiogroup" aria-label={S.try.size}>
        <span className="mmm-brush-label">{S.try.size}</span>
        {BRUSH_SIZES.map(size => (
          <button
            key={size}
            role="radio"
            aria-checked={brushSize === size}
            aria-label={`${S.try.size} ${S.try.sizes[size]}`}
            title={S.try.sizes[size]}
            className={`mmm-size${brushSize === size ? ' mmm-size-on' : ''}`}
            onClick={() => onBrushSize(size)}
          >
            <span className="mmm-size-dot" style={{ width: SIZE_DOT[size], height: SIZE_DOT[size] }} aria-hidden="true" />
          </button>
        ))}
      </div>
      <label className="mmm-strength">
        <span className="mmm-brush-label">{S.try.strength}</span>
        <input
          type="range"
          min={5}
          max={100}
          value={strength}
          disabled={!color}
          onChange={e => setStrength(Number(e.target.value))}
          aria-label={`${S.parts[part]} ${S.try.strength}`}
        />
        <span className="mmm-strength-value">{strength}%</span>
      </label>
    </div>
  );

  if (section === 'tools') return (
    <div className="mmm-try mmm-try-tools">
      <div className="mmm-parts" role="tablist" aria-label={S.try.parts}>
        {PART_TABS.map(id => (
          <button
            key={id}
            role="tab"
            aria-selected={part === id}
            className={`mmm-part${part === id ? ' mmm-part-on' : ''}${painted.includes(id) ? ' mmm-part-used' : ''}`}
            onClick={() => onPart(id)}
          >
            <span className="mmm-part-emoji" aria-hidden="true">{PART_EMOJI[id]}</span>
            <span className="mmm-part-label">{S.parts[id]}</span>
            {painted.includes(id) && <span className="mmm-part-dot" style={{ background: look[id]?.color ?? 'white' }} aria-hidden="true" />}
          </button>
        ))}
      </div>

      {brushRow}
    </div>
  );

  return (
    <div className="mmm-try mmm-try-colors">
      <div className="mmm-swatches" role="radiogroup" aria-label={S.try.colors}>
        <button
          role="radio"
          aria-checked={erasing}
          aria-label={S.try.eraser}
          title={S.try.eraser}
          className={`mmm-swatch mmm-swatch-eraser${erasing ? ' mmm-swatch-on' : ''}`}
          onClick={() => onErasing(true)}
        >
          🧽
        </button>
        {palettes === null && !paletteError && <span className="mmm-swatch-note">{S.try.loadingPalette}</span>}
        {paletteError && <span className="mmm-swatch-note">{S.try.paletteError}</span>}
        {colors.map(c => {
          const on = !erasing && color === c.color;
          return (
            <button
              key={c.color}
              role="radio"
              aria-checked={on}
              aria-label={c.name}
              title={c.name}
              className={`mmm-swatch${on ? ' mmm-swatch-on' : ''}`}
              style={{ background: c.color }}
              onClick={() => pickColor(c.color)}
            />
          );
        })}
      </div>

      <div className="mmm-panel-row">
        <button
          className={`mmm-chip-button mmm-chip-toggle${assist ? ' mmm-chip-toggle-on' : ''}`}
          role="switch"
          aria-checked={assist}
          aria-label={assist ? S.try.assistOn : S.try.assistOff}
          onClick={() => onAssist(!assist)}
        >
          {assist ? '✅' : '⬜'} {S.try.assist}
        </button>
        <button
          className="mmm-chip-button"
          disabled={!anyPaint}
          onPointerDown={() => onCompare(true)}
          onPointerUp={() => onCompare(false)}
          onPointerLeave={() => onCompare(false)}
          onPointerCancel={() => onCompare(false)}
          onContextMenu={e => e.preventDefault()}
        >
          👀 {S.try.compare}
        </button>
        <button className="mmm-chip-button" disabled={!anyPaint} onClick={onClearAll}>
          🧹 {S.try.clearAll}
        </button>
        <button className="mmm-chip-button mmm-chip-primary" disabled={saving || !faceVisible} onClick={onSave}>
          📷 {saving ? S.try.saving : S.try.save}
        </button>
      </div>
      <p className="mmm-panel-hint" role="status">{hint}</p>
    </div>
  );
}
