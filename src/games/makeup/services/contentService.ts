/**
 * public/makeup/ にある内容データ（色のパレット、将来は手順のレシピ）の取得
 * JSON を直して色や手順を変えられるようにしてある
 */
import { LAYER_ORDER, LayerId } from '../logic/layers';
import { Recipe, RecipeSummary } from '../logic/guide';
import { validateRecipe } from '../logic/validateRecipe';

export interface PaletteColor {
  name: string;
  color: string; // #rrggbb
}

export type PaletteMap = Record<LayerId, PaletteColor[]>;

const BASE = `${import.meta.env.BASE_URL}makeup/`;

export async function fetchPalettes(): Promise<PaletteMap> {
  const res = await fetch(`${BASE}palettes.json`);
  if (!res.ok) throw new Error(`palettes: ${res.status}`);
  return sanitizePalettes(await res.json());
}

export function sanitizePalettes(raw: unknown): PaletteMap {
  const out = {} as PaletteMap;
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  for (const id of LAYER_ORDER) {
    const list = Array.isArray(obj[id]) ? (obj[id] as unknown[]) : [];
    out[id] = list
      .filter((c): c is PaletteColor => !!c && typeof c === 'object'
        && typeof (c as PaletteColor).name === 'string'
        && typeof (c as PaletteColor).color === 'string'
        && /^#[0-9a-fA-F]{6}$/.test((c as PaletteColor).color))
      .map(c => ({ name: c.name, color: c.color.toLowerCase() }));
  }
  return out;
}

export async function fetchRecipeIndex(): Promise<RecipeSummary[]> {
  const res = await fetch(`${BASE}recipes/index.json`);
  if (!res.ok) throw new Error(`recipes: ${res.status}`);
  const raw = await res.json();
  if (!Array.isArray(raw)) throw new Error('recipes: not an array');
  return raw
    .filter((e): e is RecipeSummary => !!e && typeof e === 'object' && typeof (e as RecipeSummary).id === 'string' && typeof (e as RecipeSummary).name === 'string')
    .map(e => ({ id: e.id, name: e.name, emoji: e.emoji ?? '💄', description: e.description ?? '', stepCount: typeof e.stepCount === 'number' ? e.stepCount : 0 }));
}

export async function fetchRecipe(id: string): Promise<Recipe> {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`recipe: bad id ${id}`);
  const res = await fetch(`${BASE}recipes/${id}.json`);
  if (!res.ok) throw new Error(`recipe ${id}: ${res.status}`);
  const { recipe, errors } = validateRecipe(await res.json());
  if (!recipe) throw new Error(`recipe ${id}: ${errors.join(', ')}`);
  return recipe;
}
