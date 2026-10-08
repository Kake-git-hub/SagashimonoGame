import { ScrewColor } from '../types';
import { SCREW_COLOR_HEX, SCREW_COLOR_NAME } from '../constants';
import { BoxSlot } from '../logic/rules';
import { ScrewIcon } from './ScrewIcon';

export interface DepartingBox {
  uid: number;
  position: number;
  color: ScrewColor;
  filled: number;
  ready: boolean; // 飛んでくるネジが全部届いたら退場開始
}

interface BoxViewProps {
  box: BoxSlot;
  capacity: number;
  hidden: ReadonlySet<string>;
  className?: string;
}

function BoxView({ box, capacity, hidden, className = '' }: BoxViewProps) {
  return (
    <div
      className={`neji-box ${className}`}
      style={{ '--box-color': SCREW_COLOR_HEX[box.color] } as React.CSSProperties}
      data-box-uid={box.uid}
      aria-label={`${SCREW_COLOR_NAME[box.color]}のはこ ${box.filled}/${capacity}`}
    >
      {Array.from({ length: capacity }, (_, slot) => {
        const key = `box:${box.uid}:${slot}`;
        const filled = slot < box.filled && !hidden.has(key);
        return (
          <div key={slot} className={`neji-hole ${filled ? 'neji-hole-filled' : ''}`} data-hole={key}>
            {filled && <ScrewIcon color={box.color} size={22} />}
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  boxes: (BoxSlot | null)[];
  capacity: number;
  hidden: ReadonlySet<string>;
  departing: DepartingBox[];
  // おたすけ「＋はこ」。null なら表示しない
  onAddBox: (() => void) | null;
  addBoxLabel?: string;
}

export function BoxHud({ boxes, capacity, hidden, departing, onAddBox, addBoxLabel = '＋はこ' }: Props) {
  return (
    <div className="neji-boxes">
      {boxes.map((box, position) => (
        <div className="neji-box-slot" key={position} data-box-position={position}>
          {box ? (
            <BoxView key={box.uid} box={box} capacity={capacity} hidden={hidden} />
          ) : (
            <div className="neji-box neji-box-empty" />
          )}
          {departing
            .filter(d => d.position === position)
            .map(d => (
              <BoxView
                key={`departing-${d.uid}`}
                box={{ uid: d.uid, color: d.color, filled: d.filled }}
                capacity={capacity}
                hidden={hidden}
                className={`neji-box-overlay ${d.ready ? 'departing' : ''}`}
              />
            ))}
        </div>
      ))}
      {onAddBox && (
        <button className="neji-help-button" onClick={onAddBox} aria-label="はこをふやす">
          {addBoxLabel}
        </button>
      )}
    </div>
  );
}
