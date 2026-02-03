import { useState, useEffect, useCallback } from 'react';
import { PuzzleSummary } from '../types';
import { fetchPuzzleList, getImageUrl } from '../services/puzzleService';
import { getAllProgress, deleteCustomPuzzle, resetProgress, exportCustomPuzzleForServer, getCustomPuzzle } from '../services/storageService';
import { uploadPuzzleToServer, validateGitHubToken, deleteServerPuzzle } from '../services/githubService';

interface Props {
  onSelectPuzzle: (puzzleId: string) => void;
  onOpenEditor: () => void;
  onEditPuzzle: (puzzleId: string) => void;
  onEditServerPuzzle: (puzzleId: string) => void;
  refreshKey?: number;
  devMode: boolean;
  onToggleDevMode: () => void;
}

export function PuzzleList({ onSelectPuzzle, onOpenEditor, onEditPuzzle, onEditServerPuzzle, refreshKey, devMode, onToggleDevMode }: Props) {
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
          found: p?.foundPositions?.length || 0,
          total: puzzle.targetCount, // これは位置の総数
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

  // サーバーパズルを削除（開発者モード）
  const handleDeleteServerPuzzle = useCallback(async (e: React.MouseEvent, puzzleId: string, puzzleName: string) => {
    e.stopPropagation();
    
    if (!confirm(`⚠️ サーバーから「${puzzleName}」を削除しますか？\n\nこの操作は取り消せません。`)) {
      return;
    }
    
    let token = localStorage.getItem('github_pat');
    
    if (!token) {
      token = prompt(
        '🔐 管理者用機能\n\n' +
        'GitHubのPersonal Access Token (PAT) を入力してください。\n' +
        '必要な権限: repo (Contents: Read and write)'
      );
      
      if (!token) return;
      
      const isValid = await validateGitHubToken(token);
      if (!isValid) {
        alert('トークンが無効です。');
        return;
      }
      
      localStorage.setItem('github_pat', token);
    }
    
    try {
      const result = await deleteServerPuzzle(token, puzzleId, puzzleName);
      
      if (result.success) {
        alert(result.message);
        loadPuzzles();
      } else {
        if (result.message.includes('Bad credentials') || result.message.includes('401')) {
          localStorage.removeItem('github_pat');
          alert('トークンが無効です。再度入力してください。\n\n' + result.message);
        } else {
          alert('削除に失敗しました:\n' + result.message);
        }
      }
    } catch (err) {
      alert('エラーが発生しました: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }, [loadPuzzles]);

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

  // サーバーにアップロード（管理者機能）
  const handleUploadToServer = useCallback(async (e: React.MouseEvent, puzzleId: string, puzzleName: string) => {
    e.stopPropagation();
    
    // トークンを取得（localStorageから、または入力を促す）
    let token = localStorage.getItem('github_pat');
    
    if (!token) {
      token = prompt(
        '🔐 管理者用機能\n\n' +
        'GitHubのPersonal Access Token (PAT) を入力してください。\n' +
        '必要な権限: repo (Contents: Read and write)\n\n' +
        '※トークンはブラウザに保存されます'
      );
      
      if (!token) return;
      
      // トークンを検証
      const isValid = await validateGitHubToken(token);
      if (!isValid) {
        alert('トークンが無効です。正しいトークンを入力してください。');
        return;
      }
      
      localStorage.setItem('github_pat', token);
    }
    
    // カスタムパズルを取得
    const puzzle = getCustomPuzzle(puzzleId);
    if (!puzzle) {
      alert('パズルが見つかりません');
      return;
    }
    
    if (!confirm(`「${puzzleName}」をサーバーにアップロードしますか？\n\n※ GitHubリポジトリに直接追加されます`)) {
      return;
    }
    
    try {
      const result = await uploadPuzzleToServer(token, {
        id: puzzle.name,
        name: puzzle.name,
        targets: puzzle.targets.map(t => ({
          title: t.title,
          positions: t.positions.map(p => {
            // 旧形式の配列や新形式のオブジェクトに対応
            if (Array.isArray(p)) {
              return { x: p[0], y: p[1], size: 'medium' };
            }
            return { x: (p as { x: number }).x, y: (p as { y: number }).y, size: ((p as { size?: string }).size || 'medium') };
          }),
        })),
        imageData: puzzle.imageData,
      });
      
      if (result.success) {
        alert(result.message);
        // カスタムパズルを削除（サーバーに移行したため）
        if (confirm('サーバーにアップロードしたので、ローカルのカスタムパズルを削除しますか？')) {
          deleteCustomPuzzle(puzzleId);
          loadPuzzles();
        }
      } else {
        // トークンが無効な場合はクリア
        if (result.message.includes('Bad credentials') || result.message.includes('401')) {
          localStorage.removeItem('github_pat');
          alert('トークンが無効です。再度入力してください。\n\n' + result.message);
        } else {
          alert('アップロードに失敗しました:\n' + result.message);
        }
      }
    } catch (err) {
      alert('エラーが発生しました: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }, [loadPuzzles]);

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
  // カスタムパズルでもサーバーに同名のものがあればサーバーパズルとして扱う
  // server-edit- プレフィックスのパズルはローカル保存なのでカスタムパズルとして扱う
  const serverPuzzles = puzzles.filter(p => !p.id.startsWith('custom-') && !p.id.startsWith('server-edit-'));
  const serverPuzzleNames = new Set(serverPuzzles.map(p => p.name));
  
  // カスタムパズルの中から、サーバーに同名のものがあるものは除外
  // server-edit- プレフィックスのパズルもカスタムパズルとして表示
  const customPuzzles = puzzles.filter(p => 
    (p.id.startsWith('custom-') || p.id.startsWith('server-edit-')) && !serverPuzzleNames.has(p.name)
  );

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🔍 さがしものゲーム</h1>
        <p style={styles.subtitle}>
          {devMode ? '🔧 開発者モード' : 'パズルをえらんでね'}
        </p>
        {/* 開発者モード切り替え（タイトル5回タップで切り替え） */}
        <button
          style={styles.devModeToggle}
          onClick={onToggleDevMode}
          title={devMode ? '開発者モードを終了' : '開発者モードに切り替え'}
        >
          {devMode ? '🔓' : '🔒'}
        </button>
      </header>

      <div style={styles.scrollContainer}>
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
                  {/* 開発者モード：サーバーパズルの編集・削除ボタン */}
                  {devMode && (
                    <div style={styles.devButtons}>
                      <button 
                        style={styles.editButtonSmall}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditServerPuzzle(puzzle.id);
                        }}
                        title="編集"
                      >
                        ✏️
                      </button>
                      <button 
                        style={styles.deleteButtonSmall}
                        onClick={(e) => handleDeleteServerPuzzle(e, puzzle.id, puzzle.name)}
                        title="サーバーから削除"
                      >
                        🗑️
                      </button>
                    </div>
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

      {/* カスタムパズルセクション（開発者モードのみ） */}
      {devMode && customPuzzles.length > 0 && (
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
                        style={styles.uploadButton}
                        onClick={(e) => handleUploadToServer(e, puzzle.id, puzzle.name)}
                        title="サーバーにアップロード"
                      >
                        🚀
                      </button>
                      <button 
                        style={styles.exportButton}
                        onClick={(e) => handleExport(e, puzzle.id, puzzle.name)}
                        title="ファイルをダウンロード"
                      >
                        📥
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

      {/* エディタボタン（開発者モードのみ） */}
      {devMode && (
        <button style={styles.editorButton} onClick={onOpenEditor}>
          ✏️ パズルをつくる
        </button>
      )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
  },
  header: {
    textAlign: 'center',
    padding: '20px 20px 10px',
    position: 'relative',
    flexShrink: 0,
  },
  scrollContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 20px 20px',
    WebkitOverflowScrolling: 'touch',
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
  devModeToggle: {
    position: 'absolute',
    top: '0',
    right: '10px',
    padding: '8px 12px',
    fontSize: '1.2rem',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    opacity: 0.5,
  },
  devButtons: {
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    display: 'flex',
    gap: '5px',
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
    flexWrap: 'wrap',
    maxWidth: '90px',
  },
  uploadButton: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'rgba(100, 149, 237, 0.95)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
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
  editButtonSmall: {
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
