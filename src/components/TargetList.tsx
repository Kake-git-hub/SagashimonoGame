import { Target } from '../types';

interface Props {
  targets: Target[];
  foundTargets: Set<string>;
  displayMode: 'text' | 'thumbnail';
  thumbnails: Map<string, string>;
  layout: 'vertical' | 'horizontal';
}

export function TargetList({ targets, foundTargets, displayMode, thumbnails, layout }: Props) {
  const isVertical = layout === 'vertical';

  return (
    <div style={isVertical ? styles.listVertical : styles.listHorizontal}>
      {targets.map(target => {
        const isFound = foundTargets.has(target.title);
        const thumbnail = thumbnails.get(target.title);

        if (displayMode === 'thumbnail') {
          return (
            <div
              key={target.title}
              style={{
                ...styles.thumbnailItem,
                ...(isFound ? styles.thumbnailItemFound : {}),
              }}
            >
              <div style={styles.thumbnailWrapper}>
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={target.title}
                    style={{
                      ...styles.thumbnailImage,
                      filter: isFound ? 'none' : 'blur(5px) brightness(0.7)',
                    }}
                  />
                ) : (
                  <div style={styles.thumbnailPlaceholder}>?</div>
                )}
                {isFound && <div style={styles.checkMark}>✓</div>}
              </div>
              <span
                style={{
                  ...styles.thumbnailTitle,
                  ...(isFound ? styles.foundText : {}),
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
              ...(isFound ? styles.textItemFound : {}),
            }}
          >
            <span style={styles.checkbox}>{isFound ? '☑' : '☐'}</span>
            <span
              style={{
                ...styles.textTitle,
                ...(isFound ? styles.foundText : {}),
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
  checkbox: {
    fontSize: '1.2rem',
    flexShrink: 0,
  },
  textTitle: {
    fontSize: '0.95rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
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
