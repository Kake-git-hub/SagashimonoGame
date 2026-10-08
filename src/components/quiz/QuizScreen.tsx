import { useCallback, useEffect, useMemo, useState } from 'react';
import { generateQuestion, QuizQuestion } from '../../services/quiz';
import { useIsLandscape } from '../../hooks/useMediaQuery';
import { useTapGuard } from '../../hooks/useTapGuard';

interface Props {
  level: number;                 // 1〜5
  subjects: readonly string[];   // 空ならレベルに合わせて自動
  required: number;              // 正解が必要な数
  title?: string;                // 何のためのクイズか（「はこを ふやす」など）
  onPass: () => void;
  onCancel: () => void;
}

type Phase = 'ask' | 'correct' | 'wrong';

const CORRECT_MS = 900;
const WRONG_MS = 1400;

/**
 * べんきょうクイズ（画面を切り替えて全面に大きく出す）
 * 正解すると onPass、「やめる」で onCancel
 */
export function QuizScreen({ level, subjects, required, title, onPass, onCancel }: Props) {
  const [seed, setSeed] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [picked, setPicked] = useState<number | null>(null);
  const isLandscape = useIsLandscape();
  // 出た直後の連打は無視する
  const ready = useTapGuard();

  const question: QuizQuestion = useMemo(
    () => generateQuestion(level, subjects),
    // seed が変わるたびに新しい問題
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [level, subjects, seed],
  );

  const handlePick = useCallback((index: number) => {
    if (phase !== 'ask' || !ready) return;
    setPicked(index);
    setPhase(index === question.answerIndex ? 'correct' : 'wrong');
  }, [phase, ready, question.answerIndex]);

  // 正解 / 不正解の表示が終わったら次へ
  useEffect(() => {
    if (phase === 'ask') return;
    const timer = window.setTimeout(() => {
      if (phase === 'correct') {
        const next = correctCount + 1;
        if (next >= required) {
          onPass();
          return;
        }
        setCorrectCount(next);
      }
      setPicked(null);
      setPhase('ask');
      setSeed(s => s + 1);
    }, phase === 'correct' ? CORRECT_MS : WRONG_MS);
    return () => window.clearTimeout(timer);
  }, [phase, correctCount, required, onPass]);

  const lines = question.prompt.split('\n');
  const wide = isLandscape;

  return (
    <div style={styles.screen} role="dialog" aria-label="べんきょうクイズ">
      <header style={styles.header}>
        <span style={styles.badge}>✏️ べんきょうクイズ</span>
        {title && <span style={styles.purpose}>{title}</span>}
        {required > 1 && <span style={styles.progress}>{correctCount} / {required} もん</span>}
      </header>

      <div style={{ ...styles.body, flexDirection: wide ? 'row' : 'column' }}>
        <div style={{ ...styles.prompt, ...(question.big ? styles.promptBig : {}), flex: wide ? 1 : undefined }}>
          {lines.map((line, i) => (
            <div key={i} style={i === 0 && question.big ? styles.emojiLine : undefined}>{line}</div>
          ))}
        </div>

        <div style={{ ...styles.choices, flex: wide ? 1 : undefined, width: wide ? undefined : '100%' }}>
          {question.choices.map((choice, index) => {
            let extra: React.CSSProperties = {};
            if (phase !== 'ask') {
              if (index === question.answerIndex) extra = styles.choiceCorrect;
              else if (index === picked) extra = styles.choiceWrong;
              else extra = styles.choiceDim;
            }
            return (
              <button
                key={`${seed}-${index}`}
                onClick={() => handlePick(index)}
                style={{ ...styles.choice, ...extra, opacity: ready ? extra.opacity ?? 1 : 0.6 }}
                disabled={phase !== 'ask' || !ready}
              >
                {choice}
              </button>
            );
          })}
        </div>
      </div>

      <div style={styles.feedback} aria-live="polite">
        {phase === 'correct' && <span style={styles.feedbackGood}>⭕ せいかい！</span>}
        {phase === 'wrong' && <span style={styles.feedbackBad}>❌ ざんねん… もういちど！</span>}
      </div>

      <button onClick={onCancel} style={styles.cancel} disabled={!ready}>やめる</button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  screen: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 'calc(10px + env(safe-area-inset-top, 0px)) 16px calc(12px + env(safe-area-inset-bottom, 0px))',
    background: 'linear-gradient(160deg, #fff7d6 0%, #ffe6ee 50%, #e3f2ff 100%)',
    zIndex: 150,
    overflowY: 'auto',
    animation: 'fadeIn 0.25s ease-out',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    flexShrink: 0,
    marginBottom: '8px',
  },
  badge: {
    backgroundColor: '#fff3e0',
    color: '#e65100',
    fontWeight: 'bold',
    padding: '6px 16px',
    borderRadius: '20px',
    fontSize: '1.05rem',
    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
  },
  purpose: {
    color: '#666',
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  progress: {
    color: '#999',
    fontSize: '0.95rem',
  },
  body: {
    flex: 1,
    width: '100%',
    maxWidth: '980px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
    minHeight: 0,
  },
  prompt: {
    fontSize: 'clamp(2.2rem, 7vw, 4rem)',
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 1.3,
    textAlign: 'center',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    padding: '8px 0',
  },
  promptBig: {
    fontSize: 'clamp(1.4rem, 4vw, 2rem)',
  },
  emojiLine: {
    fontSize: 'clamp(2.4rem, 7vw, 3.6rem)',
    lineHeight: 1.3,
    letterSpacing: '4px',
    marginBottom: '10px',
  },
  choices: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    maxWidth: '520px',
  },
  choice: {
    padding: '18px 20px',
    fontSize: 'clamp(1.6rem, 4.5vw, 2.4rem)',
    fontWeight: 'bold',
    borderRadius: '22px',
    border: '4px solid #e0e0e0',
    backgroundColor: 'white',
    color: '#333',
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '2px',
    wordBreak: 'break-word',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
  choiceCorrect: {
    borderColor: '#4caf50',
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    opacity: 1,
  },
  choiceWrong: {
    borderColor: '#e53935',
    backgroundColor: '#ffebee',
    color: '#c62828',
    opacity: 1,
  },
  choiceDim: {
    opacity: 0.45,
  },
  feedback: {
    minHeight: '40px',
    marginTop: '8px',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    flexShrink: 0,
  },
  feedbackGood: { color: '#2e7d32' },
  feedbackBad: { color: '#c62828' },
  cancel: {
    marginTop: '4px',
    padding: '8px 20px',
    fontSize: '0.95rem',
    backgroundColor: 'transparent',
    color: '#999',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'underline',
    flexShrink: 0,
  },
};
