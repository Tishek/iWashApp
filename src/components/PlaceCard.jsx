import React from 'react';
import { TouchableOpacity, View, Text, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import styles from '../../styles';
import { TYPE_LABEL } from '../utils/constants';

export default function PlaceCard({ item, selected, isDark, P, settings, isFav, toggleFav, onNavigatePreferred, openNavigation, focusPlace }) {
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: P.surface, borderColor: P.border, borderWidth: isDark ? 1 : 0 }, selected && styles.cardActive]}
      onPress={() => { Haptics.selectionAsync(); focusPlace(item); }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.cardTitle, { color: P.text }]} numberOfLines={1}>{item.name}</Text>
          </View>
          <TouchableOpacity onPress={() => toggleFav(item)} style={styles.favBtn} hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}>
            <Text style={[styles.favIcon, isFav(item.id) && styles.favIconActive]}>★</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.badgeRow}>
          <View style={[
            styles.badge,
            item.inferredType === 'NONCONTACT' ? { backgroundColor: '#E8F2FF' } :
            item.inferredType === 'FULLSERVICE' ? { backgroundColor: '#E9F8EF' } :
            item.inferredType === 'CONTACT' ? { backgroundColor: isDark ? '#222' : '#EEE' } :
            { backgroundColor: isDark ? '#1C2435' : '#F1F5F9' }
          ]}>
            <Text style={[
              styles.badgeTxt,
              item.inferredType === 'NONCONTACT' ? { color: '#2E90FA' } :
              item.inferredType === 'FULLSERVICE' ? { color: '#12B76A' } :
              item.inferredType === 'CONTACT' ? { color: '#111' } :
              { color: '#475569' }
            ]}>
              {TYPE_LABEL[item.inferredType] || TYPE_LABEL.UNKNOWN}
            </Text>
          </View>
        </View>

        <Text style={[styles.cardSub, { color: P.textMute }]} numberOfLines={1}>{item.address}</Text>

        <View style={styles.metaRow}>
          <Text style={[styles.cardMeta, { color: P.textMute }]}>
            {(item.distanceM >= 1000 ? (item.distanceM / 1000).toFixed(1) + ' km' : item.distanceM + ' m')}
            {item.rating ? ` • ★ ${item.rating} (${item.userRatingsTotal || 0})` : ''}
          </Text>
          {item.openNow !== null && (
            <View style={styles.openBadge}>
              <View style={[styles.openDot, { backgroundColor: item.openNow ? '#12B76A' : '#94A3B8' }]} />
              <Text style={[styles.openTxt, { color: P.textMute }]}>{item.openNow ? 'Otevřeno' : 'Zavřeno'}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.navRow}>
        {settings.preferredNav && settings.preferredNav !== 'ask' ? (
          <>
            <TouchableOpacity onPress={() => onNavigatePreferred(item)} style={styles.navBigBtn}>
              <Text style={styles.navBigTxt}>Navigovat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Alert.alert('Navigovat jinam', 'Vyber aplikaci', [
                  { text: 'Apple',  onPress: () => openNavigation(item, 'apple') },
                  { text: 'Google', onPress: () => openNavigation(item, 'google') },
                  { text: 'Waze',   onPress: () => openNavigation(item, 'waze') },
                  { text: 'Zrušit', style: 'cancel' },
                ]);
              }}
              style={styles.navMoreBtn}
            >
              <Text style={styles.navMoreTxt}>⋯</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => openNavigation(item, 'apple')}  style={styles.navBtn}><Text style={styles.navTxt}>Apple</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => openNavigation(item, 'google')} style={styles.navBtn}><Text style={styles.navTxt}>Google</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => openNavigation(item, 'waze')}   style={styles.navBtn}><Text style={styles.navTxt}>Waze</Text></TouchableOpacity>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}