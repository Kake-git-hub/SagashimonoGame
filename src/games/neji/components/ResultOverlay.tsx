import { useEffect, useRef } from 'react';
import { playClearConfetti } from '../../../utils/confetti';

export interface TreasureResult {
  name: string;
  emoji: string;
  isNew: boolean; // 初めて手に入れた
}

interface Props {
  kind: 'cleared' | 'failed';
  stageName: string;
  moves: number;
  hasNext: boolean;
  treasure?: TreasureResult | null;
  canContinue: boolean;        // 失敗から少し前に戻れるか
  continueLabel?: string;
  nextLabel?: string;
  onNext: () => void;
  onContinue: () => void;
  onRetry: () => void;
  onBack: () => void;
}

export function ResultOverlay({
  kind, stageName, moves, hasNext, treasure, canContinue,
  continueLabel = 'つづきから', nextLabel = 'つぎのステージへ →',
  onNext, onContinue, onRetry, onBack,
}: Props) {
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
        <div style={styles.emoji}>{cleared ? (treasure ? treasure.emoji : '🎉') : '😢'}</div>
        <h2 style={styles.title}>{cleared ? (treasure ? 'はっけん！' : 'おめでとう！') : 'ざんねん…'}</h2>
        <p style={styles.subtitle}>
          {cleared ? (
            treasure ? (
              <>
                「{treasure.name}」が でてきた！<br />
                <span className="neji-treasure-found">
                  {treasure.isNew ? '✨ たからばこに はいったよ' : '🏆 たからばこに ついかしたよ'}
                </span>
                <br /><span style={styles.moves}>{moves} かい</span>
              </>
            ) : (
              <>「{stageName}」の<br />ネジをぜんぶはずしたよ！<br /><span style={styles.moves}>{moves} かい</span></>
            )
          ) : (
            <>おきばが いっぱいに<br />なっちゃった…</>
          )}
        </p>

        <div style={styles.buttons}>
          {cleared && hasNext && (
            <button onClick={onNext} style={styles.nextButton}>
              {nextLabel}
            </button>
          )}
          {!cleared && canContinue && (
            <button onClick={onContinue} style={styles.nextButton}>
              {continueLabel}
            </button>
          )}
          <button onClick={onRetry} style={cleared || canContinue ? styles.retryButton : styles.nextButton}>
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
    padding: '30px 26px',
    textAlign: 'center',
    maxWidth: '90%',
    width: '350px',
    maxHeight: '92dvh',
    overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
    animation: 'modalBounce 0.5s ease-out',
  },
  emoji: {
    fontSize: '4rem',
    marginBottom: '6px',
    lineHeight: 1.2,
  },
  title: {
    fontSize: '2rem',
    color: '#333',
    margin: '0 0 10px 0',
  },
  subtitle: {
    fontSize: '1.1rem',
    color: '#666',
    margin: '0 0 24px 0',
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
    fontFamily: 'inherit',
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
    fontFamily: 'inherit',
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
    fontFamily: 'inherit',
  },
};
