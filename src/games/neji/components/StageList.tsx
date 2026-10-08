import { NejiProgressMap, StageSummary } from '../types';

interface Props {
  stages: StageSummary[];
  progress: NejiProgressMap;
  onSelect: (stageId: string) => void;
  onExit: () => void;
}

const CARD_GRADIENTS = [
  'linear-gradient(135deg, #ffb703 0%, #fb8500 100%)',
  'linear-gradient(135deg, #8ecae6 0%, #219ebc 100%)',
  'linear-gradient(135deg, #b5e48c 0%, #52b69a 100%)',
  'linear-gradient(135deg, #ffafcc 0%, #ff6b9d 100%)',
  'linear-gradient(135deg, #cdb4db 0%, #9d4edd 100%)',
];

function difficultyStars(level: number): string {
  const capped = Math.max(1, Math.min(5, level));
  return '★'.repeat(capped) + '☆'.repeat(5 - capped);
}

export function StageList({ stages, progress, onSelect, onExit }: Props) {
  const clearedCount = stages.filter(s => progress[s.id]?.cleared).length;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.titleRow}>
          <button style={styles.homeButton} onClick={onExit} title="ホームへもどる" aria-label="ホームへもどる">
            ←
          </button>
          <h1 style={styles.title}>🔩 ネジはずし</h1>
        </div>
        <p style={styles.subtitle}>ステージをえらんでね（クリア {clearedCount} / {stages.length}）</p>
      </header>

      <div style={styles.scrollContainer}>
        <div style={styles.grid}>
          {stages.map((stage, index) => {
            const cleared = progress[stage.id]?.cleared ?? false;
            return (
              <button
                key={stage.id}
                style={{ ...styles.card, ...(cleared ? styles.clearedCard : {}) }}
                onClick={() => onSelect(stage.id)}
                aria-label={`${stage.name}であそぶ`}
              >
                <div style={{ ...styles.cardVisual, background: CARD_GRADIENTS[index % CARD_GRADIENTS.length] }}>
                  <span style={styles.cardEmoji}>{stage.emoji ?? '🔩'}</span>
                  <span style={styles.stageNumber}>{index + 1}</span>
                  {cleared && <span style={styles.clearedBadge}>✅ クリア！</span>}
                </div>
                <div style={styles.cardBody}>
                  <h2 style={styles.cardName}>{stage.name}</h2>
                  <div style={styles.cardMeta}>
                    <span style={styles.stars}>{difficultyStars(stage.difficulty)}</span>
                    <span>ネジ {stage.screwCount} ほん</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
  },
  header: {
    textAlign: 'center',
    padding: '20px 20px 10px',
    flexShrink: 0,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px 12px',
    marginBottom: '10px',
  },
  homeButton: {
    padding: '4px 8px',
    fontSize: '1.6rem',
    lineHeight: 1,
    backgroundColor: 'transparent',
    color: '#333',
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
  },
  title: {
    fontSize: 'clamp(1.4rem, 5.5vw, 2rem)',
    color: '#333',
    margin: 0,
    whiteSpace: 'nowrap',
  },
  subtitle: {
    fontSize: '1.05rem',
    color: '#666',
    margin: 0,
  },
  scrollContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 20px 30px',
    WebkitOverflowScrolling: 'touch',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
    maxWidth: '1000px',
    margin: '0 auto',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    padding: 0,
    textAlign: 'left',
    backgroundColor: 'white',
    borderRadius: '16px',
    border: 'none',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  clearedCard: {
    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.35)',
  },
  cardVisual: {
    position: 'relative',
    height: '110px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: {
    fontSize: '3.6rem',
    lineHeight: 1,
    filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.25))',
  },
  stageNumber: {
    position: 'absolute',
    top: '8px',
    left: '10px',
    backgroundColor: 'rgba(0,0,0,0.35)',
    color: 'white',
    fontWeight: 'bold',
    padding: '2px 10px',
    borderRadius: '12px',
    fontSize: '0.9rem',
  },
  clearedBadge: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    color: 'white',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '0.8rem',
    fontWeight: 'bold',
  },
  cardBody: {
    padding: '12px 14px 14px',
  },
  cardName: {
    margin: '0 0 6px',
    fontSize: '1.15rem',
    color: '#333',
  },
  cardMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.85rem',
    color: '#666',
  },
  stars: {
    color: '#ff9800',
    letterSpacing: '1px',
  },
};
