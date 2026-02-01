import { useState, useEffect, useCallback } from 'react';
import { Puzzle, PuzzleSummary, ScreenMode } from './types';
import { fetchPuzzle, fetchPuzzleList } from './services/puzzleService';
import { PuzzleList, GameScreen, PuzzleEditor } from './components';
import './App.css';

function App() {
  const [screen, setScreen] = useState<ScreenMode>('list');
  const [puzzleList, setPuzzleList] = useState<PuzzleSummary[]>([]);
  const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle | null>(null);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);

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
    setScreen('editor');
  }, []);

  // パズル作成完了
  const handlePuzzleCreated = useCallback((_puzzleId: string) => {
    setListRefreshKey(k => k + 1);
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
      return <PuzzleEditor onBack={handleBackToList} onPuzzleCreated={handlePuzzleCreated} />;

    case 'list':
    default:
      return (
        <PuzzleList
          onSelectPuzzle={handleSelectPuzzle}
          onOpenEditor={handleOpenEditor}
        />
      );
  }
}

export default App;
