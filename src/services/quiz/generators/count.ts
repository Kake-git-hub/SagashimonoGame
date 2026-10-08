import { QuizGenerator } from '../types';
import { numberChoices, pick, randInt, shuffle } from '../random';

export const COUNT_EMOJI = ['🍎', '🍓', '🐟', '⭐', '🚗', '🐥', '🍙', '🎈', '🌸', '🐞'];

// かぞえる: 絵文字の数を答える（レベル 1 は 5 まで、それ以上は 10 まで）
export const countGenerator: QuizGenerator<'count'> = {
  id: 'count',
  label: 'かぞえる',
  minLevel: 1,
  generate(level, rng) {
    const max = level <= 1 ? 5 : 10;
    const n = randInt(rng, 1, max);
    const emoji = pick(rng, COUNT_EMOJI);
    const { choices, answerIndex } = numberChoices(rng, n, 3, 1, max);
    return { subject: 'count', prompt: `${emoji.repeat(n)}\nいくつ あるかな？`, choices, answerIndex, big: true };
  },
};

// おおい・すくない: 2 つの絵文字の列を比べる
export const compareGenerator: QuizGenerator<'compare'> = {
  id: 'compare',
  label: 'おおい・すくない',
  minLevel: 1,
  generate(level, rng) {
    const max = level <= 1 ? 5 : 9;
    const a = randInt(rng, 1, max);
    let b = randInt(rng, 1, max);
    while (b === a) b = randInt(rng, 1, max);
    const [ea, eb] = shuffle(rng, COUNT_EMOJI).slice(0, 2);
    const askMore = rng() < 0.5;
    const choices = [ea.repeat(a), eb.repeat(b)];
    const answerIndex = askMore ? (a > b ? 0 : 1) : (a < b ? 0 : 1);
    return { subject: 'compare', prompt: askMore ? 'どっちが おおい？' : 'どっちが すくない？', choices, answerIndex };
  },
};
