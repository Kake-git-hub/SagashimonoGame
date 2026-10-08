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

export type QuizSubject = 'count' | 'compare' | 'hiragana' | 'add' | 'sub' | 'mul' | 'div' | 'mixed';

export const QUIZ_SUBJECTS: { id: QuizSubject; label: string; minLevel: number }[] = [
  { id: 'count', label: 'かぞえる', minLevel: 1 },
  { id: 'compare', label: 'おおい・すくない', minLevel: 1 },
  { id: 'hiragana', label: 'ひらがな', minLevel: 2 },
  { id: 'add', label: 'たしざん', minLevel: 2 },
  { id: 'sub', label: 'ひきざん', minLevel: 2 },
  { id: 'mul', label: 'かけざん', minLevel: 3 },
  { id: 'div', label: 'わりざん', minLevel: 4 },
  { id: 'mixed', label: 'まぜこぜ（かっこ・じゅんばん）', minLevel: 5 },
];

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
        quizSubjects: Array.isArray(parsed.quizSubjects) ? parsed.quizSubjects : [],
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
