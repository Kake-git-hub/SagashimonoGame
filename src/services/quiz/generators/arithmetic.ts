import { QuizGenerator } from '../types';
import { numberChoices, randInt } from '../random';

export const addGenerator: QuizGenerator<'add'> = {
  id: 'add',
  label: 'たしざん',
  minLevel: 2,
  generate(level, rng) {
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
  },
};

export const subGenerator: QuizGenerator<'sub'> = {
  id: 'sub',
  label: 'ひきざん',
  minLevel: 2,
  generate(level, rng) {
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
  },
};

export const mulGenerator: QuizGenerator<'mul'> = {
  id: 'mul',
  label: 'かけざん',
  minLevel: 3,
  generate(level, rng) {
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
  },
};

export const divGenerator: QuizGenerator<'div'> = {
  id: 'div',
  label: 'わりざん',
  minLevel: 4,
  generate(level, rng) {
    const b = randInt(rng, 2, level >= 5 ? 12 : 9);
    const q = randInt(rng, 1, level >= 5 ? 20 : 9);
    const a = b * q;
    const { choices, answerIndex } = numberChoices(rng, q, 3, 0, q + 10);
    return { subject: 'div', prompt: `${a} ÷ ${b} ＝ ？`, choices, answerIndex };
  },
};

export const mixedGenerator: QuizGenerator<'mixed'> = {
  id: 'mixed',
  label: 'まぜこぜ（かっこ・じゅんばん）',
  minLevel: 5,
  generate(_level, rng) {
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
      prompt = `${a * b + c} − ${a} × ${b} ＝ ？`;
      answer = c;
    }
    const { choices, answerIndex } = numberChoices(rng, answer, 3, 0, answer + 40);
    return { subject: 'mixed', prompt, choices, answerIndex };
  },
};
