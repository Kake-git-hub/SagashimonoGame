import { DEFAULT_SETTINGS, LAST_LOOK_KEY, SETTINGS_KEY } from '../constants';
import { MakeupSettings } from '../types';
import { LookState, sanitizeLook } from '../logic/layers';

/**
 * 設定の保存（localStorage、接頭辞 makeup_）
 * 設定は端末ごと（鏡像・GPU/CPU など）なのでプロフィールでは分けない
 */
export function getMakeupSettings(): MakeupSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<MakeupSettings>;
    return {
      mirrored: typeof parsed.mirrored === 'boolean' ? parsed.mirrored : DEFAULT_SETTINGS.mirrored,
      delegate: parsed.delegate === 'CPU' ? 'CPU' : 'GPU',
      showLandmarks: !!parsed.showLandmarks,
      showStats: !!parsed.showStats,
      guideOpacity: typeof parsed.guideOpacity === 'number' ? Math.max(0.2, Math.min(1, parsed.guideOpacity)) : DEFAULT_SETTINGS.guideOpacity,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveMakeupSettings(settings: MakeupSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 保存できなくても動作は続ける
  }
}

/**
 * 最後に ためす で使っていた色とつよさ（プロフィールごと）
 */
export function getLastLook(keyOf: (base: string) => string): LookState {
  try {
    const raw = localStorage.getItem(keyOf(LAST_LOOK_KEY));
    return raw ? sanitizeLook(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function saveLastLook(look: LookState, keyOf: (base: string) => string): void {
  try {
    localStorage.setItem(keyOf(LAST_LOOK_KEY), JSON.stringify(look));
  } catch {
    // 保存できなくても動作は続ける
  }
}
