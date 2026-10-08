import { BufferItem } from '../logic/rules';
import { ScrewIcon } from './ScrewIcon';

interface Props {
  slots: (BufferItem | null)[];
  hidden: ReadonlySet<string>;
  // おたすけ「＋おきば」。null なら表示しない
  onAddSlot: (() => void) | null;
  addSlotLabel?: string;
}

export function BufferHud({ slots, hidden, onAddSlot, addSlotLabel = '＋おきば' }: Props) {
  const used = slots.filter(s => s !== null).length;
  const warn = slots.length > 0 && used >= slots.length - 1;
  return (
    <div className={`neji-buffer ${warn ? 'warn' : ''}`} aria-label={`おきば ${used}/${slots.length}`}>
      <span className="neji-buffer-label">おきば</span>
      <div className="neji-buffer-holes">
        {slots.map((item, slot) => {
          const key = `buffer:${slot}`;
          const filled = item !== null && !hidden.has(key);
          return (
            <div key={slot} className={`neji-hole ${filled ? 'neji-hole-filled' : ''}`} data-hole={key}>
              {filled && item && <ScrewIcon color={item.color} size={24} />}
            </div>
          );
        })}
      </div>
      {onAddSlot && (
        <button className="neji-help-button" onClick={onAddSlot} aria-label="おきばをふやす">
          {addSlotLabel}
        </button>
      )}
    </div>
  );
}
