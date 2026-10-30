import { useCallback, useState } from 'react';
import { useCamera } from './hooks/useCamera';
import { IntroScreen } from './components/IntroScreen';
import { MirrorScreen } from './components/MirrorScreen';
import './makeup.css';

interface Props {
  // ホーム画面（ゲーム選択）へ戻る
  onExit: () => void;
}

type Screen = 'intro' | 'mirror';

/**
 * マジックメイクミラー本体
 * はじめに（説明・カメラの許可）→ ミラー画面 の切り替えを担当する。
 * あそびひろばに依存するのは onExit だけにして、後で単体アプリに切り出せるようにしておく
 */
export default function MakeupApp({ onExit }: Props) {
  const [screen, setScreen] = useState<Screen>('intro');
  const camera = useCamera();

  const handleStart = useCallback(async () => {
    const ok = await camera.start();
    if (ok) setScreen('mirror');
  }, [camera]);

  const handleBackToIntro = useCallback(() => {
    camera.stop();
    setScreen('intro');
  }, [camera]);

  const handleExit = useCallback(() => {
    camera.stop();
    onExit();
  }, [camera, onExit]);

  if (screen === 'mirror') {
    return <MirrorScreen camera={camera} onBack={handleBackToIntro} />;
  }
  return <IntroScreen status={camera.status} error={camera.error} onStart={handleStart} onExit={handleExit} />;
}
