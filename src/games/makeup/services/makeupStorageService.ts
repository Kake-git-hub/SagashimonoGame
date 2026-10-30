import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../constants';
import { MakeupSettings } from '../types';

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
