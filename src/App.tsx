import { useState, useEffect, useCallback } from 'react';
import { GameId, GAME_INFO } from './types';
import { migrateFromLocalStorage } from './services/storageService';
import { HomeScreen } from './screens/HomeScreen';
import { SagashimonoApp } from './games/sagashimono/SagashimonoApp';
import './App.css';

// アプリ全体の画面: ホーム（ゲーム選択）か、いずれかのゲーム
type AppScreen = 'home' | GameId;

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
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>よみこみちゅう...</p>
      </div>
    );
  }

  switch (screen) {
    case 'sagashimono':
      return <SagashimonoApp onExit={goHome} />;

    case 'neji':
      return <ComingSoonScreen gameId="neji" onExit={goHome} />;

    case 'home':
    default:
      return <HomeScreen onSelectGame={setScreen} />;
  }
}

// 準備中のゲーム用の仮画面（フェーズ1で本体に置き換える）
function ComingSoonScreen({ gameId, onExit }: { gameId: GameId; onExit: () => void }) {
  const info = GAME_INFO[gameId];
  return (
    <div className="error-screen">
      <p style={{ fontSize: '4rem', margin: 0, color: '#333' }}>{info.emoji}</p>
      <p style={{ color: '#333', fontSize: '1.3rem', fontWeight: 'bold' }}>
        「{info.name}」はじゅんびちゅうです
      </p>
      <button onClick={onExit}>← ホームへもどる</button>
    </div>
  );
}

export default App;
