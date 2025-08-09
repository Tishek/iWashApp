export const ITEM_H = 112;

export const MIN_M = 500;
export const MAX_M = 5000;
export const STEP_M = 100;
export const MAX_RESULTS = 60;

export const PIN_SELECTED_SCALE = 1.35;
export const PIN_TOP_H = 18;
export const PIN_STEM_H = 10;
export const PIN_STEM_MARGIN = 1;
export const PIN_ANCHOR_OFFSET_BASE = PIN_STEM_H + PIN_STEM_MARGIN + PIN_TOP_H / 2;

export const TARGET_VISIBLE_SPAN_M = 1000;
export const METERS_PER_DEGREE_LAT = 111320;

export const TYPE_LABEL = {
  CONTACT: 'Kontaktní',
  NONCONTACT: 'Bezkontaktní',
  FULLSERVICE: 'Full service',
  UNKNOWN: 'Neznámé',
};

export const OVERRIDE_FULL = ['kk detail','solid car wash','solid carwash','mobilewash'];
export const OVERRIDE_EXCLUDE = ['auto podbabska','autopodbabska'];

// --- App settings defaults & storage keys ---
export const DEFAULT_SETTINGS = {
  autoReload: false,
  defaultRadiusM: 3000,
  searchFrom: 'myLocation', // 'myLocation' | 'mapCenter'
  theme: 'system',          // 'system' | 'light' | 'dark'
  preferredNav: 'ask',      // 'ask' | 'apple' | 'google' | 'waze'
};

export const SETTINGS_KEY = 'iwash_settings_v1';
export const FAVORITES_KEY = 'iwash_favorites_v1';
export const FAVORITES_DATA_KEY = 'iwash_favorites_data_v1';