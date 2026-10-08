/**
 * べんきょうクイズの共通の型
 * 科目を増やすときは generators/ にファイルを足して index.ts の GENERATORS に登録する
 */

export type Rng = () => number;

export interface QuizQuestion {
  subject: string;        // 科目 id
  prompt: string;         // 問題文（絵文字を含むことがある。改行可）
  choices: string[];      // 選択肢（表示順）
  answerIndex: number;    // 正解の位置
  big?: boolean;          // 問題文の 1 行目を大きく表示する（絵文字の数えもの）
}

export interface QuizGenerator<Id extends string = string> {
  id: Id;
  label: string;          // おうちのひと設定に出す名前
  minLevel: number;       // この科目が出せる最低レベル（1〜5）
  // 年齢レベル（1〜5）に合った問題を 1 つ作る
  generate: (level: number, rng: Rng) => QuizQuestion;
}
