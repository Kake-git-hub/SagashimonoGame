import { QuizGenerator } from '../types';
import { shuffle } from '../random';

interface HiraganaWord {
  word: string;
  emoji: string;
}

// 言葉を増やすときはここに足す（絵文字は 1 文字で、他と見分けやすいもの）
export const HIRAGANA_WORDS: HiraganaWord[] = [
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

// ひらがな: 言葉を読んで絵を選ぶ
export const hiraganaGenerator: QuizGenerator<'hiragana'> = {
  id: 'hiragana',
  label: 'ひらがな',
  minLevel: 2,
  generate(_level, rng) {
    const words = shuffle(rng, HIRAGANA_WORDS).slice(0, 3);
    const answer = words[0];
    const choices = shuffle(rng, words).map(w => w.emoji);
    return { subject: 'hiragana', prompt: `「${answer.word}」は どれ？`, choices, answerIndex: choices.indexOf(answer.emoji) };
  },
};
