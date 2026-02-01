import { Target, HintState, CONSTANTS, getHintRadius } from '../types';

interface Props {
  target: Target;
  hintState: HintState;
  getPosition: (target: Target, offset?: [number, number]) => { x: number; y: number } | null;
}

export function HintOverlay({ target, hintState, getPosition }: Props) {
  // 指定された位置のヒントを表示
  const targetPosition = target.positions[hintState.positionIndex];
  if (!targetPosition) return null;

  // オフセット付きで位置を計算
  const pos = getPosition(
    { ...target, positions: [targetPosition] },
    hintState.centerOffset
  );
  if (!pos) return null;

  // レベルに応じた半径（画像の半分から半減）
  const hintRadius = getHintRadius(hintState.level);
  // 実際の表示サイズ（パーセント）
  const sizePercent = (hintRadius / CONSTANTS.SCALE) * 100 * 2; // 直径
  
  return (
    <div
      style={{
        ...styles.hint,
        left: pos.x,
        top: pos.y,
      }}
    >
      <div 
        style={{
          ...styles.pulse,
          width: `${sizePercent}%`,
          height: `${sizePercent}%`,
        }} 
      />
      {/* 中心の点 */}
      <div style={styles.pulseInner} />
      {/* レベル表示 */}
      {hintState.level > 0 && (
        <div style={styles.levelBadge}>
          ×{Math.pow(2, hintState.level)}
        </div>
      )}
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
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    border: '3px solid #ffc107',
    animation: 'hintPulse 1s ease-out infinite',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '50px',
    minHeight: '50px',
  },
  pulseInner: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#ffc107',
    boxShadow: '0 0 15px rgba(255, 193, 7, 0.8)',
  },
  levelBadge: {
    position: 'absolute',
    top: '-24px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#ff5722',
    color: 'white',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
  },
};

// CSSアニメーションはApp.cssに定義
