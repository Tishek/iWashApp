import React from 'react';
import { TouchableOpacity, View, Text, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import styles from '../../styles';

export default function PlaceCard({ item, selected, isDark, P, settings, isFav, toggleFav, onNavigatePreferred, openNavigation, focusPlace, t }) {
  // tiny i18n helper – safely call translator if provided
  const tt = (key, fallback) => (typeof t === 'function' ? t(key) : fallback);

  // Compute translated type label using prop `item`
  const typeLabel =
    item?.inferredType === 'NONCONTACT'
      ? tt('filters.NONCONTACT', 'Touchless')
      : item?.inferredType === 'FULLSERVICE'
      ? tt('filters.FULLSERVICE', 'Full service')
      : item?.inferredType === 'CONTACT'
      ? tt('filters.CONTACT', 'Contact')
      : tt('filters.ALL', 'All');

  // Distance text with localized unit suffixes
  const kmSuffix = tt('units.km', 'km');
  const mSuffix  = tt('units.m', 'm');
  const distanceText =
    item?.distanceM >= 1000
      ? `${(item.distanceM / 1000).toFixed(1)} ${kmSuffix}`
      : `${item?.distanceM ?? ''} ${mSuffix}`;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: P.surface, borderColor: P.border, borderWidth: isDark ? 1 : 0 }, selected && styles.cardActive]}
      onPress={() => { Haptics.selectionAsync(); focusPlace(item); }}
      accessibilityLabel={tt('a11y.openPlace', 'Open place details')}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.cardTitle, { color: P.text }]} numberOfLines={1}>{item.name}</Text>
          </View>
          <TouchableOpacity
            onPress={() => toggleFav(item)}
            style={styles.favBtn}
            hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
            accessibilityLabel={isFav(item.id) ? tt('a11y.removeFavorite', 'Remove from favorites') : tt('a11y.addFavorite', 'Add to favorites')}
          >
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
              {typeLabel}
            </Text>
          </View>
        </View>

        <Text style={[styles.cardSub, { color: P.textMute }]} numberOfLines={1}>{item.address}</Text>

        <View style={styles.metaRow}>
          <Text style={[styles.cardMeta, { color: P.textMute }]}>
            {distanceText}
            {item.rating ? ` • ★ ${item.rating} (${item.userRatingsTotal || 0})` : ''}
          </Text>
          {item.openNow !== null && (
            <View style={styles.openBadge}>
              <View style={[styles.openDot, { backgroundColor: item.openNow ? '#12B76A' : '#94A3B8' }]} />
              <Text style={[styles.openTxt, { color: P.textMute }]}>{item.openNow ? tt('open', 'Open') : tt('closed', 'Closed')}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.navRow}>
        {settings.preferredNav && settings.preferredNav !== 'ask' ? (
          <>
            <TouchableOpacity
              onPress={() => onNavigatePreferred(item)}
              style={styles.navBigBtn}
              accessibilityLabel={tt('a11y.navigate', 'Navigate')}
            >
              <Text style={styles.navBigTxt}>{tt('btn.navigate', 'Navigate')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  tt('nav.otherApp', 'Open in another app'),
                  tt('nav.chooseApp', 'Choose an app'),
                  [
                    { text: tt('nav.apple', 'Apple'),  onPress: () => openNavigation(item, 'apple') },
                    { text: tt('nav.google', 'Google'), onPress: () => openNavigation(item, 'google') },
                    { text: tt('nav.waze', 'Waze'),   onPress: () => openNavigation(item, 'waze') },
                    { text: tt('common.cancel', 'Cancel'), style: 'cancel' },
                  ]
                );
              }}
              style={styles.navMoreBtn}
              accessibilityLabel={tt('a11y.moreNavOptions', 'More navigation options')}
            >
              <Text style={styles.navMoreTxt}>⋯</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => openNavigation(item, 'apple')}  style={styles.navBtn} accessibilityLabel={tt('nav.apple', 'Apple')}><Text style={styles.navTxt}>{tt('nav.apple', 'Apple')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => openNavigation(item, 'google')} style={styles.navBtn} accessibilityLabel={tt('nav.google', 'Google')}><Text style={styles.navTxt}>{tt('nav.google', 'Google')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => openNavigation(item, 'waze')}   style={styles.navBtn} accessibilityLabel={tt('nav.waze', 'Waze')}><Text style={styles.navTxt}>{tt('nav.waze', 'Waze')}</Text></TouchableOpacity>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}