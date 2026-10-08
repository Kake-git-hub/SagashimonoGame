/**
 * べんきょうクイズの問題を作る（純粋関数。乱数は引数で差し替えられる）
 * レベルは年齢から決める（profileService.quizLevelForAge）:
 *   1: 3〜4 さい  かぞえる・おおい/すくない（1〜5）
 *   2: 5〜6 さい  10 までの かず・ひらがな・たしざん/ひきざん（10 まで）
 *   3: 7〜8 さい  たしざん/ひきざん（100 まで）・かけざん（九九）
 *   4: 9〜10 さい かけざん・わりざん・大きな かず
 *   5: 11 さい〜  まぜこぜ（けいさんの じゅんばん）・大きな かけざん
 */
import { QuizSubject } from './appSettingsService';

export interface QuizQuestion {
  subject: QuizSubject;
  prompt: string;         // 問題文（絵文字を含むことがある）
  choices: string[];      // 選択肢（表示順）
  answerIndex: number;    // 正解の位置
  big?: boolean;          // 問題文を大きく表示する（絵文字の数えもの）
}

export type Rng = () => number;

const COUNT_EMOJI = ['🍎', '🍓', '🐟', '⭐', '🚗', '🐥', '🍙', '🎈', '🌸', '🐞'];

interface HiraganaWord {
  word: string;
  emoji: string;
}

const HIRAGANA_WORDS: HiraganaWord[] = [
  { word: 'りんご', emoji: '🍎' },
  { word: 'ばなな', emoji: '🍌' },
  { word: 'ぶどう', emoji: '🍇' },
  { word: 'いちご', emoji: '🍓' },
  { word: 'みかん', emoji: '🍊' },
  { word: 'ねこ', emoji: '🐱' },
  { word: 'いぬ', emoji: '🐶' },
  { word: 'うさぎ', emoji: '🐰' },
  { word: 'くま', emoji: '🐻' },
  { word: 'ぞう', emoji: '🐘' },
  { word: 'さかな', emoji: '🐟' },
  { word: 'とり', emoji: '🐦' },
  { word: 'かえる', emoji: '🐸' },
  { word: 'くるま', emoji: '🚗' },
  { word: 'でんしゃ', emoji: '🚃' },
  { word: 'ひこうき', emoji: '✈️' },
  { word: 'ふね', emoji: '⛵' },
  { word: 'ほし', emoji: '⭐' },
  { word: 'つき', emoji: '🌙' },
  { word: 'たいよう', emoji: '☀️' },
  { word: 'はな', emoji: '🌸' },
  { word: 'き', emoji: '🌳' },
  { word: 'いえ', emoji: '🏠' },
  { word: 'ぼうし', emoji: '🧢' },
  { word: 'くつ', emoji: '👟' },
  { word: 'かさ', emoji: '☂️' },
  { word: 'ほん', emoji: '📖' },
  { word: 'けーき', emoji: '🍰' },
  { word: 'おにぎり', emoji: '🍙' },
  { word: 'ぱん', emoji: '🍞' },
];

function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function shuffle<T>(rng: Rng, items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 正解と、正解の近くの誤答を混ぜた選択肢（数値）
function numberChoices(rng: Rng, answer: number, count: number, min: number, max: number): { choices: string[]; answerIndex: number } {
  const set = new Set<number>([answer]);
  let guard = 0;
  while (set.size < count && guard++ < 200) {
    const spread = Math.max(2, Math.ceil(Math.abs(answer) * 0.3));
    const candidate = rng() < 0.7 ? answer + randInt(rng, -spread, spread) : randInt(rng, min, max);
    if (candidate >= min && candidate <= max && candidate !== answer) set.add(candidate);
  }
  // 範囲が狭くて足りないときは範囲内から順に埋める
  for (let v = min; set.size < count && v <= max; v++) set.add(v);
  const choices = shuffle(rng, Array.from(set)).map(String);
  return { choices, answerIndex: choices.indexOf(String(answer)) };
}

function countQuestion(rng: Rng, level: number): QuizQuestion {
  const max = level <= 1 ? 5 : 10;
  const n = randInt(rng, 1, max);
  const emoji = pick(rng, COUNT_EMOJI);
  const { choices, answerIndex } = numberChoices(rng, n, 3, 1, max);
  return { subject: 'count', prompt: `${emoji.repeat(n)}\nいくつ あるかな？`, choices, answerIndex, big: true };
}

function compareQuestion(rng: Rng, level: number): QuizQuestion {
  const max = level <= 1 ? 5 : 9;
  const a = randInt(rng, 1, max);
  let b = randInt(rng, 1, max);
  while (b === a) b = randInt(rng, 1, max);
  const [ea, eb] = shuffle(rng, COUNT_EMOJI).slice(0, 2);
  const askMore = rng() < 0.5;
  const left = `${ea.repeat(a)}`;
  const right = `${eb.repeat(b)}`;
  const choices = [left, right];
  const answerIndex = askMore ? (a > b ? 0 : 1) : (a < b ? 0 : 1);
  return {
    subject: 'compare',
    prompt: askMore ? 'どっちが おおい？' : 'どっちが すくない？',
    choices,
    answerIndex,
  };
}

function hiraganaQuestion(rng: Rng): QuizQuestion {
  const words = shuffle(rng, HIRAGANA_WORDS).slice(0, 3);
  const answer = words[0];
  const choices = shuffle(rng, words).map(w => w.emoji);
  return {
    subject: 'hiragana',
    prompt: `「${answer.word}」は どれ？`,
    choices,
    answerIndex: choices.indexOf(answer.emoji),
  };
}

function addQuestion(rng: Rng, level: number): QuizQuestion {
  let a: number;
  let b: number;
  if (level <= 2) {
    a = randInt(rng, 1, 9);
    b = randInt(rng, 1, 10 - a);
  } else if (level === 3) {
    a = randInt(rng, 5, 60);
    b = randInt(rng, 5, 40);
  } else {
    a = randInt(rng, 20, 500);
    b = randInt(rng, 20, 500);
  }
  const answer = a + b;
  const { choices, answerIndex } = numberChoices(rng, answer, 3, 0, Math.max(answer + 20, 10));
  return { subject: 'add', prompt: `${a} ＋ ${b} ＝ ？`, choices, answerIndex };
}

function subQuestion(rng: Rng, level: number): QuizQuestion {
  let a: number;
  let b: number;
  if (level <= 2) {
    a = randInt(rng, 2, 10);
    b = randInt(rng, 1, a - 1);
  } else if (level === 3) {
    a = randInt(rng, 20, 100);
    b = randInt(rng, 1, a - 1);
  } else {
    a = randInt(rng, 100, 999);
    b = randInt(rng, 10, a - 1);
  }
  const answer = a - b;
  const { choices, answerIndex } = numberChoices(rng, answer, 3, 0, a);
  return { subject: 'sub', prompt: `${a} − ${b} ＝ ？`, choices, answerIndex };
}

function mulQuestion(rng: Rng, level: number): QuizQuestion {
  let a: number;
  let b: number;
  if (level <= 3) {
    a = randInt(rng, 1, 9);
    b = randInt(rng, 1, 9);
  } else if (level === 4) {
    a = randInt(rng, 2, 12);
    b = randInt(rng, 2, 12);
  } else {
    a = randInt(rng, 11, 99);
    b = randInt(rng, 2, 9);
  }
  const answer = a * b;
  const { choices, answerIndex } = numberChoices(rng, answer, 3, 0, answer + 30);
  return { subject: 'mul', prompt: `${a} × ${b} ＝ ？`, choices, answerIndex };
}

function divQuestion(rng: Rng, level: number): QuizQuestion {
  const b = randInt(rng, 2, level >= 5 ? 12 : 9);
  const q = randInt(rng, 1, level >= 5 ? 20 : 9);
  const a = b * q;
  const { choices, answerIndex } = numberChoices(rng, q, 3, 0, q + 10);
  return { subject: 'div', prompt: `${a} ÷ ${b} ＝ ？`, choices, answerIndex };
}

function mixedQuestion(rng: Rng): QuizQuestion {
  const a = randInt(rng, 2, 12);
  const b = randInt(rng, 2, 9);
  const c = randInt(rng, 2, 9);
  const kind = randInt(rng, 0, 2);
  let prompt: string;
  let answer: number;
  if (kind === 0) {
    prompt = `${a} ＋ ${b} × ${c} ＝ ？`;
    answer = a + b * c;
  } else if (kind === 1) {
    prompt = `（${a} ＋ ${b}）× ${c} ＝ ？`;
    answer = (a + b) * c;
  } else {
    const big = a * b + c;
    prompt = `${big} − ${a} × ${b} ＝ ？`;
    answer = c;
  }
  const { choices, answerIndex } = numberChoices(rng, answer, 3, 0, answer + 40);
  return { subject: 'mixed', prompt, choices, answerIndex };
}

// レベルに合う科目（親が選んでいなければこれを使う）
export function defaultSubjectsForLevel(level: number): QuizSubject[] {
  switch (Math.max(1, Math.min(5, Math.round(level)))) {
    case 1: return ['count', 'compare'];
    case 2: return ['count', 'hiragana', 'add', 'sub'];
    case 3: return ['add', 'sub', 'mul'];
    case 4: return ['add', 'sub', 'mul', 'div'];
    default: return ['mul', 'div', 'mixed'];
  }
}

export function generateQuestion(level: number, subjects: readonly QuizSubject[] = [], rng: Rng = Math.random): QuizQuestion {
  const lv = Math.max(1, Math.min(5, Math.round(level)));
  const pool = subjects.length > 0 ? subjects : defaultSubjectsForLevel(lv);
  const subject = pick(rng, pool);
  switch (subject) {
    case 'count': return countQuestion(rng, lv);
    case 'compare': return compareQuestion(rng, lv);
    case 'hiragana': return hiraganaQuestion(rng);
    case 'add': return addQuestion(rng, lv);
    case 'sub': return subQuestion(rng, lv);
    case 'mul': return mulQuestion(rng, lv);
    case 'div': return divQuestion(rng, lv);
    case 'mixed': return mixedQuestion(rng);
    default: return countQuestion(rng, lv);
  }
}

// おうちのひと用の確認問題（かけ算）。子どもが設定画面に入らないための簡単な関門
export function generateParentGate(rng: Rng = Math.random): { prompt: string; answer: number } {
  const a = randInt(rng, 6, 9);
  const b = randInt(rng, 6, 9);
  return { prompt: `${a} × ${b} = ?`, answer: a * b };
}
