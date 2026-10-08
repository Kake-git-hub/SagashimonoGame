import { useEffect, useRef } from 'react';
import { playClearConfetti } from '../../../utils/confetti';
import { useTapGuard } from '../../../hooks/useTapGuard';

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
  continueQuiz: boolean;       // つづきから にクイズが要るか
  nextQuiz: boolean;           // つぎのステージ にクイズが要るか
  rewindMoves: number;
  onNext: () => void;
  onContinue: () => void;
  onRetry: () => void;
  onBack: () => void;
}

export function ResultOverlay({
  kind, stageName, moves, hasNext, treasure, canContinue, continueQuiz, nextQuiz, rewindMoves,
  onNext, onContinue, onRetry, onBack,
}: Props) {
  const hasShownConfetti = useRef(false);
  // 出た直後の連打は無視する（ゲーム中の連打で画面がすぐ変わらないように）
  const ready = useTapGuard();

  useEffect(() => {
    if (kind !== 'cleared' || hasShownConfetti.current) return;
    hasShownConfetti.current = true;
    playClearConfetti();
  }, [kind]);

  const cleared = kind === 'cleared';
  const buttonStyle = (base: React.CSSProperties): React.CSSProperties => ({
    ...base,
    opacity: ready ? 1 : 0.55,
    pointerEvents: ready ? 'auto' : 'none',
  });

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.emoji}>{cleared ? (treasure ? treasure.emoji : '🎉') : '😣'}</div>
        <h2 style={styles.title}>{cleared ? (treasure ? 'はっけん！' : 'おめでとう！') : 'おきばが いっぱい！'}</h2>
        <p style={styles.subtitle}>
          {cleared ? (
            treasure ? (
              <>
                「{treasure.name}」を<br />たからばこに {treasure.isNew ? 'いれたよ ✨' : 'ついかしたよ 🎁'}
                <br /><span style={styles.moves}>{moves} かい</span>
              </>
            ) : (
              <>「{stageName}」の<br />ネジをぜんぶはずしたよ！<br /><span style={styles.moves}>{moves} かい</span></>
            )
          ) : (
            <>
              おなじいろの はこが ないネジは<br />おきばに おくよ。<br />
              おきばが いっぱいになると ゲームオーバー。
            </>
          )}
        </p>

        <div style={styles.buttons}>
          {cleared && hasNext && (
            <button onClick={onNext} style={buttonStyle(styles.nextButton)} disabled={!ready}>
              <span style={styles.buttonMain}>{nextQuiz ? '✏️ ' : ''}つぎのステージへ →</span>
              {nextQuiz && <span style={styles.buttonSub}>クイズに せいかいすると すすめる</span>}
            </button>
          )}
          {!cleared && canContinue && (
            <button onClick={onContinue} style={buttonStyle(styles.nextButton)} disabled={!ready}>
              <span style={styles.buttonMain}>{continueQuiz ? '✏️ ' : '⏪ '}つづきから</span>
              <span style={styles.buttonSub}>
                {rewindMoves} てまえに もどって やりなおす{continueQuiz ? '（クイズに せいかいしたら）' : ''}
              </span>
            </button>
          )}
          <button onClick={onRetry} style={buttonStyle(cleared || canContinue ? styles.retryButton : styles.nextButton)} disabled={!ready}>
            <span style={styles.buttonMain}>🔄 さいしょから</span>
            {!cleared && <span style={styles.buttonSub}>このステージを はじめから やりなおす</span>}
          </button>
          <button onClick={onBack} style={buttonStyle(styles.backButton)} disabled={!ready}>
            <span style={styles.buttonMain}>📋 ステージいちらんへ</span>
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
    padding: '26px 24px',
    textAlign: 'center',
    maxWidth: '92%',
    width: '380px',
    maxHeight: '92dvh',
    overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
    animation: 'modalBounce 0.5s ease-out',
  },
  emoji: {
    fontSize: '3.6rem',
    marginBottom: '4px',
    lineHeight: 1.2,
  },
  title: {
    fontSize: '1.8rem',
    color: '#333',
    margin: '0 0 10px 0',
  },
  subtitle: {
    fontSize: '1.02rem',
    color: '#666',
    margin: '0 0 20px 0',
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
  buttonMain: {
    display: 'block',
    fontSize: '1.15rem',
    fontWeight: 'bold',
  },
  buttonSub: {
    display: 'block',
    marginTop: '3px',
    fontSize: '0.8rem',
    fontWeight: 'normal',
    opacity: 0.9,
  },
  nextButton: {
    padding: '13px 20px',
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    borderRadius: '30px',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(76, 175, 80, 0.4)',
    fontFamily: 'inherit',
    transition: 'opacity 0.3s',
  },
  retryButton: {
    padding: '11px 20px',
    backgroundColor: '#ff9800',
    color: 'white',
    border: 'none',
    borderRadius: '25px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.3s',
  },
  backButton: {
    padding: '11px 20px',
    backgroundColor: '#e0e0e0',
    color: '#333',
    border: 'none',
    borderRadius: '25px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.3s',
  },
};
