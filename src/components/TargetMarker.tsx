import { CSSProperties } from 'react';

interface Props {
  x: number;
  y: number;
  isNew?: boolean;
}

export function TargetMarker({ x, y, isNew = false }: Props) {
  return (
    <div
      style={{
        ...styles.marker,
        left: x,
        top: y,
        animation: isNew ? 'markerPop 0.4s ease-out' : undefined,
      }}
    >
      <div style={styles.circle} />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  marker: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: 10,
  },
  circle: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '4px solid #4caf50',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    boxShadow: '0 0 10px rgba(76, 175, 80, 0.6), inset 0 0 10px rgba(76, 175, 80, 0.3)',
  },
};

// CSSアニメーションはApp.cssに定義
