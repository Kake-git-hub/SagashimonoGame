import { Target, makePositionKey } from '../types';

interface Props {
  targets: Target[];
  foundPositions: Set<string>;
  displayMode: 'text' | 'thumbnail';
  thumbnails: Map<string, string>;
  layout: 'vertical' | 'horizontal';
}

export function TargetList({ targets, foundPositions, displayMode, thumbnails, layout }: Props) {
  const isVertical = layout === 'vertical';

  // ターゲットごとに発見数を集計
  const targetStats = targets.map(target => {
    let foundCount = 0;
    const totalCount = target.positions.length;
    
    for (let i = 0; i < totalCount; i++) {
      const posKey = makePositionKey(target.title, i);
      if (foundPositions.has(posKey)) {
        foundCount++;
      }
    }
    
    return {
      target,
      foundCount,
      totalCount,
      isComplete: foundCount >= totalCount,
    };
  });

  return (
    <div style={isVertical ? styles.listVertical : styles.listHorizontal}>
      {targetStats.map(({ target, foundCount, totalCount, isComplete }) => {
        const thumbnail = thumbnails.get(target.title);
        // 複数ある場合は「◐ 2/3 らいおん」形式
        const progressText = totalCount > 1 ? `${foundCount}/${totalCount} ` : '';
        const checkboxIcon = isComplete ? '☑' : foundCount > 0 ? '◐' : '☐';

        if (displayMode === 'thumbnail') {
          return (
            <div
              key={target.title}
              style={{
                ...styles.thumbnailItem,
                ...(isComplete ? styles.thumbnailItemFound : {}),
              }}
            >
              <div style={styles.thumbnailWrapper}>
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={target.title}
                    style={{
                      ...styles.thumbnailImage,
                      filter: isComplete ? 'none' : 'blur(5px) brightness(0.7)',
                    }}
                  />
                ) : (
                  <div style={styles.thumbnailPlaceholder}>?</div>
                )}
                {isComplete && <div style={styles.checkMark}>✓</div>}
                {/* 複数ある場合は進捗バッジ */}
                {totalCount > 1 && !isComplete && foundCount > 0 && (
                  <div style={styles.progressBadge}>{foundCount}/{totalCount}</div>
                )}
              </div>
              <span
                style={{
                  ...styles.thumbnailTitle,
                  ...(isComplete ? styles.foundText : {}),
                }}
              >
                {target.title}
              </span>
            </div>
          );
        }

        // テキストモード
        return (
          <div
            key={target.title}
            style={{
              ...styles.textItem,
              ...(isComplete ? styles.textItemFound : foundCount > 0 ? styles.textItemPartial : {}),
            }}
          >
            <span style={styles.checkbox}>
              {checkboxIcon}
            </span>
            {totalCount > 1 && (
              <span style={styles.progressCount}>{progressText}</span>
            )}
            <span
              style={{
                ...styles.textTitle,
                ...(isComplete ? styles.foundText : {}),
              }}
            >
              {target.title}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  listVertical: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
    overflowY: 'auto',
  },
  listHorizontal: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    padding: '10px 0',
  },
  // テキストモード
  textItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: 'white',
    transition: 'all 0.3s',
  },
  textItemFound: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
  },
  textItemPartial: {
    backgroundColor: 'rgba(255, 193, 7, 0.3)',
  },
  checkbox: {
    fontSize: '1.2rem',
    flexShrink: 0,
  },
  progressCount: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.8)',
    flexShrink: 0,
    minWidth: '28px',
  },
  textTitle: {
    fontSize: '0.95rem',
    wordBreak: 'break-all',
  },
  foundText: {
    textDecoration: 'line-through',
    opacity: 0.7,
  },
  // サムネイルモード
  thumbnailItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '5px',
    padding: '8px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: '10px',
    transition: 'all 0.3s',
    minWidth: '70px',
  },
  thumbnailItemFound: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
  },
  thumbnailWrapper: {
    position: 'relative',
    width: '60px',
    height: '60px',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'filter 0.3s',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    color: 'rgba(255,255,255,0.5)',
  },
  checkMark: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '2rem',
    color: '#4caf50',
    fontWeight: 'bold',
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
  },
  progressBadge: {
    position: 'absolute',
    bottom: '2px',
    right: '2px',
    backgroundColor: 'rgba(255, 193, 7, 0.9)',
    color: '#000',
    padding: '1px 5px',
    borderRadius: '8px',
    fontSize: '0.7rem',
    fontWeight: 'bold',
  },
  thumbnailTitle: {
    fontSize: '0.75rem',
    color: 'white',
    textAlign: 'center',
    maxWidth: '70px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
