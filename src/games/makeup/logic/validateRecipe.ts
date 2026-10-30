/**
 * レシピ JSON の整合性チェック（テストと読み込み時に使う）
 * 参照切れの点や領域があるとガイドが描けないので、配る前に見つける
 */
import { LAYER_ORDER, LayerId } from './layers';
import { PATH_NAMES, POINT_NAMES, REGION_NAMES } from './regions';
import { GUIDE_PARTS, GUIDE_POSES, Recipe } from './guide';

const COLOR = /^#[0-9a-fA-F]{6}$/;

export function validateRecipe(raw: unknown): { recipe: Recipe | null; errors: string[] } {
  const errors: string[] = [];
  const r = raw as Partial<Recipe> | null;
  if (!r || typeof r !== 'object') return { recipe: null, errors: ['not an object'] };
  if (typeof r.id !== 'string' || !r.id) errors.push('id がない');
  if (typeof r.name !== 'string' || !r.name) errors.push('name がない');
  if (typeof r.emoji !== 'string') errors.push('emoji がない');
  if (typeof r.description !== 'string') errors.push('description がない');
  if (!Array.isArray(r.steps) || r.steps.length === 0) {
    errors.push('steps が空');
    return { recipe: null, errors };
  }
  const ids = new Set<string>();
  r.steps.forEach((step, i) => {
    const where = `steps[${i}]${step?.id ? ` (${step.id})` : ''}`;
    if (!step || typeof step !== 'object') { errors.push(`${where}: not an object`); return; }
    if (typeof step.id !== 'string' || !step.id) errors.push(`${where}: id がない`);
    else if (ids.has(step.id)) errors.push(`${where}: id が重複`);
    else ids.add(step.id);
    if (!GUIDE_PARTS.includes(step.part)) errors.push(`${where}: part が不明 (${String(step.part)})`);
    if (typeof step.title !== 'string' || !step.title) errors.push(`${where}: title がない`);
    if (typeof step.text !== 'string' || !step.text) errors.push(`${where}: text がない`);
    if (step.pose !== undefined && !GUIDE_POSES.includes(step.pose)) errors.push(`${where}: pose が不明 (${String(step.pose)})`);
    for (const name of step.regions ?? []) {
      if (!(REGION_NAMES as readonly string[]).includes(name)) errors.push(`${where}: regions に不明な名前 ${name}`);
    }
    for (const s of step.strokes ?? []) {
      if (s.along) {
        if (!(PATH_NAMES as readonly string[]).includes(s.along)) errors.push(`${where}: strokes.along が不明 ${s.along}`);
      } else if (!s.from || !s.to) {
        errors.push(`${where}: strokes は along か from/to が必要`);
      } else {
        for (const p of [s.from, s.to]) {
          if (!(POINT_NAMES as readonly string[]).includes(p)) errors.push(`${where}: strokes に不明な点 ${p}`);
        }
      }
    }
    for (const m of step.marks ?? []) {
      if (m.type !== 'vline' && m.type !== 'dot') errors.push(`${where}: marks.type が不明`);
      if (!(POINT_NAMES as readonly string[]).includes(m.anchor)) errors.push(`${where}: marks に不明な点 ${m.anchor}`);
    }
    if (step.look) {
      if (!LAYER_ORDER.includes(step.look.layer as LayerId)) errors.push(`${where}: look.layer が不明 ${String(step.look.layer)}`);
      if (typeof step.look.color !== 'string' || !COLOR.test(step.look.color)) errors.push(`${where}: look.color が不正`);
      if (typeof step.look.opacity !== 'number' || step.look.opacity < 0 || step.look.opacity > 1) errors.push(`${where}: look.opacity は 0〜1`);
    }
    if ((step.regions?.length ?? 0) === 0 && (step.strokes?.length ?? 0) === 0 && step.part !== 'finish') {
      errors.push(`${where}: 顔に描くもの（regions か strokes）がない`);
    }
  });
  return { recipe: errors.length === 0 ? (r as Recipe) : null, errors };
}
