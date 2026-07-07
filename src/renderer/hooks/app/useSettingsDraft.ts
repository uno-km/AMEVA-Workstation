import { useState, useCallback, useEffect } from 'react';
import type { AppSettings } from '../../components/SettingsModal';

export function useSettingsDraft(originalSettings: AppSettings, isOpen: boolean) {
  const [draftSettings, setDraftSettings] = useState<AppSettings>(originalSettings);
  const [isDirty, setIsDirty] = useState(false);

  // 모달이 열릴 때 원본 설정으로 덮어씀
  useEffect(() => {
    if (isOpen) {
      setDraftSettings(originalSettings);
      setIsDirty(false);
    }
  }, [isOpen, originalSettings]);

  const updateDraft = useCallback((updates: Partial<AppSettings>) => {
    setDraftSettings(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
  }, []);

  const resetDraft = useCallback(() => {
    setDraftSettings(originalSettings);
    setIsDirty(false);
  }, [originalSettings]);

  return {
    draftSettings,
    updateDraft,
    resetDraft,
    isDirty
  };
}
