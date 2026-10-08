import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { GameId } from './types';
import { migrateFromLocalStorage } from './services/storageService';
import { HomeScreen } from './screens/HomeScreen';
import { SagashimonoApp } from './games/sagashimono/SagashimonoApp';
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

  // 初回起動時に localStorage → IndexedDB 移行（さがしものゲームの自作パズル）
  useEffect(() => {
    migrateFromLocalStorage().finally(() => setReady(true));
  }, []);

  const goHome = useCallback(() => setScreen('home'), []);

  if (!ready) {
    return <LoadingScreen />;
  }

  switch (screen) {
    case 'sagashimono':
      return <SagashimonoApp onExit={goHome} />;

    case 'neji':
      return (
        <Suspense fallback={<LoadingScreen />}>
          <NejiApp onExit={goHome} />
        </Suspense>
      );

    case 'home':
    default:
      return <HomeScreen onSelectGame={setScreen} />;
  }
}

export default App;
