interface Props {
  size?: number;
  open?: boolean;   // ふたが開いて光っている
  className?: string;
}

/**
 * 宝箱のアイコン（絵文字に宝箱が無いので SVG で描く）
 */
export function TreasureChestIcon({ size = 48, open = false, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {open && (
        <g fill="#ffe66d" opacity="0.9">
          <polygon points="32,2 35,12 29,12" />
          <polygon points="14,8 22,15 17,18" />
          <polygon points="50,8 42,15 47,18" />
          <circle cx="32" cy="20" r="3" fill="#fff6b0" />
        </g>
      )}
      {/* ふた */}
      <path
        d={open ? 'M8 30 L8 26 Q8 12 32 12 Q56 12 56 26 L56 30 Z' : 'M8 32 L8 28 Q8 14 32 14 Q56 14 56 28 L56 32 Z'}
        fill="#b5651d"
        stroke="#7a3f0e"
        strokeWidth="3"
        strokeLinejoin="round"
        transform={open ? 'rotate(-14 32 30)' : undefined}
      />
      <path
        d={open ? 'M20 12.5 L20 30 M44 12.5 L44 30' : 'M20 14.5 L20 32 M44 14.5 L44 32'}
        stroke="#ffd166"
        strokeWidth="4"
        transform={open ? 'rotate(-14 32 30)' : undefined}
      />
      {/* 箱 */}
      <rect x="8" y="32" width="48" height="24" rx="3" fill="#c97a2b" stroke="#7a3f0e" strokeWidth="3" />
      <rect x="18" y="32" width="4" height="24" fill="#ffd166" />
      <rect x="42" y="32" width="4" height="24" fill="#ffd166" />
      {/* かぎ */}
      <rect x="27" y="30" width="10" height="11" rx="2" fill="#ffd166" stroke="#7a3f0e" strokeWidth="2" />
      <circle cx="32" cy="35" r="1.8" fill="#7a3f0e" />
    </svg>
  );
}
