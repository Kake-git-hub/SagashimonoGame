import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

interface Props {
  puzzleName: string;
  onBack: () => void;
  onNextPuzzle: () => void;
  onRetry: () => void;
  hasNextPuzzle: boolean;
}

export function ClearOverlay({ puzzleName, onBack, onNextPuzzle, onRetry, hasNextPuzzle }: Props) {
  const hasShownConfetti = useRef(false);

  useEffect(() => {
    if (hasShownConfetti.current) return;
    hasShownConfetti.current = true;

    // 紙吹雪アニメーション
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    // 初回の派手な演出
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.5, y: 0.5 },
    });
  }, []);

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.emoji}>🎉</div>
        <h2 style={styles.title}>おめでとう！</h2>
        <p style={styles.subtitle}>
          「{puzzleName}」を<br />ぜんぶみつけたよ！
        </p>

        <div style={styles.buttons}>
          {hasNextPuzzle && (
            <button onClick={onNextPuzzle} style={styles.nextButton}>
              つぎのパズルへ →
            </button>
          )}
          <button onClick={onRetry} style={styles.retryButton}>
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
