import React from 'react';
import { Animated, View, Text } from 'react-native';
import styles from '../../styles';

export default function MarkerPin({ selected, color, scale, fav }) {
  return (
    <Animated.View style={[styles.pinWrap, { transform: [{ scale }] }]}>
      {selected && <View style={[styles.pinGlow, { borderColor: color }]} />}
      <View style={[styles.pinTop, { backgroundColor: color }]} />
      <View style={[styles.pinStem, { backgroundColor: color }]} />
      {fav && (
        <View style={styles.pinFav}>
          <Text style={styles.pinFavTxt}>★</Text>
        </View>
      )}
    </Animated.View>
  );
}