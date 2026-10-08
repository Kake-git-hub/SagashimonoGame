import { describe, expect, it } from 'vitest';
import { defaultSubjectsForLevel, generateParentGate, generateQuestion, QUIZ_SUBJECTS } from './index';

// 再現できる疑似乱数
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function evaluate(prompt: string): number | null {
  // "12 ＋ 3 ＝ ？" のような式を計算する（かっこ・優先順位対応）
  const expr = prompt
    .replace(/＝.*$/, '')
    .replace(/＋/g, '+').replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/')
    .replace(/（/g, '(').replace(/）/g, ')')
    .trim();
  if (!/^[0-9+\-*/() ]+$/.test(expr)) return null;
  return Function(`return (${expr})`)() as number;
}

describe('generateQuestion', () => {
  it('どのレベル・科目でも正解が選択肢に含まれ、選択肢が重複しない', () => {
    const rng = seeded(42);
    for (let level = 1; level <= 5; level++) {
      for (const subject of QUIZ_SUBJECTS) {
        for (let i = 0; i < 30; i++) {
          const q = generateQuestion(level, [subject.id], rng);
          expect(q.choices.length).toBeGreaterThanOrEqual(2);
          expect(new Set(q.choices).size).toBe(q.choices.length);
          expect(q.answerIndex).toBeGreaterThanOrEqual(0);
          expect(q.answerIndex).toBeLessThan(q.choices.length);
          const computed = evaluate(q.prompt);
          if (computed !== null) {
            expect(Number(q.choices[q.answerIndex]), q.prompt).toBe(computed);
          }
        }
      }
    }
  });

  it('レベル 2 のたしざんは 10 までに収まる', () => {
    const rng = seeded(7);
    for (let i = 0; i < 50; i++) {
      const q = generateQuestion(2, ['add'], rng);
      expect(Number(q.choices[q.answerIndex])).toBeLessThanOrEqual(10);
    }
  });

  it('かぞえる問題は絵文字の数と答えが一致する', () => {
    const rng = seeded(3);
    for (let i = 0; i < 30; i++) {
      const q = generateQuestion(1, ['count'], rng);
      const emojis = Array.from(q.prompt.split('\n')[0]).length;
      // 絵文字は 1 文字（サロゲートペアは Array.from で 1 要素）
      expect(Number(q.choices[q.answerIndex])).toBe(emojis);
    }
  });

  it('科目が未指定ならレベルに合う科目だけが出る', () => {
    const rng = seeded(11);
    for (let level = 1; level <= 5; level++) {
      const allowed = defaultSubjectsForLevel(level);
      for (let i = 0; i < 20; i++) {
        expect(allowed).toContain(generateQuestion(level, [], rng).subject);
      }
    }
  });

  it('おうちのひと用の関門はかけ算', () => {
    const gate = generateParentGate(seeded(1));
    expect(evaluate(gate.prompt.replace('=', '＝'))).toBe(gate.answer);
  });
});
