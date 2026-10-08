import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { GameId } from './types';
import { migrateFromLocalStorage } from './services/storageService';
import { HomeScreen } from './screens/HomeScreen';
import { SagashimonoApp } from './games/sagashimono/SagashimonoApp';
import { usePwaUpdate } from './hooks/usePwaUpdate';
import { applyPwaUpdate } from './services/pwaUpdateService';
import './App.css';

// ネジはずしは 3D ライブラリを含むので、選ばれたときだけ読み込む
const NejiApp = lazy(() => import('./games/neji/NejiApp'));

// アプリ全体の画面: ホーム（ゲーム選択）か、いずれかのゲーム
type AppScreen = 'home' | GameId;

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p>よみこみちゅう...</p>
    </div>
  );
}

/**
 * あそびひろば
 * ホーム画面と各ゲームを切り替えるだけの薄いルーター
 */
function App() {
  const [screen, setScreen] = useState<AppScreen>('home');
  const [ready, setReady] = useState(false);
  const [updating, setUpdating] = useState(false);
  const updateReady = usePwaUpdate();

  // 初回起動時に localStorage → IndexedDB 移行（さがしものゲームの自作パズル）
  useEffect(() => {
    migrateFromLocalStorage().finally(() => setReady(true));
  }, []);

  // 新しいバージョンが待機中なら、ゲームの途中を邪魔しないようホーム画面にいるときに切り替える
  useEffect(() => {
    if (!updateReady || updating || screen !== 'home') return;
    setUpdating(true);
    applyPwaUpdate();
  }, [updateReady, updating, screen]);

  const goHome = useCallback(() => setScreen('home'), []);

  if (!ready) {
    return <LoadingScreen />;
  }

  let content: React.ReactNode;
  switch (screen) {
    case 'sagashimono':
      content = <SagashimonoApp onExit={goHome} />;
      break;

    case 'neji':
      content = (
        <Suspense fallback={<LoadingScreen />}>
          <NejiApp onExit={goHome} />
        </Suspense>
      );
      break;

    case 'home':
    default:
      content = <HomeScreen onSelectGame={setScreen} />;
  }

  return (
    <>
      {content}
      {updating && (
        <div className="update-toast" role="status">
          🔄 あたらしいバージョンに こうしんしています…
        </div>
      )}
    </>
  );
}

export default App;
