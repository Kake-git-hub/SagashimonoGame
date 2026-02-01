import { Target, HintState, CONSTANTS } from '../types';

interface Props {
  target: Target;
  hintState: HintState;
  getPosition: (target: Target, offset?: [number, number]) => { x: number; y: number } | null;
}

export function HintOverlay({ target, hintState, getPosition }: Props) {
  const pos = getPosition(target, hintState.centerOffset);
  if (!pos) return null;

  // レベルに応じた半径（0-1000スケールでの半径）
  const hintRadius = CONSTANTS.HINT_RADII[hintState.level];
  // 実際の表示サイズはgetPositionの変換に依存するので、
  // ここでは割合として渡す（親コンポーネントで計算）
  const sizePercent = (hintRadius / CONSTANTS.SCALE) * 100;
  
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
          width: `${sizePercent * 2}%`,  // 直径
          height: `${sizePercent * 2}%`,
        }} 
      />
      {/* 中心の点は小さいまま */}
      <div style={styles.pulseInner} />
      {/* レベル表示 */}
      {hintState.level > 0 && (
        <div style={styles.levelBadge}>
          Lv.{hintState.level + 1}
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
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    border: '3px solid #ffc107',
    animation: 'hintPulse 1s ease-out infinite',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '60px',
    minHeight: '60px',
  },
  pulseInner: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    backgroundColor: '#ffc107',
    boxShadow: '0 0 20px rgba(255, 193, 7, 0.8)',
  },
  levelBadge: {
    position: 'absolute',
    top: '-20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#ff5722',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
  },
};

// CSSアニメーションはApp.cssに定義
