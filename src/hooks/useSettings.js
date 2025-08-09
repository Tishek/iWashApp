import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SETTINGS as DS, SETTINGS_KEY } from '../utils/constants';

// Fallback, kdyby import DS selhal (DS === undefined)
const FALLBACK = {
  autoReload: false,
  defaultRadiusM: 3000,
  searchFrom: 'myLocation',
  theme: 'system',
  preferredNav: 'ask',
};
const DEFAULTS = DS ?? FALLBACK;

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [autoReload, setAutoReload] = useState(DEFAULTS.autoReload);

  // Load settings once
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const parsed = { ...DEFAULTS, ...JSON.parse(raw) };
          setSettings(parsed);
          setAutoReload(!!parsed.autoReload);
        }
      } catch {}
    })();
  }, []);

  // Save + keep autoReload in sync
  const saveSettings = (patch) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      if (Object.prototype.hasOwnProperty.call(patch, 'autoReload')) {
        setAutoReload(!!patch.autoReload);
      }
      return next;
    });
  };

  return { settings, saveSettings, autoReload, setAutoReload };
}