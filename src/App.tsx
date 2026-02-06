import { useState, useEffect, useCallback } from 'react';
import { Puzzle, PuzzleSummary, ScreenMode, CustomPuzzle } from './types';
import { fetchPuzzle, fetchPuzzleList, fetchServerPuzzleForEdit } from './services/puzzleService';
import { getCustomPuzzle } from './services/storageService';
import { PuzzleList, GameScreen, PuzzleEditor } from './components';
import './App.css';

// 開発者モードのkey
const DEV_MODE_KEY = 'sagashimono_dev_mode';

function App() {
  const [screen, setScreen] = useState<ScreenMode>('list');
  const [puzzleList, setPuzzleList] = useState<PuzzleSummary[]>([]);
  const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle | null>(null);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [editPuzzle, setEditPuzzle] = useState<CustomPuzzle | null>(null);
  const [isServerPuzzleEdit, setIsServerPuzzleEdit] = useState(false); // サーバーパズル編集フラグ
  const [devMode, setDevMode] = useState(() => localStorage.getItem(DEV_MODE_KEY) === 'true');

  // 開発者モード切り替え
  const toggleDevMode = useCallback(() => {
    setDevMode(prev => {
      const newValue = !prev;
      if (newValue) {
        localStorage.setItem(DEV_MODE_KEY, 'true');
      } else {
        localStorage.removeItem(DEV_MODE_KEY);
      }
      return newValue;
    });
  }, []);

  // パズル一覧を読み込む
  useEffect(() => {
    fetchPuzzleList()
      .then(setPuzzleList)
      .catch(err => console.error('Failed to load puzzle list:', err));
  }, [listRefreshKey]);

  // パズルを選択
  const handleSelectPuzzle = useCallback(async (puzzleId: string) => {
    setLoading(true);
    setError(null);
    try {
      const puzzle = await fetchPuzzle(puzzleId);
      setCurrentPuzzle(puzzle);
      const index = puzzleList.findIndex(p => p.id === puzzleId);
      setCurrentPuzzleIndex(index);
      setScreen('game');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [puzzleList]);

  // 一覧に戻る
  const handleBackToList = useCallback(() => {
    setScreen('list');
    setCurrentPuzzle(null);
    // パズル作成後に一覧を更新
    setListRefreshKey(k => k + 1);
  }, []);

  // エディタを開く
  const handleOpenEditor = useCallback(() => {
    setEditPuzzle(null);
    setIsServerPuzzleEdit(false);
    setScreen('editor');
  }, []);

  // 編集モードでエディタを開く
  const handleEditPuzzle = useCallback((puzzleId: string) => {
    const puzzle = getCustomPuzzle(puzzleId);
    if (puzzle) {
      setEditPuzzle(puzzle);
      setIsServerPuzzleEdit(false);
      setScreen('editor');
    }
  }, []);

  // サーバーパズルを編集モードで開く（開発者モード用）
  const handleEditServerPuzzle = useCallback(async (puzzleId: string) => {
    setLoading(true);
    try {
      const puzzle = await fetchServerPuzzleForEdit(puzzleId);
      if (puzzle) {
        setEditPuzzle(puzzle);
        setIsServerPuzzleEdit(true); // サーバーパズル編集フラグを立てる
        setScreen('editor');
      } else {
        alert('パズルの取得に失敗しました');
      }
    } catch (err) {
      alert('エラー: ' + (err instanceof Error ? err.message : 'Unknown'));
    } finally {
      setLoading(false);
    }
  }, []);

  // パズル作成完了
  const handlePuzzleCreated = useCallback((_puzzleId: string) => {
    setListRefreshKey(k => k + 1);
    setEditPuzzle(null);
    setIsServerPuzzleEdit(false);
    setScreen('list');
  }, []);

  // 次のパズルへ
  const handleNextPuzzle = useCallback(async () => {
    if (currentPuzzleIndex < 0 || currentPuzzleIndex >= puzzleList.length - 1) {
      return;
    }
    const nextPuzzleId = puzzleList[currentPuzzleIndex + 1].id;
    await handleSelectPuzzle(nextPuzzleId);
  }, [currentPuzzleIndex, puzzleList, handleSelectPuzzle]);

  const hasNextPuzzle = currentPuzzleIndex >= 0 && currentPuzzleIndex < puzzleList.length - 1;

  // ローディング表示
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>よみこみちゅう...</p>
      </div>
    );
  }

  // エラー表示
  if (error) {
    return (
      <div className="error-screen">
        <p>{error}</p>
        <button onClick={handleBackToList}>もどる</button>
      </div>
    );
  }

  // 画面切り替え
  switch (screen) {
    case 'game':
      return currentPuzzle ? (
        <GameScreen
          puzzle={currentPuzzle}
          onBack={handleBackToList}
          onNextPuzzle={handleNextPuzzle}
          hasNextPuzzle={hasNextPuzzle}
        />
      ) : null;

    case 'editor':
      return (
        <PuzzleEditor 
          onBack={handleBackToList} 
          onPuzzleCreated={handlePuzzleCreated} 
          editPuzzle={editPuzzle}
          isServerPuzzle={isServerPuzzleEdit}
          devMode={devMode}
        />
      );

    case 'list':
    default:
      return (
        <PuzzleList
          onSelectPuzzle={handleSelectPuzzle}
          onOpenEditor={handleOpenEditor}
          onEditPuzzle={handleEditPuzzle}
          onEditServerPuzzle={handleEditServerPuzzle}
          refreshKey={listRefreshKey}
          devMode={devMode}
          onToggleDevMode={toggleDevMode}
        />
      );
  }
}

export default App;
