import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCamera } from './hooks/useCamera';
import { IntroScreen } from './components/IntroScreen';
import { MirrorScreen } from './components/MirrorScreen';
import { StageSource } from './components/StageView';
import { MakeupSettings } from './types';
import { LookState } from './logic/layers';
import { loadPhotoUrl } from './services/photo';
import { diag, DiagnosticsSink, setDiagnosticsSink } from './services/diagnostics';
import { SettingsSheet } from './components/SettingsSheet';
import { getLastLook, getMakeupSettings, saveLastLook, saveMakeupSettings } from './services/makeupStorageService';
import './makeup.css';

interface Props {
  // ホーム画面（ゲーム選択）へ戻る
  onExit: () => void;
  // 保存キーをプロフィールごとに分けるための関数（あそびひろばの profileStorageKey）。無ければそのまま
  storageKey?: (base: string) => string;
  // 開発用: 記録（足あと）の保存先・デバッグ画面を開く・前の回がこのゲームの途中で落ちたか
  onDebugLog?: DiagnosticsSink;
  onOpenDebug?: () => void;
  crashedLastTime?: boolean;
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
export default function MakeupApp({ onExit, storageKey, onDebugLog, onOpenDebug, crashedLastTime = false }: Props) {
  // 子の effect より先に記録できるよう、描画のたびに出口を合わせる
  setDiagnosticsSink(onDebugLog ?? null);
  const [introSettings, setIntroSettings] = useState(false);
  const debugParams = useMemo(readDebugParams, []);
  const keyOf = useMemo(() => storageKey ?? ((base: string) => base), [storageKey]);
  const initialLook = useMemo(() => getLastLook(keyOf), [keyOf]);
  const [screen, setScreen] = useState<Screen>(debugParams.photo ? 'mirror' : 'intro');
  const [photoUrl, setPhotoUrl] = useState<string | null>(debugParams.photo);
  const [settings, setSettings] = useState<MakeupSettings>(getMakeupSettings);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const camera = useCamera();

  const updateSettings = useCallback((next: MakeupSettings) => {
    setSettings(next);
    saveMakeupSettings(next);
  }, []);

  // 選んだ色は少し待ってから保存する（スライダーを動かすたびに書かない）
  const saveTimer = useRef(0);
  const handleLookChange = useCallback((look: LookState) => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveLastLook(look, keyOf), 300);
  }, [keyOf]);
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  // どの画面にいるかの記録
  useEffect(() => { diag(`がめん: ${screen}${screen === 'mirror' ? (photoUrl ? '（しゃしん）' : '（カメラ）') : ''}`); }, [screen, photoUrl]);
  useEffect(() => {
    diag('せってい', settings);
  }, [settings]);

  const handleStart = useCallback(async () => {
    const ok = await camera.start({ lowRes: settings.debugLowRes });
    if (ok) setScreen('mirror');
  }, [camera, settings.debugLowRes]);

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
  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // 大きな写真は縮めてから使う（そのままだと描画のメモリが大きくなりすぎる）
    const url = await loadPhotoUrl(file);
    if (!mountedRef.current) {
      URL.revokeObjectURL(url);
      return;
    }
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
    const ok = await camera.start({ lowRes: settings.debugLowRes });
    if (!ok) setScreen('intro');
  }, [camera, settings.debugLowRes]);

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
          initialLook={initialLook}
          debug={debugParams.debug}
          onLookChange={handleLookChange}
          onSettingsChange={updateSettings}
          onPickPhoto={pickPhoto}
          onUseCamera={useCameraAgain}
          onBack={handleBackToIntro}
          onOpenDebug={onOpenDebug}
        />
      ) : (
        <IntroScreen
          status={camera.status}
          error={camera.error}
          onStart={handleStart}
          onPickPhoto={pickPhoto}
          onExit={handleExit}
          crashedLastTime={crashedLastTime}
          onOpenSettings={() => setIntroSettings(true)}
          onOpenDebug={onOpenDebug}
        />
      )}
      {introSettings && (
        <SettingsSheet
          settings={settings}
          isPhoto={false}
          onChange={updateSettings}
          onOpenDebug={onOpenDebug}
          onClose={() => setIntroSettings(false)}
        />
      )}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
    </>
  );
}
