import { useEffect, useState } from 'react';
import { GameId, GAME_INFO } from '../types';
import { fetchPuzzleList } from '../services/puzzleService';
import { getAllProgress } from '../services/storageService';
import { fetchStageList } from '../games/neji/services/stageService';
import { getNejiProgress } from '../games/neji/services/nejiStorageService';
import { useIsTablet } from '../hooks/useMediaQuery';

interface Props {
  onSelectGame: (game: GameId) => void;
}

// 各ゲームのクリア数（null は未集計）
interface ClearCount {
  cleared: number;
  total: number;
}

/**
 * ホーム画面（ゲーム選択）
 * 起動時に必ず表示され、遊ぶゲームをカードで選ぶ
 */
export function HomeScreen({ onSelectGame }: Props) {
  const isTablet = useIsTablet();
  const [counts, setCounts] = useState<Partial<Record<GameId, ClearCount>>>({});

  // 各ゲームのクリア数を集計
  useEffect(() => {
    let cancelled = false;
    fetchPuzzleList()
      .then(list => {
        if (cancelled) return;
        const progress = getAllProgress();
        const cleared = list.filter(p => {
          const pr = progress[p.id];
          return pr && (pr.completed || pr.foundPositions.length >= p.targetCount);
        }).length;
        setCounts(prev => ({ ...prev, sagashimono: { cleared, total: list.length } }));
      })
      .catch(err => console.error('Failed to load puzzle list:', err));
    fetchStageList()
      .then(list => {
        if (cancelled) return;
        const progress = getNejiProgress();
        const cleared = list.filter(s => progress[s.id]?.cleared).length;
        setCounts(prev => ({ ...prev, neji: { cleared, total: list.length } }));
      })
      .catch(err => console.error('Failed to load stage list:', err));
    return () => { cancelled = true; };
  }, []);

  const games: GameId[] = ['sagashimono', 'neji'];
  const buildTime = new Date(__BUILD_TIME__).toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🎪 あそびひろば</h1>
        <p style={styles.subtitle}>あそぶゲームをえらんでね</p>
      </header>

      <div style={styles.scrollContainer}>
        <div style={{ ...styles.cardGrid, gridTemplateColumns: isTablet ? 'repeat(2, 1fr)' : '1fr' }}>
          {games.map(gameId => {
            const info = GAME_INFO[gameId];
            const count = counts[gameId];
            return (
              <button
                key={gameId}
                style={styles.card}
                onClick={() => onSelectGame(gameId)}
                aria-label={`${info.name}であそぶ`}
              >
                <div style={{ ...styles.cardVisual, background: info.gradient }}>
                  <span style={styles.cardEmoji}>{info.emoji}</span>
                  {!info.available && (
                    <span style={styles.comingSoonBadge}>じゅんびちゅう</span>
                  )}
                </div>
                <div style={styles.cardBody}>
                  <h2 style={styles.cardName}>{info.name}</h2>
                  <p style={styles.cardDescription}>{info.description}</p>
                  {count && (
                    <p style={styles.cardCount}>
                      ✅ クリア {count.cleared} / {count.total}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <p style={styles.buildInfo}>バージョン: {buildTime}</p>
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
    padding: '24px 20px 12px',
    flexShrink: 0,
  },
  title: {
    fontSize: '2rem',
    color: '#333',
    margin: 0,
  },
  subtitle: {
    fontSize: '1.1rem',
    color: '#666',
    margin: '8px 0 0',
  },
  scrollContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 20px 30px',
    WebkitOverflowScrolling: 'touch',
  },
  cardGrid: {
    display: 'grid',
    gap: '20px',
    maxWidth: '820px',
    margin: '0 auto',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    padding: 0,
    textAlign: 'left',
    backgroundColor: 'white',
    borderRadius: '20px',
    border: 'none',
    overflow: 'hidden',
    boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  cardVisual: {
    position: 'relative',
    height: '150px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: {
    fontSize: '5rem',
    lineHeight: 1,
    filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.25))',
  },
  comingSoonBadge: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    backgroundColor: 'rgba(255,255,255,0.92)',
    color: '#e65100',
    padding: '5px 12px',
    borderRadius: '20px',
    fontSize: '0.85rem',
    fontWeight: 'bold',
  },
  cardBody: {
    padding: '16px 18px 18px',
  },
  cardName: {
    margin: '0 0 6px',
    fontSize: '1.4rem',
    color: '#333',
  },
  cardDescription: {
    margin: 0,
    fontSize: '1rem',
    color: '#666',
    lineHeight: 1.5,
  },
  cardCount: {
    margin: '10px 0 0',
    fontSize: '0.95rem',
    color: '#4a90d9',
    fontWeight: 'bold',
  },
  buildInfo: {
    margin: '24px 0 0',
    textAlign: 'center',
    fontSize: '0.75rem',
    color: '#aaa',
  },
};
