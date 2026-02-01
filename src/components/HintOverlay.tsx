import { Target } from '../types';

interface Props {
  target: Target;
  getPosition: (target: Target) => { x: number; y: number } | null;
}

export function HintOverlay({ target, getPosition }: Props) {
  const pos = getPosition(target);
  if (!pos) return null;

  return (
    <div
      style={{
        ...styles.hint,
        left: pos.x,
        top: pos.y,
      }}
    >
      <div style={styles.pulse} />
      <div style={styles.pulseInner} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hint: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: 20,
  },
  pulse: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 193, 7, 0.3)',
    border: '3px solid #ffc107',
    animation: 'hintPulse 1s ease-out infinite',
  },
  pulseInner: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#ffc107',
    boxShadow: '0 0 20px rgba(255, 193, 7, 0.8)',
  },
};

// CSSアニメーションはApp.cssに定義
