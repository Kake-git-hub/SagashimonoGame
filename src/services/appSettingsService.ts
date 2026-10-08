/**
 * おうちのひと（親）が決める設定。端末ごとに 1 つ（プロフィール共通）
 * localStorage のキー: asobi_settings
 */

// クイズを出す場面
export type QuizTrigger = 'addBox' | 'addBuffer' | 'continue' | 'nextStage';

export const QUIZ_TRIGGERS: { id: QuizTrigger; label: string; detail: string }[] = [
  { id: 'addBox', label: 'ネジボックスを ふやすとき', detail: 'ゲーム中の「＋はこ」ボタン' },
  { id: 'addBuffer', label: 'おきばを ふやすとき', detail: 'ゲーム中の「＋おきば」ボタン' },
  { id: 'continue', label: 'しっぱいから つづけるとき', detail: '3 てまえから やりなおせる' },
  { id: 'nextStage', label: 'つぎのステージへ すすむとき', detail: 'クリアしたあと' },
];

import { isQuizSubject, QuizSubject } from './quiz';

export type { QuizSubject } from './quiz';
export { QUIZ_SUBJECTS } from './quiz';

export interface AppSettings {
  quizEnabled: boolean;                       // false ならクイズなしでそのまま進める
  quizTriggers: Record<QuizTrigger, boolean>; // どの場面でクイズを出すか
  quizQuestions: number;                      // 1 回のクイズで正解が必要な数（1〜3）
  quizSubjects: QuizSubject[];                // 出題する科目（空なら年齢に合わせて自動）
  quizLevelOverride: number | null;           // null なら年齢から自動
  nejiMaxExtraBoxes: number;                  // 1 ステージで「＋はこ」できる回数
  nejiMaxExtraBuffer: number;                 // 1 ステージで「＋おきば」できる回数
}

const SETTINGS_KEY = 'asobi_settings';

export const DEFAULT_SETTINGS: AppSettings = {
  quizEnabled: true,
  quizTriggers: { addBox: true, addBuffer: true, continue: true, nextStage: true },
  quizQuestions: 1,
  quizSubjects: [],
  quizLevelOverride: null,
  nejiMaxExtraBoxes: 2,
  nejiMaxExtraBuffer: 3,
};

export function getAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        quizTriggers: { ...DEFAULT_SETTINGS.quizTriggers, ...(parsed.quizTriggers ?? {}) },
        quizSubjects: Array.isArray(parsed.quizSubjects) ? parsed.quizSubjects.filter(isQuizSubject) : [],
      };
    }
  } catch {
    // 壊れていたら既定値
  }
  return { ...DEFAULT_SETTINGS, quizTriggers: { ...DEFAULT_SETTINGS.quizTriggers } };
}

export function saveAppSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// この場面でクイズを出すか
export function shouldQuiz(settings: AppSettings, trigger: QuizTrigger): boolean {
  return settings.quizEnabled && settings.quizTriggers[trigger];
}
