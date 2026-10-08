import { useCallback, useMemo, useRef, useState } from 'react';
import { getAppSettings, QuizTrigger, shouldQuiz } from '../services/appSettingsService';
import { getCurrentProfile, quizLevelForAge } from '../services/profileService';
import { QuizScreen } from '../components/quiz/QuizScreen';

const TRIGGER_TITLES: Record<QuizTrigger, string> = {
  addBox: 'はこを ふやす',
  addBuffer: 'おきばを ふやす',
  continue: 'つづきから',
  nextStage: 'つぎのステージへ',
};

interface Pending {
  trigger: QuizTrigger;
  resolve: (passed: boolean) => void;
}

/**
 * 「クイズに正解したら進める」関門
 * ask(trigger) は、親の設定でその場面にクイズが不要なら即 true、
 * 必要なら QuizScreen（全画面）に切り替えて正解で true / やめるで false になる Promise を返す
 */
export function useQuizGate() {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const ask = useCallback((trigger: QuizTrigger): Promise<boolean> => {
    const settings = getAppSettings();
    if (!shouldQuiz(settings, trigger)) return Promise.resolve(true);
    // 既に出ているクイズがあれば、それをキャンセル扱いにして新しい方を出す
    pendingRef.current?.resolve(false);
    return new Promise<boolean>(resolve => {
      const next = { trigger, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const finish = useCallback((passed: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(passed);
  }, []);

  const overlay = useMemo(() => {
    if (!pending) return null;
    const settings = getAppSettings();
    const profile = getCurrentProfile();
    const level = settings.quizLevelOverride ?? quizLevelForAge(profile?.age ?? 6);
    return (
      <QuizScreen
        level={level}
        subjects={settings.quizSubjects}
        required={Math.max(1, settings.quizQuestions)}
        title={TRIGGER_TITLES[pending.trigger]}
        onPass={() => finish(true)}
        onCancel={() => finish(false)}
      />
    );
  }, [pending, finish]);

  // その場面でクイズが出る設定か（ボタンの表示文言用）
  const isQuizRequired = useCallback((trigger: QuizTrigger) => shouldQuiz(getAppSettings(), trigger), []);

  return { ask, overlay, isQuizRequired };
}

export type QuizGate = ReturnType<typeof useQuizGate>;
