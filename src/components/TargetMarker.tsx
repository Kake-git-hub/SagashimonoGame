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
        animation: isNew ? 'markerBounce 0.5s ease-out' : undefined,
      }}
    >
      <span style={styles.arrow}>▼</span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  marker: {
    position: 'absolute',
    transform: 'translate(-50%, -100%)',
    pointerEvents: 'none',
    zIndex: 10,
  },
  arrow: {
    display: 'block',
    fontSize: '2rem',
    color: '#ff5722',
    textShadow: '0 2px 4px rgba(0,0,0,0.5), 0 0 10px rgba(255, 87, 34, 0.5)',
    filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))',
  },
};

// CSSアニメーションはApp.cssに定義
