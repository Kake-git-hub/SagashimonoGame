import { CSSProperties } from 'react';
import { MarkerSize, getMarkerPixelSize } from '../types';

interface Props {
  x: number;
  y: number;
  isNew?: boolean;
  size?: MarkerSize;
}

export function TargetMarker({ x, y, isNew = false, size = 'medium' }: Props) {
  const pixelSize = getMarkerPixelSize(size);
  
  return (
    <div
      style={{
        ...styles.marker,
        left: x,
        top: y,
        animation: isNew ? 'markerPop 0.4s ease-out' : undefined,
      }}
    >
      <div style={{
        ...styles.circle,
        width: `${pixelSize}px`,
        height: `${pixelSize}px`,
        borderWidth: pixelSize >= 32 ? '4px' : '2px',
      }} />
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
    borderRadius: '50%',
    borderStyle: 'solid',
    borderColor: '#4caf50',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    boxShadow: '0 0 10px rgba(76, 175, 80, 0.6), inset 0 0 10px rgba(76, 175, 80, 0.3)',
  },
};

// CSSアニメーションはApp.cssに定義
