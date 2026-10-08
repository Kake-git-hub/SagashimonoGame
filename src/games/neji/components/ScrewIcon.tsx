import { ScrewColor } from '../types';
import { SCREW_COLOR_HEX, SCREW_COLOR_NAME } from '../constants';

interface Props {
  color: ScrewColor;
  size?: number;
}

// 六角の頭を上から見たネジのアイコン（HUD・飛ぶ演出用）
export function ScrewIcon({ color, size = 22 }: Props) {
  const hex = SCREW_COLOR_HEX[color];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={SCREW_COLOR_NAME[color]}>
      <polygon
        points="12,1.5 21.1,6.75 21.1,17.25 12,22.5 2.9,17.25 2.9,6.75"
        fill={hex}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="1"
      />
      <path d="M7.5 12h9M12 7.5v9" stroke="#222" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
