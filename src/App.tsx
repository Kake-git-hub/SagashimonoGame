import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { GameId } from './types';
import { migrateFromLocalStorage } from './services/storageService';
import { getCurrentProfile, getProfiles, Profile } from './services/profileService';
import { HomeScreen } from './screens/HomeScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ParentSettingsScreen } from './screens/ParentSettingsScreen';
import { SagashimonoApp } from './games/sagashimono/SagashimonoApp';
import { usePwaUpdate } from './hooks/usePwaUpdate';
import { applyPwaUpdate } from './services/pwaUpdateService';
import './App.css';

// ネジはずしは 3D ライブラリを含むので、選ばれたときだけ読み込む
const NejiApp = lazy(() => import('./games/neji/NejiApp'));

// アプリ全体の画面: プロフィール選択 / ホーム（ゲーム選択）/ おうちのひと設定 / いずれかのゲーム
type AppScreen = 'profile' | 'home' | 'parent' | GameId;

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p>よみこみちゅう...</p>
    </div>
  );
}

// 起動時の画面: プロフィールが無ければ作成、2 人以上いれば「だれが あそぶ？」
function initialScreen(): AppScreen {
  const profiles = getProfiles();
  if (profiles.length === 0) return 'profile';
  if (profiles.length >= 2) return 'profile';
  return 'home';
}

/**
 * あそびひろば
 * ホーム画面と各ゲームを切り替えるだけの薄いルーター
 */
function App() {
  const [screen, setScreen] = useState<AppScreen>(initialScreen);
  const [profile, setProfile] = useState<Profile | null>(() => getCurrentProfile());
  const [ready, setReady] = useState(false);
  const [updating, setUpdating] = useState(false);
  const updateReady = usePwaUpdate();

  // 初回起動時に localStorage → IndexedDB 移行（さがしものゲームの自作パズル）
  useEffect(() => {
    migrateFromLocalStorage().finally(() => setReady(true));
  }, []);

  // 新しいバージョンが待機中なら、ゲームの途中を邪魔しないようホーム画面にいるときに切り替える
  useEffect(() => {
    if (!updateReady || updating || (screen !== 'home' && screen !== 'profile')) return;
    setUpdating(true);
    applyPwaUpdate();
  }, [updateReady, updating, screen]);

  const goHome = useCallback(() => setScreen('home'), []);
  const openProfiles = useCallback(() => setScreen('profile'), []);
  const openParent = useCallback(() => setScreen('parent'), []);
  const refreshProfile = useCallback(() => setProfile(getCurrentProfile()), []);

  const handleProfileDone = useCallback((selected: Profile) => {
    setProfile(selected);
    setScreen('home');
  }, []);

  if (!ready) {
    return <LoadingScreen />;
  }

  let content: React.ReactNode;
  switch (screen) {
    case 'profile':
      content = (
        <ProfileScreen
          profiles={getProfiles()}
          onDone={handleProfileDone}
          onCancel={profile ? goHome : undefined}
        />
      );
      break;

    case 'parent':
      content = <ParentSettingsScreen onClose={goHome} onProfilesChanged={refreshProfile} />;
      break;

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
      content = (
        <HomeScreen
          profile={profile}
          onSelectGame={setScreen}
          onSwitchProfile={openProfiles}
          onOpenParentSettings={openParent}
        />
      );
  }

  return (
    // プロフィールを切り替えたら画面を作り直して、そのプロフィールの進捗を読み直す
    <div key={profile?.id ?? 'none'} style={{ height: '100%' }}>
      {content}
      {updating && (
        <div className="update-toast" role="status">
          🔄 あたらしいバージョンに こうしんしています…
        </div>
      )}
    </div>
  );
}

export default App;
