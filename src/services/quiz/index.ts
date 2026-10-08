/**
 * べんきょうクイズ（純粋関数。乱数は引数で差し替えられる）
 *
 * レベルは年齢から決める（profileService.quizLevelForAge）:
 *   1: 3〜4 さい  かぞえる・おおい/すくない（1〜5）
 *   2: 5〜6 さい  10 までの かず・ひらがな・たしざん/ひきざん（10 まで）
 *   3: 7〜8 さい  たしざん/ひきざん（100 まで）・かけざん（九九）
 *   4: 9〜10 さい かけざん・わりざん・大きな かず
 *   5: 11 さい〜  まぜこぜ（けいさんの じゅんばん）・大きな かけざん
 *
 * 科目を増やす手順:
 *   1. generators/ に QuizGenerator を書く（id はひらがなでない英字の短い名前）
 *   2. GENERATORS に足す（QuizSubject 型と、おうちのひと設定の一覧は自動で増える）
 *   3. 必要なら DEFAULT_SUBJECTS_BY_LEVEL（科目未指定のときの出題範囲）に入れる
 */
import { QuizGenerator, QuizQuestion, Rng } from './types';
import { compareGenerator, countGenerator } from './generators/count';
import { hiraganaGenerator } from './generators/hiragana';
import { addGenerator, divGenerator, mixedGenerator, mulGenerator, subGenerator } from './generators/arithmetic';
import { randInt } from './random';

export type { QuizGenerator, QuizQuestion, Rng } from './types';

const GENERATORS = [
  countGenerator,
  compareGenerator,
  hiraganaGenerator,
  addGenerator,
  subGenerator,
  mulGenerator,
  divGenerator,
  mixedGenerator,
] as const;

export type QuizSubject = (typeof GENERATORS)[number]['id'];

// おうちのひと設定に出す科目一覧
export const QUIZ_SUBJECTS: readonly { id: QuizSubject; label: string; minLevel: number }[] = GENERATORS.map(g => ({
  id: g.id,
  label: g.label,
  minLevel: g.minLevel,
}));

const DEFAULT_SUBJECTS_BY_LEVEL: Record<1 | 2 | 3 | 4 | 5, QuizSubject[]> = {
  1: ['count', 'compare'],
  2: ['count', 'hiragana', 'add', 'sub'],
  3: ['add', 'sub', 'mul'],
  4: ['add', 'sub', 'mul', 'div'],
  5: ['mul', 'div', 'mixed'],
};

function clampLevel(level: number): 1 | 2 | 3 | 4 | 5 {
  return Math.max(1, Math.min(5, Math.round(level))) as 1 | 2 | 3 | 4 | 5;
}

export function isQuizSubject(id: string): id is QuizSubject {
  return GENERATORS.some(g => g.id === id);
}

// レベルに合う科目（親が選んでいなければこれを使う）
export function defaultSubjectsForLevel(level: number): QuizSubject[] {
  return [...DEFAULT_SUBJECTS_BY_LEVEL[clampLevel(level)]];
}

export function generateQuestion(level: number, subjects: readonly string[] = [], rng: Rng = Math.random): QuizQuestion {
  const lv = clampLevel(level);
  const wanted = subjects.filter(isQuizSubject);
  const pool = wanted.length > 0 ? wanted : defaultSubjectsForLevel(lv);
  const subject = pool[Math.floor(rng() * pool.length)];
  const generator = GENERATORS.find(g => g.id === subject) as QuizGenerator;
  return generator.generate(lv, rng);
}

// おうちのひと用の確認問題（かけ算）。子どもが設定画面に入らないための簡単な関門
export function generateParentGate(rng: Rng = Math.random): { prompt: string; answer: number } {
  const a = randInt(rng, 6, 9);
  const b = randInt(rng, 6, 9);
  return { prompt: `${a} × ${b} = ?`, answer: a * b };
}
