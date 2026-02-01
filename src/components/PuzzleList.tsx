import { useState, useEffect, useCallback } from 'react';
import { PuzzleSummary } from '../types';
import { fetchPuzzleList, getImageUrl } from '../services/puzzleService';
import { getAllProgress, deleteCustomPuzzle, resetProgress, exportCustomPuzzleForServer } from '../services/storageService';

interface Props {
  onSelectPuzzle: (puzzleId: string) => void;
  onOpenEditor: () => void;
  onEditPuzzle: (puzzleId: string) => void;
  refreshKey?: number;
}

export function PuzzleList({ onSelectPuzzle, onOpenEditor, onEditPuzzle, refreshKey }: Props) {
  const [puzzles, setPuzzles] = useState<PuzzleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, { found: number; total: number }>>({});

  const loadPuzzles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPuzzleList();
      setPuzzles(data);

      // 進捗を取得
      const allProgress = getAllProgress();
      const progressMap: Record<string, { found: number; total: number }> = {};
      for (const puzzle of data) {
        const p = allProgress[puzzle.id];
        progressMap[puzzle.id] = {
          found: p?.foundTargets.length || 0,
          total: puzzle.targetCount,
        };
      }
      setProgress(progressMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPuzzles();
  }, [loadPuzzles, refreshKey]);

  // カスタムパズルの削除
  const handleDeletePuzzle = useCallback((e: React.MouseEvent, puzzleId: string, puzzleName: string) => {
    e.stopPropagation();
    if (confirm(`「${puzzleName}」を削除しますか？`)) {
      deleteCustomPuzzle(puzzleId);
      loadPuzzles();
    }
  }, [loadPuzzles]);

  // 進捗リセット
  const handleResetProgress = useCallback((e: React.MouseEvent, puzzleId: string, puzzleName: string) => {
    e.stopPropagation();
    if (confirm(`「${puzzleName}」の進捗をリセットしますか？`)) {
      resetProgress(puzzleId);
      loadPuzzles();
    }
  }, [loadPuzzles]);

  // 編集ボタン
  const handleEdit = useCallback((e: React.MouseEvent, puzzleId: string) => {
    e.stopPropagation();
    onEditPuzzle(puzzleId);
  }, [onEditPuzzle]);

  // エクスポートボタン（サーバー用にダウンロード）
  const handleExport = useCallback(async (e: React.MouseEvent, puzzleId: string, puzzleName: string) => {
    e.stopPropagation();
    try {
      await exportCustomPuzzleForServer(puzzleId);
      alert(`「${puzzleName}」をエクスポートしました。\nJSONファイルと画像ファイルがダウンロードされます。\n\npublic/puzzles/ に配置し、index.json に追加してください。`);
    } catch (err) {
      alert(`エクスポートに失敗しました: ${err instanceof Error ? err.message : 'エラー'}`);
    }
  }, []);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <p>{error}</p>
          <button onClick={loadPuzzles} style={styles.retryButton}>
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  // サーバーパズルとカスタムパズルを分離
  const serverPuzzles = puzzles.filter(p => !p.id.startsWith('custom-'));
  const customPuzzles = puzzles.filter(p => p.id.startsWith('custom-'));

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🔍 さがしものゲーム</h1>
        <p style={styles.subtitle}>パズルをえらんでね</p>
      </header>

      {/* サーバーパズル */}
      {serverPuzzles.length > 0 && (
        <div style={styles.puzzleGrid}>
          {serverPuzzles.map(puzzle => {
            const p = progress[puzzle.id];
            const isCompleted = p && p.found === p.total;
            const hasProgress = p && p.found > 0;

            return (
              <div
                key={puzzle.id}
                style={{
                  ...styles.puzzleCard,
                  ...(isCompleted ? styles.completedCard : {}),
                }}
                onClick={() => onSelectPuzzle(puzzle.id)}
              >
                <div style={styles.thumbnailContainer}>
                  <img
                    src={getImageUrl(puzzle.thumbnail)}
                    alt={puzzle.name}
                    style={styles.thumbnail}
                  />
                  {isCompleted && (
                    <div style={styles.completedBadge}>✅ クリア！</div>
                  )}
                  {hasProgress && !isCompleted && (
                    <button 
                      style={styles.resetButton}
                      onClick={(e) => handleResetProgress(e, puzzle.id, puzzle.name)}
                      title="進捗をリセット"
                    >
                      🔄
                    </button>
                  )}
                </div>
                <div style={styles.puzzleInfo}>
                  <h2 style={styles.puzzleName}>{puzzle.name}</h2>
                  {p && (
                    <div style={styles.progressBar}>
                      <div
                        style={{
                          ...styles.progressFill,
                          width: `${(p.found / p.total) * 100}%`,
                          backgroundColor: isCompleted ? '#4caf50' : '#4a90d9',
                        }}
                      />
                      <span style={styles.progressText}>
                        {p.found} / {p.total}
                      </span>
                    </div>
                  )}
                  {hasProgress && !isCompleted && (
                    <span style={styles.continueLabel}>つづきから</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* カスタムパズルセクション */}
      {customPuzzles.length > 0 && (
        <>
          <h2 style={styles.sectionTitle}>📝 じぶんでつくったパズル</h2>
          <div style={styles.puzzleGrid}>
            {customPuzzles.map(puzzle => {
              const p = progress[puzzle.id];
              const isCompleted = p && p.found === p.total;
              const hasProgress = p && p.found > 0;

              return (
                <div
                  key={puzzle.id}
                  style={{
                    ...styles.puzzleCard,
                    ...(isCompleted ? styles.completedCard : {}),
                  }}
                  onClick={() => onSelectPuzzle(puzzle.id)}
                >
                  <div style={styles.thumbnailContainer}>
                    <img
                      src={getImageUrl(puzzle.thumbnail)}
                      alt={puzzle.name}
                      style={styles.thumbnail}
                    />
                    {isCompleted && (
                      <div style={styles.completedBadge}>✅ クリア！</div>
                    )}
                    {/* カスタムパズルの操作ボタン */}
                    <div style={styles.customPuzzleButtons}>
                      <button 
                        style={styles.exportButton}
                        onClick={(e) => handleExport(e, puzzle.id, puzzle.name)}
                        title="サーバー用にエクスポート"
                      >
                        📤
                      </button>
                      <button 
                        style={styles.editButton}
                        onClick={(e) => handleEdit(e, puzzle.id)}
                        title="編集"
                      >
                        ✏️
                      </button>
                      <button 
                        style={styles.deleteButtonSmall}
                        onClick={(e) => handleDeletePuzzle(e, puzzle.id, puzzle.name)}
                        title="削除"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div style={styles.puzzleInfo}>
                    <h2 style={styles.puzzleName}>{puzzle.name}</h2>
                    {p && (
                      <div style={styles.progressBar}>
                        <div
                          style={{
                            ...styles.progressFill,
                            width: `${(p.found / p.total) * 100}%`,
                            backgroundColor: isCompleted ? '#4caf50' : '#4a90d9',
                          }}
                        />
                        <span style={styles.progressText}>
                          {p.found} / {p.total}
                        </span>
                      </div>
                    )}
                    {hasProgress && !isCompleted && (
                      <span style={styles.continueLabel}>つづきから</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <button style={styles.editorButton} onClick={onOpenEditor}>
        ✏️ パズルをつくる
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    padding: '20px',
    backgroundColor: '#f5f5f5',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  title: {
    fontSize: '2rem',
    color: '#333',
    margin: '0 0 10px 0',
  },
  subtitle: {
    fontSize: '1.1rem',
    color: '#666',
    margin: 0,
  },
  sectionTitle: {
    fontSize: '1.3rem',
    color: '#555',
    margin: '40px 0 20px',
    textAlign: 'center',
  },
  loading: {
    textAlign: 'center',
    padding: '50px',
    fontSize: '1.2rem',
    color: '#666',
  },
  error: {
    textAlign: 'center',
    padding: '50px',
    color: '#d32f2f',
  },
  retryButton: {
    marginTop: '20px',
    padding: '10px 20px',
    fontSize: '1rem',
    backgroundColor: '#4a90d9',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  puzzleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  puzzleCard: {
    backgroundColor: 'white',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  completedCard: {
    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
  },
  thumbnailContainer: {
    position: 'relative',
    aspectRatio: '16/9',
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  completedBadge: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    color: 'white',
    padding: '5px 10px',
    borderRadius: '20px',
    fontSize: '0.9rem',
    fontWeight: 'bold',
  },
  customPuzzleButtons: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    display: 'flex',
    gap: '5px',
  },
  exportButton: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'rgba(144, 238, 144, 0.95)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
  },
  editButton: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
  },
  deleteButtonSmall: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
  },
  resetButton: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
  },
  puzzleInfo: {
    padding: '15px',
  },
  puzzleName: {
    margin: '0 0 10px 0',
    fontSize: '1.2rem',
    color: '#333',
  },
  progressBar: {
    position: 'relative',
    height: '24px',
    backgroundColor: '#e0e0e0',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: '12px',
    transition: 'width 0.3s',
  },
  progressText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: '#333',
  },
  continueLabel: {
    display: 'inline-block',
    marginTop: '8px',
    fontSize: '0.85rem',
    color: '#4a90d9',
    fontWeight: 'bold',
  },
  editorButton: {
    display: 'block',
    margin: '40px auto 20px',
    padding: '15px 30px',
    fontSize: '1.1rem',
    backgroundColor: '#ff9800',
    color: 'white',
    border: 'none',
    borderRadius: '30px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(255, 152, 0, 0.4)',
  },
};
