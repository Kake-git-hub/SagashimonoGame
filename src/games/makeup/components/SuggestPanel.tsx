import { S } from '../strings';
import { Suggestion } from '../logic/suggest';
import { LookState } from '../logic/layers';
import { RecipeSummary } from '../logic/guide';

interface Props {
  suggestion: Suggestion | null;
  faceVisible: boolean;
  recipes: RecipeSummary[] | null;
  onDiagnose: () => void;
  onOpenRecipe: (id: string) => void;
  onApplyLook: (look: LookState) => void;
}

/**
 * ていあん の操作パネル: しんだん → かおの かたち / めの かたち / はだ の いろ / おすすめ
 */
export function SuggestPanel({ suggestion, faceVisible, recipes, onDiagnose, onOpenRecipe, onApplyLook }: Props) {
  if (!suggestion) {
    return (
      <div className="mmm-suggest">
        <p className="mmm-suggest-intro">{S.suggest.intro}</p>
        <button className="mmm-nav-button mmm-nav-primary" onClick={onDiagnose} disabled={!faceVisible}>🔍 {S.suggest.diagnose}</button>
        <p className="mmm-suggest-note">{faceVisible ? S.suggest.note : S.suggest.needFace}</p>
      </div>
    );
  }

  const face = S.suggest.faceShape[suggestion.faceShape];
  const eye = S.suggest.eyeShape[suggestion.eyeShape];
  const size = S.suggest.eyeSize[suggestion.eyeSize];
  const tone = S.suggest.skinTone[suggestion.skinTone];
  const brightness = suggestion.skinBrightness ? S.suggest.skinBrightness[suggestion.skinBrightness] : null;
  const recipe = recipes?.find(r => r.id === suggestion.recipeId);
  const swatches = (['lip', 'blush', 'eyeshadow', 'highlight'] as const).map(id => suggestion.look[id]?.color).filter((c): c is string => !!c);

  return (
    <div className="mmm-suggest" data-face-shape={suggestion.faceShape}>
      <div className="mmm-suggest-cards">
        <div className="mmm-suggest-card">
          <span className="mmm-suggest-label">{S.suggest.faceTitle}</span>
          <span className="mmm-suggest-value">{face.emoji} {face.name}</span>
          <p className="mmm-suggest-tip">{face.tip}</p>
        </div>
        <div className="mmm-suggest-card">
          <span className="mmm-suggest-label">{S.suggest.eyeTitle}</span>
          <span className="mmm-suggest-value">{eye.emoji} {eye.name}・{size.name}</span>
          <p className="mmm-suggest-tip">{eye.tip}</p>
          <p className="mmm-suggest-tip">{size.tip}</p>
        </div>
        <div className="mmm-suggest-card mmm-suggest-card-wide">
          <span className="mmm-suggest-label">{S.suggest.skinTitle}</span>
          <span className="mmm-suggest-value">🎨 {brightness ? `${brightness.name}・` : ''}{tone.name}</span>
          <p className="mmm-suggest-tip">{tone.tip}</p>
          <div className="mmm-suggest-swatches" aria-hidden="true">
            {swatches.map(c => <span key={c} className="mmm-suggest-swatch" style={{ background: c }} />)}
          </div>
        </div>
        {recipe && (
          <div className="mmm-suggest-card mmm-suggest-card-wide">
            <span className="mmm-suggest-label">{S.suggest.recipeTitle}</span>
            <span className="mmm-suggest-value">{recipe.emoji} {recipe.name}</span>
            <p className="mmm-suggest-tip">{recipe.description}</p>
          </div>
        )}
      </div>
      <div className="mmm-panel-row">
        <button className="mmm-chip-button mmm-chip-primary" onClick={() => onApplyLook(suggestion.look)}>🎨 {S.suggest.applyLook}</button>
        {recipe && <button className="mmm-chip-button" onClick={() => onOpenRecipe(recipe.id)}>📖 {S.suggest.openRecipe}</button>}
        <button className="mmm-chip-button" onClick={onDiagnose} disabled={!faceVisible}>🔍 {S.suggest.again}</button>
      </div>
      <p className="mmm-suggest-note">{S.suggest.note}</p>
    </div>
  );
}
