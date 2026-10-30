import { S } from '../strings';
import { PART_EMOJI } from '../constants';
import { Recipe, RecipeSummary } from '../logic/guide';

interface Props {
  recipes: RecipeSummary[] | null;
  recipesError: boolean;
  recipe: Recipe | null;
  loadingRecipe: boolean;
  stepIndex: number;          // steps.length なら「できあがり」
  poseOk: boolean;
  faceVisible: boolean;
  resultShown: boolean;
  onSelectRecipe: (id: string) => void;
  onStep: (delta: number) => void;
  onRestart: () => void;
  onLeaveRecipe: () => void;
  onToggleResult: () => void;
}

/**
 * おしえて の操作パネル: てじゅんを選ぶ → ステップを進める → できあがり
 */
export function GuidePanel({ recipes, recipesError, recipe, loadingRecipe, stepIndex, poseOk, faceVisible, resultShown, onSelectRecipe, onStep, onRestart, onLeaveRecipe, onToggleResult }: Props) {
  if (loadingRecipe) {
    return <div className="mmm-panel-placeholder">{S.guide.loading}</div>;
  }

  if (!recipe) {
    return (
      <div className="mmm-guide">
        <p className="mmm-guide-pick">{S.guide.pick}</p>
        {recipes === null && !recipesError && <p className="mmm-panel-hint">{S.guide.loading}</p>}
        {recipesError && <p className="mmm-panel-hint">{S.guide.error}</p>}
        <div className="mmm-recipes">
          {recipes?.map(r => (
            <button key={r.id} className="mmm-recipe" onClick={() => onSelectRecipe(r.id)} aria-label={`${r.name}の てじゅん`}>
              <span className="mmm-recipe-emoji" aria-hidden="true">{r.emoji}</span>
              <span className="mmm-recipe-body">
                <span className="mmm-recipe-name">{r.name}</span>
                <span className="mmm-recipe-desc">{r.description}</span>
                <span className="mmm-recipe-count">{r.stepCount} {S.guide.stepsUnit}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const total = recipe.steps.length;
  if (stepIndex >= total) {
    return (
      <div className="mmm-guide">
        <h2 className="mmm-guide-done">{S.guide.doneTitle}</h2>
        <p className="mmm-guide-text">{S.guide.doneText}</p>
        <div className="mmm-panel-row">
          <button className="mmm-chip-button" onClick={onToggleResult}>✨ {resultShown ? S.guide.hideResult : S.guide.showResult}</button>
          <button className="mmm-chip-button" onClick={onRestart}>🔁 {S.guide.restart}</button>
          <button className="mmm-chip-button" onClick={onLeaveRecipe}>📋 {S.guide.pickOther}</button>
        </div>
      </div>
    );
  }

  const step = recipe.steps[stepIndex];
  let poseHint: string | null = null;
  if (step.pose === 'smile') poseHint = poseOk ? S.guide.smileOk : S.guide.smileAsk;
  else if (step.pose === 'closeEyes') poseHint = poseOk ? S.guide.eyesOk : S.guide.eyesAsk;

  return (
    <div className="mmm-guide" data-step={step.id}>
      <div className="mmm-guide-head">
        <span className="mmm-guide-count">{S.guide.step} {stepIndex + 1} / {total}</span>
        <span className="mmm-guide-title">{PART_EMOJI[step.part] ?? '💄'} {step.title}</span>
      </div>
      <p className="mmm-guide-text">{step.text}</p>
      {poseHint && <p className={`mmm-guide-pose${poseOk ? ' mmm-guide-pose-ok' : ''}`}>{poseHint}</p>}
      {!faceVisible && <p className="mmm-panel-hint">{S.guide.needFace}</p>}
      <div className="mmm-guide-nav">
        <button className="mmm-nav-button" onClick={() => onStep(-1)} disabled={stepIndex === 0}>← {S.guide.prev}</button>
        <button className="mmm-nav-button mmm-nav-primary" onClick={() => onStep(1)}>
          {stepIndex === total - 1 ? S.guide.finish : `${S.guide.next} →`}
        </button>
      </div>
      <div className="mmm-panel-row">
        <button className="mmm-chip-button" onClick={onToggleResult}>✨ {resultShown ? S.guide.hideResult : S.guide.showResult}</button>
        <button className="mmm-chip-button" onClick={onLeaveRecipe}>📋 {S.guide.pickOther}</button>
      </div>
    </div>
  );
}
