import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';

/**
 * SettingsScreen
 * Props:
 *  - visible: boolean
 *  - onClose: () => void
 *  - P: palette object { bg, text, textMute, border }
 *  - isDark: boolean
 *  - settings: object from useSettings()
 *  - saveSettings: (partial) => void
 *  - radiusM: number
 *  - commitRadius: (num) => void
 *  - MIN_M, MAX_M, STEP_M: numbers
 *  - t?: (key: string, fallback?: string) => string  // translator from App.js
 */
export default function SettingsScreen({
  visible, onClose, P, isDark, settings, saveSettings,
  radiusM, commitRadius, MIN_M, MAX_M, STEP_M, t: tProp
}) {
    
  // Fallback translator if parent `t` is not provided
  const fallbackStrings = {
    cs: {
      settings: 'Nastavení',
      done: 'Hotovo',
      searchCenter: 'Střed vyhledávání',
      myLocation: 'Moje poloha',
      mapCenter: 'Střed mapy',
      prefNav: 'Preferovaná navigace',
      nav: { ask: 'Zeptat se', apple: 'Apple', google: 'Google', waze: 'Waze' },
      language: 'Jazyk',
      langCs: 'Čeština',
      langEn: 'English',
      theme: 'Vzhled',
      themeSystem: 'Systém',
      themeLight: 'Světlý',
      themeDark: 'Tmavý',
      defaultRadius: 'Výchozí radius',
      defaultRadiusHint: 'Použije se při startu a když posuneš jezdec zde',
      units: { m: 'm', km: 'km' },
    },
    en: {
      settings: 'Settings',
      done: 'Done',
      searchCenter: 'Search center',
      myLocation: 'My location',
      mapCenter: 'Map center',
      prefNav: 'Preferred navigation',
      nav: { ask: 'Ask', apple: 'Apple', google: 'Google', waze: 'Waze' },
      language: 'Language',
      langCs: 'Čeština',
      langEn: 'English',
      theme: 'Appearance',
      themeSystem: 'System',
      themeLight: 'Light',
      themeDark: 'Dark',
      defaultRadius: 'Default radius',
      defaultRadiusHint: 'Used on app start and when you move the slider here',
      units: { m: 'm', km: 'km' },
    },
  };
  const lang = (settings?.lang === 'en') ? 'en' : 'cs';
  const tr = (key, fallback) => {
    let fromParent;
    if (typeof tProp === 'function') {
      try { fromParent = tProp(key); } catch {}
    }
    if (typeof fromParent === 'string' && fromParent && fromParent !== key) {
      return fromParent; // parent provided a real translation
    }
    // fallback to local strings
    const parts = String(key).split('.');
    let cur = fallbackStrings[lang];
    for (const p of parts) cur = cur?.[p];
    return (typeof cur === 'string') ? cur : (fallback ?? key);
  };

  return (
    <Modal visible={!!visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.settingsWrap, { backgroundColor: P?.bg }]}>
        {/* Header */}
        <View style={[styles.settingsHeader, { borderBottomColor: P?.border }]}> 
          <Text style={[styles.settingsTitle, { color: P?.text }]}>{tr('settings')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel={tr('done')}>
            <Text style={[styles.closeTxt, { color: P?.text }]}>{tr('done')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {/* Search Center */}
          <View style={[styles.setGroup, { borderTopColor: P?.border, borderBottomColor: P?.border }]}> 
            <Text style={[styles.setGroupTitle, { color: P?.text }]}>{tr('searchCenter')}</Text>
            <View style={styles.segRow}>
              {[
                { key: 'myLocation', label: tr('myLocation') },
                { key: 'mapCenter', label: tr('mapCenter') },
              ].map(btn => (
                <TouchableOpacity
                  key={btn.key}
                  onPress={() => saveSettings?.({ searchFrom: btn.key })}
                  style={[
                    styles.segBtn,
                    { backgroundColor: (settings?.searchFrom === btn.key) ? '#111' : (isDark ? '#0F1522' : '#F2F4F7'), borderColor: P?.border, borderWidth: isDark ? 1 : 0 },
                  ]}
                >
                  <Text style={[styles.segTxt, { color: (settings?.searchFrom === btn.key) ? '#fff' : P?.text }]}>{btn.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Preferred Navigation */}
          <View style={styles.setGroup}>
            <Text style={[styles.setGroupTitle, { color: P?.text }]}>{tr('prefNav')}</Text>
            <View style={styles.segRow}>
              {[
                { key: 'ask', label: tr('nav.ask') },
                { key: 'apple', label: tr('nav.apple') },
                { key: 'google', label: tr('nav.google') },
                { key: 'waze', label: tr('nav.waze') },
              ].map(btn => (
                <TouchableOpacity
                  key={btn.key}
                  onPress={() => saveSettings?.({ preferredNav: btn.key })}
                  style={[styles.segBtn, { backgroundColor: (settings?.preferredNav === btn.key) ? '#111' : (isDark ? '#0F1522' : '#F2F4F7'), borderColor: P?.border, borderWidth: isDark ? 1 : 0 }]}
                >
                  <Text style={[styles.segTxt, { color: (settings?.preferredNav === btn.key) ? '#fff' : P?.text }]}>{btn.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Default Radius */}
          <View style={styles.setGroup}> 
            <Text style={[styles.setGroupTitle, { color: P?.text }]}>{tr('defaultRadius')}</Text>
            <Text style={[styles.setHint, { color: P?.textMute }]}>{tr('defaultRadiusHint')}</Text>
            <Slider
              style={{ width: '100%', height: 36, marginTop: 8 }}
              minimumValue={MIN_M}
              maximumValue={MAX_M}
              step={STEP_M}
              value={radiusM}
              onValueChange={(v)=>{ commitRadius?.(v); saveSettings?.({ defaultRadiusM: Math.round(v) }); }}
              minimumTrackTintColor="#3874FF"
              maximumTrackTintColor={isDark ? '#1E2638' : '#E6EAF2'}
              thumbTintColor="#3874FF"
            />
            <Text style={[styles.setValue, { color: P?.text }]}>
              {radiusM} {tr('units.m','m')} ({(radiusM/1000).toFixed(1)} {tr('units.km','km')})
            </Text>
          </View>

          {/* Language */}
          <View style={styles.setGroup}>
            <Text style={[styles.setGroupTitle, { color: P?.text }]}>{tr('language')}</Text>
            <View style={styles.segRow}>
              {[
                { key: 'cs', label: tr('langCs') },
                { key: 'en', label: tr('langEn') },
              ].map(btn => (
                <TouchableOpacity
                  key={btn.key}
                  onPress={() => saveSettings?.({ lang: btn.key })}
                  style={[
                    styles.segBtn,
                    {
                      backgroundColor: (settings?.lang === btn.key || (!settings?.lang && btn.key === 'cs')) ? '#111' : (isDark ? '#0F1522' : '#F2F4F7'),
                      borderColor: P?.border,
                      borderWidth: isDark ? 1 : 0,
                    },
                  ]}
                >
                  <Text style={[styles.segTxt, { color: (settings?.lang === btn.key || (!settings?.lang && btn.key === 'cs')) ? '#fff' : P?.text }]}>
                    {btn.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Theme */}
          <View style={[styles.setGroup, { borderTopColor: P?.border, borderBottomColor: P?.border }]}> 
            <Text style={[styles.setGroupTitle, { color: P?.text }]}>{tr('theme')}</Text>
            <View style={styles.segRow}>
              {[
                { key: 'system', label: tr('themeSystem') },
                { key: 'light', label: tr('themeLight') },
                { key: 'dark', label: tr('themeDark') },
              ].map(btn => (
                <TouchableOpacity
                  key={btn.key}
                  onPress={() => saveSettings?.({ theme: btn.key })}
                  style={[styles.segBtn, { backgroundColor: (settings?.theme === btn.key) ? '#111' : (isDark ? '#0F1522' : '#F2F4F7'), borderColor: P?.border, borderWidth: isDark ? 1 : 0 }]}
                >
                  <Text style={[styles.segTxt, { color: (settings?.theme === btn.key) ? '#fff' : P?.text }]}>{btn.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  settingsWrap: { flex: 1 },
  settingsHeader: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingsTitle: { fontSize: 18, fontWeight: '800' },
  closeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  closeTxt: { fontSize: 15, fontWeight: '800' },

  setGroup: { paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  setGroupTitle: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  setRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  setLabel: { fontSize: 15, fontWeight: '700' },
  setHint: { fontSize: 12, marginTop: 4 },
  setValue: { fontSize: 13, marginTop: 8, fontWeight: '800' },

  segRow: { flexDirection: 'row', gap: 8 },
  segBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  segTxt: { fontSize: 12, fontWeight: '800' },
});