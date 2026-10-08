import { useCallback, useEffect, useMemo, useState } from 'react';
import { QuizSubject } from '../../services/appSettingsService';
import { generateQuestion, QuizQuestion } from '../../services/quizService';

interface Props {
  level: number;                 // 1〜5
  subjects: readonly QuizSubject[];
  required: number;              // 正解が必要な数
  title?: string;                // 何のためのクイズか（「はこを ふやす」など）
  onPass: () => void;
  onCancel: () => void;
}

type Phase = 'ask' | 'correct' | 'wrong';

const CORRECT_MS = 900;
const WRONG_MS = 1400;

/**
 * べんきょうクイズ（画面切り替えで出す全画面オーバーレイ）
 * 正解すると onPass、「やめる」で onCancel
 */
export function QuizOverlay({ level, subjects, required, title, onPass, onCancel }: Props) {
  const [seed, setSeed] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [picked, setPicked] = useState<number | null>(null);

  const question: QuizQuestion = useMemo(
    () => generateQuestion(level, subjects),
    // seed が変わるたびに新しい問題
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [level, subjects, seed],
  );

  const handlePick = useCallback((index: number) => {
    if (phase !== 'ask') return;
    setPicked(index);
    setPhase(index === question.answerIndex ? 'correct' : 'wrong');
  }, [phase, question.answerIndex]);

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

  return (
    <div style={styles.overlay} role="dialog" aria-label="べんきょうクイズ">
      <div style={styles.modal}>
        <div style={styles.header}>
          <span style={styles.badge}>✏️ クイズ</span>
          {title && <span style={styles.purpose}>{title}</span>}
          {required > 1 && <span style={styles.progress}>{correctCount} / {required}</span>}
        </div>

        <div style={{ ...styles.prompt, ...(question.big ? styles.promptBig : {}) }}>
          {lines.map((line, i) => (
            <div key={i} style={i === 0 && question.big ? styles.emojiLine : undefined}>{line}</div>
          ))}
        </div>

        <div style={styles.choices}>
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
                style={{ ...styles.choice, ...extra }}
                disabled={phase !== 'ask'}
              >
                {choice}
              </button>
            );
          })}
        </div>

        <div style={styles.feedback} aria-live="polite">
          {phase === 'correct' && <span style={styles.feedbackGood}>⭕ せいかい！</span>}
          {phase === 'wrong' && <span style={styles.feedbackBad}>❌ ざんねん… もういちど！</span>}
        </div>

        <button onClick={onCancel} style={styles.cancel}>やめる</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(20, 24, 50, 0.82)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    zIndex: 150,
    animation: 'fadeIn 0.25s ease-out',
  },
  modal: {
    width: '100%',
    maxWidth: '460px',
    backgroundColor: 'white',
    borderRadius: '26px',
    padding: '22px 20px 18px',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
    animation: 'modalBounce 0.4s ease-out',
    maxHeight: '92dvh',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginBottom: '14px',
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: '#fff3e0',
    color: '#e65100',
    fontWeight: 'bold',
    padding: '4px 12px',
    borderRadius: '16px',
    fontSize: '0.95rem',
  },
  purpose: {
    color: '#666',
    fontSize: '0.95rem',
  },
  progress: {
    color: '#999',
    fontSize: '0.9rem',
  },
  prompt: {
    fontSize: '1.9rem',
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 1.4,
    margin: '6px 0 18px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  promptBig: {
    fontSize: '1.3rem',
  },
  emojiLine: {
    fontSize: '2.2rem',
    lineHeight: 1.3,
    letterSpacing: '2px',
    marginBottom: '8px',
  },
  choices: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  choice: {
    padding: '14px 16px',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    borderRadius: '18px',
    border: '3px solid #e0e0e0',
    backgroundColor: '#fafafa',
    color: '#333',
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '1px',
    wordBreak: 'break-word',
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
    minHeight: '32px',
    marginTop: '14px',
    fontSize: '1.2rem',
    fontWeight: 'bold',
  },
  feedbackGood: { color: '#2e7d32' },
  feedbackBad: { color: '#c62828' },
  cancel: {
    marginTop: '6px',
    padding: '8px 18px',
    fontSize: '0.9rem',
    backgroundColor: 'transparent',
    color: '#999',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'underline',
  },
};
