import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCamera } from './hooks/useCamera';
import { IntroScreen } from './components/IntroScreen';
import { MirrorScreen } from './components/MirrorScreen';
import { StageSource } from './components/StageView';
import { MakeupSettings } from './types';
import { getMakeupSettings, saveMakeupSettings } from './services/makeupStorageService';
import './makeup.css';

interface Props {
  // ホーム画面（ゲーム選択）へ戻る
  onExit: () => void;
}

type Screen = 'intro' | 'mirror';

// ?makeupdebug=1 で自動テスト用の情報を window.__makeupDebug に出す。&photo=URL で写真モードで始める
function readDebugParams(): { debug: boolean; photo: string | null } {
  if (typeof window === 'undefined') return { debug: false, photo: null };
  const params = new URLSearchParams(window.location.search);
  return { debug: params.get('makeupdebug') === '1', photo: params.get('photo') };
}

/**
 * マジックメイクミラー本体
 * はじめに（説明・カメラの許可）→ ミラー画面 の切り替えと、カメラ / 写真の切り替え、設定の保存を担当する。
 * あそびひろばに依存するのは onExit だけにして、後で単体アプリに切り出せるようにしておく
 */
export default function MakeupApp({ onExit }: Props) {
  const debugParams = useMemo(readDebugParams, []);
  const [screen, setScreen] = useState<Screen>(debugParams.photo ? 'mirror' : 'intro');
  const [photoUrl, setPhotoUrl] = useState<string | null>(debugParams.photo);
  const [settings, setSettings] = useState<MakeupSettings>(getMakeupSettings);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const camera = useCamera();

  const updateSettings = useCallback((next: MakeupSettings) => {
    setSettings(next);
    saveMakeupSettings(next);
  }, []);

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

  // 写真を選ぶ（カメラの代わりに使う。PC での開発やカメラが使えないときにも）
  const pickPhoto = useCallback(() => fileInputRef.current?.click(), []);
  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoUrl(prev => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return url;
    });
    camera.stop();
    setScreen('mirror');
  }, [camera]);

  const useCameraAgain = useCallback(async () => {
    setPhotoUrl(prev => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    const ok = await camera.start();
    if (!ok) setScreen('intro');
  }, [camera]);

  // 画面を離れるときに写真の URL を解放する
  useEffect(() => () => {
    if (photoUrl && photoUrl.startsWith('blob:')) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const source: StageSource = photoUrl ? { kind: 'photo', url: photoUrl } : { kind: 'camera', stream: camera.stream };

  return (
    <>
      {screen === 'mirror' ? (
        <MirrorScreen
          source={source}
          camera={camera}
          settings={settings}
          debug={debugParams.debug}
          onSettingsChange={updateSettings}
          onPickPhoto={pickPhoto}
          onUseCamera={useCameraAgain}
          onBack={handleBackToIntro}
        />
      ) : (
        <IntroScreen
          status={camera.status}
          error={camera.error}
          onStart={handleStart}
          onPickPhoto={pickPhoto}
          onExit={handleExit}
        />
      )}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
    </>
  );
}
