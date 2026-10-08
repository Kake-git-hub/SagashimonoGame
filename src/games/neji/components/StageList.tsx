import { NejiCollectionMap, NejiProgressMap, StageSummary } from '../types';
import { TreasureChestIcon } from '../../../components/TreasureChestIcon';

interface Props {
  stages: StageSummary[];
  progress: NejiProgressMap;
  collection: NejiCollectionMap;
  onSelect: (stageId: string) => void;
  onOpenCollection: () => void;
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

export function StageList({ stages, progress, collection, onSelect, onOpenCollection, onExit }: Props) {
  const clearedCount = stages.filter(s => progress[s.id]?.cleared).length;
  const treasureTotal = new Set(stages.filter(s => s.treasure).map(s => s.treasure!.id)).size;
  const treasureFound = Object.keys(collection).length;

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
        <button style={styles.collectionButton} onClick={onOpenCollection} aria-label="たからばこをみる">
          <TreasureChestIcon size={64} open={treasureFound > 0} />
          <span style={styles.collectionText}>
            <span style={styles.collectionTitle}>たからばこ</span>
            <span style={styles.collectionCount}>たからもの {treasureFound} / {treasureTotal}</span>
          </span>
        </button>
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
                  {stage.treasure && (
                    <span style={styles.treasureBadge} title={stage.treasure.name}>
                      {collection[stage.treasure.id] ? stage.treasure.emoji : '⛏️'}
                    </span>
                  )}
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
    padding: 'calc(14px + env(safe-area-inset-top, 0px)) 20px 10px',
    flexShrink: 0,
  },
  collectionButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    margin: '12px auto 0',
    padding: '8px 22px 8px 12px',
    borderRadius: '40px',
    border: '3px solid #ffd166',
    background: 'linear-gradient(135deg, #fff8e1 0%, #ffe0b2 100%)',
    color: '#7a3f0e',
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 4px 12px rgba(201, 122, 43, 0.3)',
  },
  collectionText: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    lineHeight: 1.2,
  },
  collectionTitle: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
  },
  collectionCount: {
    fontSize: '0.9rem',
    color: '#a05a1c',
  },
  treasureBadge: {
    position: 'absolute',
    bottom: '8px',
    right: '10px',
    fontSize: '1.3rem',
    filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))',
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
