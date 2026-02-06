import { Target, HintState, getHintRadius, normalizePosition, Position, isPolygonPosition, getPolygonCenter, CirclePosition } from '../types';

interface Props {
  target: Target;
  hintState: HintState;
  getPosition: (x: number, y: number, offset?: [number, number]) => { x: number; y: number } | null;
  scaleFactor: number; // 1000スケールをピクセルに変換する係数
}

export function HintOverlay({ target, hintState, getPosition, scaleFactor }: Props) {
  // 指定された位置のヒントを表示
  const rawPosition = target.positions[hintState.positionIndex];
  if (!rawPosition) return null;
  
  const targetPosition = normalizePosition(rawPosition as Position | [number, number]);
  
  // ポリゴンの場合は中心点を使用
  let hintX: number, hintY: number;
  if (isPolygonPosition(targetPosition)) {
    const center = getPolygonCenter(targetPosition);
    hintX = center.x;
    hintY = center.y;
  } else {
    const circlePos = targetPosition as CirclePosition;
    hintX = circlePos.x;
    hintY = circlePos.y;
  }

  // オフセット付きで位置を計算
  const pos = getPosition(
    hintX,
    hintY,
    hintState.centerOffset
  );
  if (!pos) return null;

  // レベルに応じた半径（画像の半分から半減）
  const hintRadius = getHintRadius(hintState.level);
  // 実際の表示サイズ（ピクセル）
  const sizePixels = hintRadius * scaleFactor * 2; // 直径
  
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
          width: `${sizePixels}px`,
          height: `${sizePixels}px`,
        }} 
      />
      {/* 中心の点 */}
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
};

// CSSアニメーションはApp.cssに定義
