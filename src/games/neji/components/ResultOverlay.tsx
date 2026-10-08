import { useEffect, useRef } from 'react';
import { playClearConfetti } from '../../../utils/confetti';

interface Props {
  kind: 'cleared' | 'failed';
  stageName: string;
  moves: number;
  hasNext: boolean;
  onNext: () => void;
  onRetry: () => void;
  onBack: () => void;
}

export function ResultOverlay({ kind, stageName, moves, hasNext, onNext, onRetry, onBack }: Props) {
  const hasShownConfetti = useRef(false);

  useEffect(() => {
    if (kind !== 'cleared' || hasShownConfetti.current) return;
    hasShownConfetti.current = true;
    playClearConfetti();
  }, [kind]);

  const cleared = kind === 'cleared';

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.emoji}>{cleared ? '🎉' : '😢'}</div>
        <h2 style={styles.title}>{cleared ? 'おめでとう！' : 'ざんねん…'}</h2>
        <p style={styles.subtitle}>
          {cleared ? (
            <>「{stageName}」の<br />ネジをぜんぶはずしたよ！<br /><span style={styles.moves}>{moves} かい</span></>
          ) : (
            <>おきばが いっぱいに<br />なっちゃった…</>
          )}
        </p>

        <div style={styles.buttons}>
          {cleared && hasNext && (
            <button onClick={onNext} style={styles.nextButton}>
              つぎのステージへ →
            </button>
          )}
          <button onClick={onRetry} style={cleared ? styles.retryButton : styles.nextButton}>
            🔄 もういちど
          </button>
          <button onClick={onBack} style={styles.backButton}>
            📋 いちらんへ
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    animation: 'fadeIn 0.3s ease-out',
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '24px',
    padding: '40px 30px',
    textAlign: 'center',
    maxWidth: '90%',
    width: '350px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
    animation: 'modalBounce 0.5s ease-out',
  },
  emoji: {
    fontSize: '4rem',
    marginBottom: '10px',
  },
  title: {
    fontSize: '2rem',
    color: '#333',
    margin: '0 0 10px 0',
  },
  subtitle: {
    fontSize: '1.1rem',
    color: '#666',
    margin: '0 0 30px 0',
    lineHeight: 1.6,
  },
  moves: {
    display: 'inline-block',
    marginTop: '6px',
    fontSize: '0.95rem',
    color: '#999',
  },
  buttons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  nextButton: {
    padding: '15px 30px',
    fontSize: '1.2rem',
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    borderRadius: '30px',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '0 4px 15px rgba(76, 175, 80, 0.4)',
  },
  retryButton: {
    padding: '12px 25px',
    fontSize: '1rem',
    backgroundColor: '#ff9800',
    color: 'white',
    border: 'none',
    borderRadius: '25px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  backButton: {
    padding: '12px 25px',
    fontSize: '1rem',
    backgroundColor: '#e0e0e0',
    color: '#333',
    border: 'none',
    borderRadius: '25px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
};
