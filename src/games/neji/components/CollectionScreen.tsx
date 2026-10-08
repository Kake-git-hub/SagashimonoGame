import { NejiCollectionMap, StageSummary } from '../types';
import '../neji.css';

interface Props {
  stages: StageSummary[];
  collection: NejiCollectionMap;
  onBack: () => void;
}

/**
 * たからばこ: 発掘ステージで手に入れた核ブロックのコレクション
 */
export function CollectionScreen({ stages, collection, onBack }: Props) {
  // 同じたからものが複数のステージに出てくることがあるのでまとめる
  const treasures = new Map<string, { id: string; name: string; emoji: string; stageNames: string[] }>();
  for (const stage of stages) {
    if (!stage.treasure) continue;
    const entry = treasures.get(stage.treasure.id) ?? { ...stage.treasure, stageNames: [] };
    entry.stageNames.push(stage.name);
    treasures.set(stage.treasure.id, entry);
  }
  const list = Array.from(treasures.values());
  const found = list.filter(t => collection[t.id]).length;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.titleRow}>
          <button style={styles.backButton} onClick={onBack} aria-label="ステージいちらんへもどる">←</button>
          <h1 style={styles.title}>🏆 たからばこ</h1>
        </div>
        <p style={styles.subtitle}>
          {found === 0 ? 'ステージを ほりすすめて たからものを みつけよう' : `みつけた たからもの ${found} / ${list.length}`}
        </p>
      </header>

      <div style={styles.scroll}>
        <div className="neji-collection-grid">
          {list.map(t => {
            const got = collection[t.id];
            return (
              <div key={t.id} className={`neji-treasure-card ${got ? '' : 'locked'}`}>
                <div className="neji-treasure-emoji">{got ? t.emoji : '❓'}</div>
                <div className="neji-treasure-name">{got ? t.name : '？？？'}</div>
                <div className="neji-treasure-meta">
                  {got ? `${got.count} こ` : `「${t.stageNames.join('」「')}」で みつかるかも`}
                </div>
              </div>
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
    backgroundColor: '#fff8e1',
    overflow: 'hidden',
  },
  header: {
    textAlign: 'center',
    padding: 'calc(14px + env(safe-area-inset-top, 0px)) 20px 10px',
    flexShrink: 0,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px 12px',
    marginBottom: '8px',
  },
  backButton: {
    padding: '4px 8px',
    fontSize: '1.6rem',
    lineHeight: 1,
    backgroundColor: 'transparent',
    color: '#333',
    border: 'none',
    cursor: 'pointer',
  },
  title: {
    fontSize: 'clamp(1.4rem, 5.5vw, 2rem)',
    color: '#333',
    margin: 0,
  },
  subtitle: {
    fontSize: '1rem',
    color: '#666',
    margin: 0,
  },
  scroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 20px calc(30px + env(safe-area-inset-bottom, 0px))',
    WebkitOverflowScrolling: 'touch',
  },
};
