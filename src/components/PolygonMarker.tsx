import { useEffect, useState } from 'react';

interface Props {
  points: { x: number; y: number }[];
  isNew?: boolean;
}

export function PolygonMarker({ points, isNew = false }: Props) {
  const [animating, setAnimating] = useState(isNew);

  useEffect(() => {
    if (isNew) {
      setAnimating(true);
      const timer = setTimeout(() => setAnimating(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  if (points.length < 3) return null;

  // バウンディングボックスを計算
  const minX = Math.min(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxX = Math.max(...points.map(p => p.x));
  const maxY = Math.max(...points.map(p => p.y));
  const width = maxX - minX + 20;
  const height = maxY - minY + 20;

  // ポリゴンのパスを生成
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x - minX + 10} ${p.y - minY + 10}`)
    .join(' ') + ' Z';

  return (
    <svg
      style={{
        position: 'absolute',
        left: minX - 10,
        top: minY - 10,
        width,
        height,
        pointerEvents: 'none',
        overflow: 'visible',
        animation: animating ? 'polygonPop 0.5s ease-out' : 'none',
      }}
    >
      <defs>
        <style>{`
          @keyframes polygonPop {
            0% { transform: scale(0.5); opacity: 0; }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </defs>
      <path
        d={pathD}
        fill="rgba(76, 175, 80, 0.3)"
        stroke="#4caf50"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
