import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateRecipe } from './logic/validateRecipe';
import { buildGuideDrawing, Recipe, recipeLook } from './logic/guide';
import { faceRegions } from './logic/regions';
import fixture from './logic/fixtures/portrait-frame.json';
import { Point3 } from './types';

const DIR = join(__dirname, '..', '..', '..', 'public', 'makeup', 'recipes');
const index = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf-8')) as { id: string; name: string; emoji: string; description: string; stepCount: number }[];
const files = readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'index.json');
const landmarks: Point3[] = (fixture.landmarks as number[][]).map(([x, y, z]) => ({ x, y, z }));
const regions = faceRegions(landmarks, fixture.width, fixture.height);

describe('レシピ JSON（public/makeup/recipes）', () => {
  it('index.json に全ファイルが載っていて、名前とステップ数が合う', () => {
    expect(index.map(e => `${e.id}.json`).sort()).toEqual(files.sort());
    for (const entry of index) {
      const recipe = JSON.parse(readFileSync(join(DIR, `${entry.id}.json`), 'utf-8')) as Recipe;
      expect(recipe.id).toBe(entry.id);
      expect(recipe.name).toBe(entry.name);
      expect(recipe.emoji).toBe(entry.emoji);
      expect(recipe.steps.length).toBe(entry.stepCount);
    }
  });

  for (const file of files) {
    describe(file, () => {
      const raw = JSON.parse(readFileSync(join(DIR, file), 'utf-8'));
      const { recipe, errors } = validateRecipe(raw);

      it('整合性チェックを通る', () => {
        expect(errors).toEqual([]);
        expect(recipe).not.toBeNull();
      });

      it('サンプルの顔で全ステップの描くものが作れる', () => {
        for (const step of recipe!.steps) {
          const d = buildGuideDrawing(step, regions);
          const expectedStrokes = step.strokes?.length ?? 0;
          expect(d.strokes.length, `${step.id} の strokes`).toBe(expectedStrokes);
          expect(d.regions.length, `${step.id} の regions`).toBe(step.regions?.length ?? 0);
          expect(d.marks.length, `${step.id} の marks`).toBe(step.marks?.length ?? 0);
          for (const s of d.strokes) {
            for (const p of s) {
              expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
            }
          }
        }
      });

      it('できあがりの look が作れる', () => {
        const look = recipeLook(recipe!);
        for (const style of Object.values(look)) {
          expect(style.color).toMatch(/^#[0-9a-f]{6}$/i);
        }
      });
    });
  }
});

describe('validateRecipe', () => {
  it('参照切れを見つける', () => {
    const { errors } = validateRecipe({
      id: 'x', name: 'x', emoji: 'x', description: 'x',
      steps: [
        { id: 'a', part: 'lip', title: 't', text: 't', regions: ['nope'], strokes: [{ from: 'lipTop', to: 'bogus' }], look: { layer: 'lip', color: 'red', opacity: 2 } },
        { id: 'a', part: 'what', title: 't', text: 't' },
      ],
    });
    expect(errors.some(e => e.includes('nope'))).toBe(true);
    expect(errors.some(e => e.includes('bogus'))).toBe(true);
    expect(errors.some(e => e.includes('look.color'))).toBe(true);
    expect(errors.some(e => e.includes('look.opacity'))).toBe(true);
    expect(errors.some(e => e.includes('重複'))).toBe(true);
    expect(errors.some(e => e.includes('part が不明'))).toBe(true);
    expect(errors.some(e => e.includes('描くもの'))).toBe(true);
  });
});
