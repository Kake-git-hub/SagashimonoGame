import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { GameId } from './types';
import { migrateFromLocalStorage } from './services/storageService';
import { getCurrentProfile, getProfiles, Profile, profileStorageKey } from './services/profileService';
import { HomeScreen } from './screens/HomeScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ParentSettingsScreen } from './screens/ParentSettingsScreen';
import { SagashimonoApp } from './games/sagashimono/SagashimonoApp';
import { usePwaUpdate } from './hooks/usePwaUpdate';
import { applyPwaUpdate } from './services/pwaUpdateService';
import { debugLog, debugScreen, getPreviousCrash } from './services/debugLogService';
import { DebugPanel } from './components/DebugPanel';
import { getStoredGitHubToken, uploadDebugLog } from './services/githubService';
import { formatDebugLog } from './services/debugLogService';
import './App.css';

// ネジはずしは 3D ライブラリを含むので、選ばれたときだけ読み込む
const NejiApp = lazy(() => import('./games/neji/NejiApp'));
// マジックメイクミラーはカメラと顔認識のライブラリを含むので、選ばれたときだけ読み込む
const MakeupApp = lazy(() => import('./games/makeup/MakeupApp'));

// アプリ全体の画面: プロフィール選択 / ホーム（ゲーム選択）/ おうちのひと設定 / いずれかのゲーム
type AppScreen = 'profile' | 'home' | 'parent' | GameId;

// マジックメイクミラーへ渡す記録の口（ゲーム側はプラットフォームのコードを import しない）
const logMakeup = (message: string, data?: unknown, replaceKey?: string) => debugLog('makeup', message, data, replaceKey);

// 落ちた記録の自動保存は、起動ごとに 1 回だけ（開発時の StrictMode で 2 回走らないように）
let crashUploadStarted = false;

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
  const [debugOpen, setDebugOpen] = useState(false);
  const openDebug = useCallback(() => setDebugOpen(true), []);

  // 前の回が落ちていて、GitHub のトークンがこの端末にあれば、記録をリポジトリ（debug-logs ブランチ）へ自動で保存する。
  // 落ちた直後の記録を、手で操作しなくても開発者が読めるようにするため
  useEffect(() => {
    const crash = getPreviousCrash();
    const token = getStoredGitHubToken();
    if (!crash || !token || crashUploadStarted) return;
    crashUploadStarted = true;
    uploadDebugLog(token, formatDebugLog(), `crash on ${crash.screen ?? '?'}`).then(result => {
      debugLog('app', result.success ? 'おちた きろくを じどうで ほぞんした' : 'じどうほぞん しっぱい', result.message);
    });
  }, []);

  // どの画面にいたかを記録しておく（落ちたときの手がかり）
  useEffect(() => { debugScreen(screen); }, [screen]);

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

    case 'makeup':
      content = (
        <Suspense fallback={<LoadingScreen />}>
          <MakeupApp
            onExit={goHome}
            storageKey={profileStorageKey}
            onDebugLog={logMakeup}
            onOpenDebug={openDebug}
            crashedLastTime={getPreviousCrash()?.screen === 'makeup'}
          />
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
          onOpenDebug={openDebug}
        />
      );
  }

  return (
    // プロフィールを切り替えたら画面を作り直して、そのプロフィールの進捗を読み直す
    <div key={profile?.id ?? 'none'} style={{ height: '100%' }}>
      {content}
      {debugOpen && <DebugPanel onClose={() => setDebugOpen(false)} />}
      {updating && (
        <div className="update-toast" role="status">
          🔄 あたらしいバージョンに こうしんしています…
        </div>
      )}
    </div>
  );
}

export default App;
