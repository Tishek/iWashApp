import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FAVORITES_KEY, FAVORITES_DATA_KEY } from '../utils/constants';

export function useFavorites() {
  const [favorites, setFavorites] = useState({});      // { [place_id]: true }
  const [favoritesData, setFavoritesData] = useState({}); // { [id]: snapshot }

  // Load favorites
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FAVORITES_KEY);
        if (raw) setFavorites(JSON.parse(raw));
      } catch {}
    })();
  }, []);

  // Load cached data of favorites
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FAVORITES_DATA_KEY);
        if (raw) setFavoritesData(JSON.parse(raw));
      } catch {}
    })();
  }, []);

  const isFav = (id) => !!favorites[id];

  const toggleFav = (item) => {
    setFavorites(prev => {
      const next = { ...prev };
      const exists = !!next[item.id];
      if (exists) delete next[item.id]; else next[item.id] = true;
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next)).catch(() => {});

      setFavoritesData(prevData => {
        const dataNext = { ...prevData };
        if (exists) {
          delete dataNext[item.id];
        } else {
          dataNext[item.id] = {
            id: item.id,
            name: item.name,
            address: item.address,
            location: item.location,
            inferredType: item.inferredType,
            rating: item.rating,
            userRatingsTotal: item.userRatingsTotal ?? 0,
            openNow: (typeof item.openNow === 'boolean') ? item.openNow : null,
            distanceM: item.distanceM ?? null,
          };
        }
        AsyncStorage.setItem(FAVORITES_DATA_KEY, JSON.stringify(dataNext)).catch(() => {});
        return dataNext;
      });

      return next;
    });
  };

  return { favorites, favoritesData, isFav, toggleFav };
}