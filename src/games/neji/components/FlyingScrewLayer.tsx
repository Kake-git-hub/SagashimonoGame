import { useEffect, useState } from 'react';
import { ScrewColor } from '../types';
import { ANIM } from '../constants';
import { ScrewIcon } from './ScrewIcon';

export interface Point {
  x: number;
  y: number;
}

export interface Flight {
  id: string;
  color: ScrewColor;
  from: Point;
  to: Point | null; // null は行き先なし（失敗時に落ちる）
}

interface Props {
  flights: Flight[];
  onDone: (id: string) => void;
}

function FlyingScrew({ flight, onDone }: { flight: Flight; onDone: (id: string) => void }) {
  const [pos, setPos] = useState<Point>(flight.from);

  useEffect(() => {
    if (!flight.to) {
      const timer = window.setTimeout(() => onDone(flight.id), 700);
      return () => window.clearTimeout(timer);
    }
    // 次のフレームで行き先へ（CSS transition で移動）
    const raf = requestAnimationFrame(() => setPos(flight.to!));
    const timer = window.setTimeout(() => onDone(flight.id), ANIM.FLY_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [flight, onDone]);

  return (
    <div className={flight.to ? 'neji-fly' : 'neji-drop'} style={{ left: pos.x, top: pos.y }}>
      <ScrewIcon color={flight.color} size={26} />
    </div>
  );
}

export function FlyingScrewLayer({ flights, onDone }: Props) {
  if (flights.length === 0) return null;
  return (
    <div className="neji-fly-layer">
      {flights.map(f => (
        <FlyingScrew key={f.id} flight={f} onDone={onDone} />
      ))}
    </div>
  );
}
