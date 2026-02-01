import { useState, useEffect, useCallback } from 'react';
import { Settings } from '../types';
import { getSettings, saveSettings } from '../services/storageService';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(getSettings);

  // 初期化時に保存された設定を読み込む
  useEffect(() => {
    setSettings(getSettings());
  }, []);

  // 設定を更新
  const updateSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      saveSettings(updated);
      return updated;
    });
  }, []);

  // 表示モードを切り替え
  const toggleDisplayMode = useCallback(() => {
    setSettings(prev => {
      const newMode: 'text' | 'thumbnail' = prev.displayMode === 'text' ? 'thumbnail' : 'text';
      const updated: Settings = { ...prev, displayMode: newMode };
      saveSettings(updated);
      return updated;
    });
  }, []);

  return {
    settings,
    updateSettings,
    toggleDisplayMode,
  };
}
