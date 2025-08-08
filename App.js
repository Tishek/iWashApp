import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Animated,
  Dimensions, FlatList, Alert, Linking, Switch, ActivityIndicator,
  Modal, ScrollView, useColorScheme, Image,
} from 'react-native';
import { Marker, PROVIDER_DEFAULT, Circle } from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { SafeAreaProvider, useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const ITEM_H = 112; // odhad výšky karty + separator

const MIN_M = 500;   // 0.5 km
const MAX_M = 5000;  // 5 km
const STEP_M = 100;
const MAX_RESULTS = 60;
const PIN_SELECTED_SCALE = 1.35; // scale vybraného pinu – používej všude stejnou hodnotu
// Výška pin view v základním měřítku (px). Použije se pro kompenzaci posunu při scale animaci,
// aby špička pinu (anchor) zůstala na stejném místě.

// Geometrie pinu (musí odpovídat stylům níže)
const PIN_TOP_H = 18;         // styles.pinTop.height
const PIN_STEM_H = 10;        // styles.pinStem.height
const PIN_STEM_MARGIN = 1;    // styles.pinStem.marginTop
// Základní vzdálenost od anchoru (spodku) k centru kruhu v měřítku 1.0
const PIN_ANCHOR_OFFSET_BASE = PIN_STEM_H + PIN_STEM_MARGIN + PIN_TOP_H / 2; // = 20 px

// Cílová výška viditelné mapy v metrech po kliknutí na myčku (laditelné)
const TARGET_VISIBLE_SPAN_M = 1000; // např. ~1.4 km vertikálně
const METERS_PER_DEGREE_LAT = 111320; // ~m na 1° zeměpisné šířky

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// --- Settings ---
const DEFAULT_SETTINGS = {
  autoReload: false,
  defaultRadiusM: 3000,
  searchFrom: 'myLocation', // 'myLocation' | 'mapCenter'
  theme: 'system', // 'system' | 'light' | 'dark'
  preferredNav: 'ask', // 'ask' | 'apple' | 'google' | 'waze'
};
const SETTINGS_KEY = 'iwash_settings_v1';
const FAVORITES_KEY = 'iwash_favorites_v1';
const FAVORITES_DATA_KEY = 'iwash_favorites_data_v1';

// haversine v metrech
function distanceMeters(a, b) {
  const toRad = d => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const la1 = toRad(a.latitude);
  const la2 = toRad(b.latitude);
  const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// normalizace textu (bez diakritiky)
function normalizeStr(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Heuristické určení typu myčky (vylepšené, bere v potaz i adresu/vicinity)
function inferType(name = '', types = [], address = '') {
  const text = normalizeStr(`${name} ${(types || []).join(' ')} ${address}`).toLowerCase();
  const typesText = ((types || []).join(' ') || '').toLowerCase();

  // --- Full service (ruční mytí s obsluhou, detailing, mobilní mytí) ---
  const FULL_BRANDS = [
    'kk detail','kkdetail','solid car wash','solid carwash','mobilewash','wash&go','wash and go','automycka express','automyckaexpress'
  ];
  const FULL_GENERIC = [
    'rucni myti','rucni cisteni','rucne','hand wash','handwash','manual wash','detailing','autodetail','cisteni interieru','myti interieru','tepovani','impregnace','voskovani','lesteni','valet','valeting','steam wash','parni myti','myti s obsluhou','mobilni myti','mobile wash'
  ];

  // --- Bezkontaktní (WAP, samoobslužné boxy) ---
  const NONCONTACT_BRANDS = [ 'ehrle','elephant blue','elephant','bkf','sb wash','sb mycka','washbox','wash box','jetwash','jet wash' ];
  const NONCONTACT_GENERIC = [ 'bezkontakt','bez kontakt','touchless','brushless','self service','self-service','samoobsluz','samoobsluzna','samoobsluzne','wap','vapka','pressure','box','boxy','wash point','washpoint' ];

  // --- Kontaktní (automat/tunel/portál, často u čerpacích stanic) ---
  const CONTACT_BRANDS = [ 'imo','washtec','christ' ];
  const CONTACT_GENERIC = [
    'automat','automatic','tunnel','tunel','rollover','portal','portalova','brush','kartac','kartace','myci linka','myci tunel',
    'shell','mol','omv','orlen','benzina','eurooil','ono','globus','tesco'
  ];

  const countHits = (arr) => arr.reduce((acc, term) => acc + (text.includes(term) ? 1 : 0), 0);

  let scoreFull = countHits(FULL_BRANDS) * 2 + countHits(FULL_GENERIC);
  let scoreNon  = countHits(NONCONTACT_BRANDS) * 2 + countHits(NONCONTACT_GENERIC);
  let scoreCon  = countHits(CONTACT_BRANDS) * 2 + countHits(CONTACT_GENERIC);

  if (typesText.includes('gas_station')) scoreCon += 1; // pumpy -> spíš kontaktní

  const max = Math.max(scoreFull, scoreNon, scoreCon);
  if (max < 1) return 'UNKNOWN';

  if (scoreFull === max) return 'FULLSERVICE';
  if (scoreNon === max) return 'NONCONTACT';
  return 'CONTACT';
}

const TYPE_LABEL = {
  CONTACT: 'Kontaktní',
  NONCONTACT: 'Bezkontaktní',
  FULLSERVICE: 'Full service',
  UNKNOWN: 'Neznámé'
};

// overrides a vyloučení konkrétních názvů
const OVERRIDE_FULL = ['kk detail','solid car wash','solid carwash','mobilewash'];
const OVERRIDE_EXCLUDE = ['auto podbabska','autopodbabska'];

function AppInner() {
  const mapRef = useRef(null);
  const listRef = useRef(null);
  const pendingFocusCoordRef = useRef(null);
  const pendingFocusScaleRef = useRef(0); // 0 = žádný offset (střed/moje poloha), 1.35 = vybraný pin
  // Guard to avoid setState loops while we animate the map
  const isAnimatingRef = useRef(false);
  const animTimerRef = useRef(null);
  const animateToRegionSafe = (r, d = 280) => {
    if (!mapRef.current) return;
    isAnimatingRef.current = true;
    try { mapRef.current.animateToRegion(r, d); } catch {}
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    animTimerRef.current = setTimeout(() => { isAnimatingRef.current = false; }, d + 80);
  };

  // Safe-area insets (notch)
  const insets = useSafeAreaInsets();
  // Prevent multiple centerings from stacking
  const centerLockRef = useRef(false);
  // de-dupe opakovaných centerů na stejný cíl
  const lastCenterRef = useRef({ key: '', ts: 0 });

  const systemScheme = useColorScheme();

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [hasPermission, setHasPermission] = useState(null);
  const [region, setRegion] = useState(null);
  const [coords, setCoords] = useState(null);

  // Nejvyšší Y (spodní hrana) top UI, které překrývá mapu (top pill, status pill)
  const [topUiBottomY, setTopUiBottomY] = useState(0);
  const registerTopOcclusion = (e) => {
    const ly = e?.nativeEvent?.layout;
    if (!ly) return;
    const bottom = (ly.y || 0) + (ly.height || 0);
    setTopUiBottomY(prev => Math.max(prev, bottom));
  };

  // držíme poslední region pro porovnání a odfiltrování mikroskopických změn
  const regionRef = useRef(null);
  useEffect(() => { regionRef.current = region; }, [region]);

  // radius (m)
  const [radiusM, setRadiusM] = useState(DEFAULT_SETTINGS.defaultRadiusM);

  // data myček
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  // favorites (persistováno v AsyncStorage)
  const [favorites, setFavorites] = useState({}); // { [place_id]: true }

  // uložená data oblíbených (aby byly vidět i mimo radius)
  const [favoritesData, setFavoritesData] = useState({}); // { [id]: snapshot }

  // sledování polohy – follow me
  const [followMe, setFollowMe] = useState(true);
  const locSubRef = useRef(null);
  const followRef = useRef(followMe);
  useEffect(() => { followRef.current = followMe; }, [followMe]);
  const disableFollow = () => { followRef.current = false; setFollowMe(false); };

  // auto reload (zrcadlí settings.autoReload)
  const [autoReload, setAutoReload] = useState(DEFAULT_SETTINGS.autoReload);
  const autoDebounce = useRef(null);
  const mountedRef = useRef(false);

  // filtry
  const [filterMode, setFilterMode] = useState('ALL'); // ALL | CONTACT | NONCONTACT | FULLSERVICE | FAV

  // --- Animace zvětšení vybraného pinu ---
  const pinScales = useRef({});
  const getPinScale = (id) => {
    if (!pinScales.current[id]) {
      pinScales.current[id] = new Animated.Value(1);
    }
    return pinScales.current[id];
  };
  const prevSelectedRef = useRef(null);
  const animateSelect = (nextId) => {
    const prevId = prevSelectedRef.current;

    // If the same pin is tapped again, do nothing (prevents shrink→grow bounce)
    if (prevId && nextId && prevId === nextId) {
      return;
    }

    // Shrink previously selected pin back to 1
    if (prevId && pinScales.current[prevId]) {
      Animated.spring(pinScales.current[prevId], {
        toValue: 1,
        useNativeDriver: true,
        friction: 6,
        tension: 120,
      }).start();
    }

    // Grow the newly selected pin to highlighted scale
    if (nextId && pinScales.current[nextId]) {
      Animated.spring(pinScales.current[nextId], {
        toValue: PIN_SELECTED_SCALE,
        useNativeDriver: true,
        friction: 6,
        tension: 120,
      }).start();
    }

    prevSelectedRef.current = nextId || null;
  };
  useEffect(() => {
    animateSelect(selectedId);
  }, [selectedId]);

  // aura
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true })).start();
  }, [pulse]);

  // --- Settings load ---
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
          setSettings(parsed);
          setAutoReload(!!parsed.autoReload);
          setRadiusM(parsed.defaultRadiusM);
        }
      } catch {}
    })();
  }, []);

  // --- Favorites load ---
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FAVORITES_KEY);
        if (raw) setFavorites(JSON.parse(raw));
      } catch {}
    })();
  }, []);

    // --- Favorites DATA load ---
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FAVORITES_DATA_KEY);
        if (raw) setFavoritesData(JSON.parse(raw));
      } catch {}
    })();
  }, []);

  const saveSettings = async (patch) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

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

  const resolvedTheme = settings.theme === 'system' ? (systemScheme || 'light') : settings.theme;
  const isDark = resolvedTheme === 'dark';
  const P = {
    bg: isDark ? '#0B0F17' : '#fff',
    surface: isDark ? '#121826' : '#F7F8FB',
    text: isDark ? '#E6E9F2' : '#111',
    textMute: isDark ? 'rgba(230,233,242,0.7)' : 'rgba(17,17,17,0.7)',
    pillBg: isDark ? 'rgba(18,24,38,0.95)' : 'rgba(255,255,255,0.95)',
    border: isDark ? '#1E2638' : '#E6EAF2',
  };

  // poloha
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasPermission(status === 'granted');

      if (status !== 'granted') {
        setRegion({ latitude: 50.087465, longitude: 14.421254, latitudeDelta: 0.05, longitudeDelta: 0.05 });
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setRegion({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 });
    })();
  }, []);

  // živé sledování polohy
  useEffect(() => {
    let sub = null;
    (async () => {
      if (!hasPermission) return;
      try {
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 4000,
            distanceInterval: 10,
          },
          (loc) => {
            const next = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setCoords(next);
            if (followRef.current && mapRef.current) {
              animateToRegionSafe({
                ...next,
                latitudeDelta: region?.latitudeDelta ?? 0.02,
                longitudeDelta: region?.longitudeDelta ?? 0.02,
              }, 350);
            }
          }
        );
        locSubRef.current = sub;
      } catch {}
    })();
    return () => {
      try { sub?.remove?.(); } catch {}
      locSubRef.current = null;
    };
  }, [hasPermission]);

  const recenter = () => {
    Haptics.selectionAsync();
    // explicit recenter enables follow
    setFollowMe(true);
    if (mapRef.current && coords) {
      animateToRegionSafe({ ...coords, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 450);
    }
  };

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.6] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  // helpers radius
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const commitRadius = (valM) => {
    const v = clamp(Math.round(valM / STEP_M) * STEP_M, MIN_M, MAX_M);
    setRadiusM(v);
  };

  // cluster radius v pixelech – čím víc přiblíženo, tím menší radius
  const clusterRadiusPx = useMemo(() => {
    if (!region) return 60;
    const zoom = Math.log2(360 / (region.latitudeDelta || 1)); // ~1–20
    // víc zoomu => menší radius
    const r = Math.round(80 - zoom * 4);
    return clamp(r, 18, 72);
  }, [region]);

  // Helper to adjust radius by delta and persist
  const adjustRadius = (delta) => {
  Haptics.selectionAsync();
  const next = clamp(Math.round((radiusM + delta) / STEP_M) * STEP_M, MIN_M, MAX_M);
  setRadiusM(next);
  saveSettings({ defaultRadiusM: next });
  };

  const moveMarkerToVisibleCenter = async (coord, opts = {}) => {
    if (!mapRef.current || !region || !coord) return;

    const { zoomFactor = 0.7, minDelta = 0.01, targetSpanM = null, pinScale = 0, duration = 320 } = opts;

    // de-dupe
    const now = Date.now();
    const key = `${coord.latitude.toFixed(6)},${coord.longitude.toFixed(6)}|${isExpanded ? 1 : 0}|${pinScale}`;
    if (lastCenterRef.current?.key === key && now - lastCenterRef.current.ts < 600) return;
    lastCenterRef.current = { key, ts: now };

    // throttle
    if (centerLockRef.current) return;
    centerLockRef.current = true;
    setTimeout(() => { centerLockRef.current = false; }, duration + 120);

    const topSafe = insets?.top || 0;
    const topOcclusion = Math.max(topSafe, topUiBottomY);
    const sheetTopNow = sheetTop;

    // Střed VIDITELNÉ plochy (mezi horním UI a listem)
    const visibleH = Math.max(1, sheetTopNow - topOcclusion);
    const desiredCenterY = topOcclusion + visibleH / 2;

    // Pokud je pin (myčka) s anchor y=1, jeho špička je v místě geo souřadnice.
    // Chceme, aby střed kruhu (hlava pinu) byl uprostřed viditelné části.
    // Hlava je o PIN_ANCHOR_OFFSET_BASE*scale NAD špičkou (menší Y), takže
    // špička (anchor) musí být o tuto hodnotu POD středem (větší Y).
    const anchorOffsetPx = pinScale > 0 ? PIN_ANCHOR_OFFSET_BASE * pinScale : 0;
    const desiredAnchorY = desiredCenterY + anchorOffsetPx; // <<< KLÍČOVÉ: plus, ne minus

    // Počkej na frame, ať máme jistý layout
    await new Promise(r => requestAnimationFrame(r));

    const currentLatDelta = region.latitudeDelta || 0.02;
    const currentLonDelta = region.longitudeDelta || 0.02;

    // Cílové delty (buď pevný viditelný span, nebo násobek zoomu)
    let nextLatDelta, nextLonDelta;
    if (targetSpanM && targetSpanM > 0) {
      const scaleFactor = SCREEN_H / visibleH; // region delty jsou vztaženy k celé výšce okna
      nextLatDelta = Math.max(minDelta, (targetSpanM / METERS_PER_DEGREE_LAT) * scaleFactor);
      const aspect = SCREEN_W / SCREEN_H;
      nextLonDelta = Math.max(minDelta, nextLatDelta * aspect);
    } else {
      nextLatDelta = Math.max(minDelta, currentLatDelta * zoomFactor);
      nextLonDelta = Math.max(minDelta, currentLonDelta * zoomFactor);
    }

    // Jednofázový přepočet: zajistí, že geo-bod (špička pinu) skončí přesně v desiredAnchorY i při změně zoomu
    const degPerPxLat = nextLatDelta / SCREEN_H;
    const pixelDeltaY = desiredAnchorY - SCREEN_H / 2;
    const targetLatitude = coord.latitude + pixelDeltaY * degPerPxLat;

    animateToRegionSafe({
      ...region,
      latitude: targetLatitude,
      longitude: coord.longitude,
      latitudeDelta: nextLatDelta,
      longitudeDelta: nextLonDelta,
    }, duration);
  };


  // BottomSheet
  const SNAP_COLLAPSED = 110;
  const SNAP_EXPANDED = Math.min(420, SCREEN_H * 0.6);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sheetTopH, setSheetTopH] = useState(0); // 🔸 výška handle+header+filtry
  const [sheetTop, setSheetTop] = useState(SCREEN_H - SNAP_COLLAPSED); // reálný top listu

  // Animate HEIGHT instead of translateY to avoid scroll glitches on iOS
  const sheetH = useRef(new Animated.Value(SNAP_COLLAPSED)).current;
  useEffect(() => {
    Animated.spring(sheetH, { toValue: isExpanded ? SNAP_EXPANDED : SNAP_COLLAPSED, useNativeDriver: false, friction: 9, tension: 80 }).start();
  }, [isExpanded]);

  useEffect(() => {
    const id = sheetH.addListener(({ value }) => {
      // průběžně udržuj reálnou pozici horní hrany listu
      setSheetTop(SCREEN_H - value);

      // Jakmile animace listu dosedne na cílovou výšku, proveď centrování, pokud je naplánované
      const targetH = isExpanded ? SNAP_EXPANDED : SNAP_COLLAPSED;
      if (Math.abs(value - targetH) < 0.5 && pendingFocusCoordRef.current) {
        const coord = pendingFocusCoordRef.current;
        const scale = (pendingFocusScaleRef.current ?? 0);
        // Počkej 1 frame, ať je layout jistě finální
        requestAnimationFrame(() => {
          moveMarkerToVisibleCenter(coord, {
            zoomFactor: 0.7,
            minDelta: 0.01,
            pinScale: scale,
            targetSpanM: TARGET_VISIBLE_SPAN_M,
          });
          pendingFocusCoordRef.current = null;
          pendingFocusScaleRef.current = 0;
        });
      }
    });
    return () => {
      sheetH.removeListener(id);
    };
  }, [sheetH, isExpanded]);

  // Střed vyhledávání podle nastavení
  const searchCenter = useMemo(() => {
    if (settings.searchFrom === 'myLocation' && coords) return { latitude: coords.latitude, longitude: coords.longitude };
    if (region) return { latitude: region.latitude, longitude: region.longitude };
    return null;
  }, [settings.searchFrom, coords, region]);

  // fetch Places
  const searchHere = async () => {
    if (!API_KEY) {
      Alert.alert('Chybí API klíč', 'Přidej EXPO_PUBLIC_GOOGLE_MAPS_API_KEY do .env a restartuj.');
      return;
    }
    if (!searchCenter) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLoading(true);
      setLastError(null);
      setSelectedId(null);

            const base = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`;
      const acc = [];
      let pageToken = null;
      let safety = 0;

      const mapPlace = (p) => {
        const loc = { latitude: p.geometry?.location?.lat ?? 0, longitude: p.geometry?.location?.lng ?? 0 };
        const address = p.vicinity || p.formatted_address || '';
        const inferredBase = inferType(p.name, p.types, address);

        const n = normalizeStr(p.name).toLowerCase();
        const a = normalizeStr(address).toLowerCase();

        // vyřadit „Auto Podbabská“ apod.
        if (OVERRIDE_EXCLUDE.some(k => n.includes(k) || a.includes(k))) return null;

        const inferred = OVERRIDE_FULL.some(k => n.includes(k) || a.includes(k)) ? 'FULLSERVICE' : inferredBase;

        return {
          id: p.place_id,
          name: p.name,
          address,
          location: loc,
          distanceM: Math.round(distanceMeters(searchCenter, loc)),
          types: p.types || [],
          rating: p.rating,
          userRatingsTotal: p.user_ratings_total,
          inferredType: inferred,
          openNow: (p.opening_hours && typeof p.opening_hours.open_now === 'boolean') ? p.opening_hours.open_now : null,
        };
      };

      do {
        const url = pageToken
          ? `${base}?pagetoken=${pageToken}&key=${API_KEY}`
          : `${base}?location=${searchCenter.latitude},${searchCenter.longitude}&radius=${radiusM}&type=car_wash&key=${API_KEY}`;

        const res = await fetch(url);
        const json = await res.json();

        if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
          throw new Error(json.error_message || json.status || 'Neznámá chyba Places API');
        }

        const pageItems = (json.results || []).map(mapPlace).filter(Boolean);

        // merge bez duplikátů (dle place_id)
        for (const it of pageItems) {
          if (!acc.some(x => x.id === it.id)) acc.push(it);
        }

        pageToken = json.next_page_token && acc.length < MAX_RESULTS ? json.next_page_token : null;

        if (pageToken) {
          // token je platný až po ~2 s
          await new Promise(r => setTimeout(r, 2000));
        }
        safety++;
      } while (pageToken && acc.length < MAX_RESULTS && safety < 5);

      const items = acc.sort((a, b) => a.distanceM - b.distanceM);
      setPlaces(items);

      // Po vyhledání a otevření listu zarovnej viditelný střed na mou polohu (nebo střed vyhledávání)
      const focusCoord = (settings.searchFrom === 'myLocation' && coords)
        ? coords
        : { latitude: searchCenter.latitude, longitude: searchCenter.longitude };

      pendingFocusCoordRef.current = focusCoord;
      pendingFocusScaleRef.current = 0; // centrování na střed/moji polohu → bez offsetu pinu

      setIsExpanded(true);
    } catch (e) {
      console.error(e);
      setLastError(String(e.message || e));
      Alert.alert('Chyba načítání', String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  // Auto-reload při změně regionu / radiusu (s debounce)
  useEffect(() => {
    if (!autoReload) return;
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (!searchCenter) return;

    clearTimeout(autoDebounce.current);
    autoDebounce.current = setTimeout(() => {
      searchHere();
    }, 600);

    return () => clearTimeout(autoDebounce.current);
  }, [region, radiusM, autoReload, searchCenter]);

    const filteredPlaces = useMemo(() => {
    if (filterMode === 'ALL') return places;
    if (filterMode === 'FAV') {
      const inRadius = places.filter(p => isFav(p.id));
      const stored = Object.values(favoritesData || {});
      const extra = stored
        .filter(s => !inRadius.some(ir => ir.id === s.id))
        .map(s => ({
          ...s,
          distanceM: searchCenter ? Math.round(distanceMeters(searchCenter, s.location)) : (s.distanceM ?? Number.MAX_SAFE_INTEGER),
        }));
      return [...inRadius, ...extra].sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
    }
    return places.filter(p => p.inferredType === filterMode);
  }, [places, filterMode, favorites, favoritesData, searchCenter]);

  const idToIndex = useMemo(() => {
    const m = {};
    filteredPlaces.forEach((p, i) => { m[p.id] = i; });
    return m;
  }, [filteredPlaces]);

  const openNavigation = async (item, app) => {
    const loc = item?.location;
    if (!loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') {
      Alert.alert('Chyba', 'Cíl nemá platnou polohu.');
      return;
    }
    const { latitude, longitude } = loc;
    const label = encodeURIComponent(item?.name || 'Cíl');

    let url = '';
    switch (app) {
      case 'apple':
        url = `http://maps.apple.com/?ll=${latitude},${longitude}&q=${label}`;
        break;
      case 'google':
        url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
        break;
      case 'waze':
        url = `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;
        break;
      default:
        url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }

    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Nejde otevřít navigaci', 'Zkus jinou aplikaci.');
    }
  };

  const onNavigatePreferred = (item) => {
    const app = settings.preferredNav || 'google';
    openNavigation(item, app);
  };

  const focusPlace = async (p) => {
    Haptics.selectionAsync();
    disableFollow();
    setSelectedId((prev) => (prev === p.id ? prev : p.id));
    if (!p?.location) return;

    // Pokud už je vybraný stejný pin a list je otevřený, necentruj znovu
    if (selectedId === p.id && isExpanded) {
      // ale stále posuň seznam na kartu
      const idx = idToIndex[p.id];
      setTimeout(() => {
        if (listRef.current != null && typeof idx === 'number') {
          try {
            listRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0, viewOffset: sheetTopH + 8 });
          } catch {
            listRef.current.scrollToOffset({ offset: Math.max(ITEM_H * idx - sheetTopH, 0), animated: true });
          }
        }
      }, 120);
      return;
    }

    if (isExpanded) {
      moveMarkerToVisibleCenter(p.location, { zoomFactor: 0.65, minDelta: 0.01, pinScale: PIN_SELECTED_SCALE, targetSpanM: TARGET_VISIBLE_SPAN_M });
    } else {
      pendingFocusCoordRef.current = p.location;
      pendingFocusScaleRef.current = PIN_SELECTED_SCALE;
      setIsExpanded(true);
    }
  };

  const onMarkerPress = (p) => {
    // Pokud ťuknu na již vybraný pin a list je otevřený, nic nedělej
    if (selectedId === p.id && isExpanded) {
      return;
    }
    disableFollow();
    Haptics.selectionAsync();
    setSelectedId((prev) => (prev === p.id ? prev : p.id));

    if (isExpanded) {
      // list je venku → centrovat hned (zvětšený pin)
      moveMarkerToVisibleCenter(p.location, { zoomFactor: 0.7, minDelta: 0.01, pinScale: PIN_SELECTED_SCALE, targetSpanM: TARGET_VISIBLE_SPAN_M });
    } else {
      // list je dole → otevři a dopočítej po animaci
      pendingFocusCoordRef.current = p.location || null;
      pendingFocusScaleRef.current = PIN_SELECTED_SCALE;
      setIsExpanded(true);
    }

    // posuň list na kartu
    const idx = idToIndex[p.id];
    setTimeout(() => {
      if (listRef.current != null && typeof idx === 'number') {
        try {
          listRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0, viewOffset: sheetTopH + 8 });
        } catch {
          listRef.current.scrollToOffset({ offset: Math.max(ITEM_H * idx - sheetTopH, 0), animated: true });
        }
      }
    }, isExpanded ? 120 : 320);
  };

  const renderCluster = (cluster, _onPress) => {
    const { id, geometry, properties } = cluster;
    const [longitude, latitude] = geometry.coordinates;
    const count = properties.point_count;

    const handlePress = () => {
      try { Haptics.selectionAsync(); } catch {}
      disableFollow();
      if (isExpanded) {
        // list is open → center into the visible area (avoid notch and sheet)
        moveMarkerToVisibleCenter({ latitude, longitude }, { zoomFactor: 0.65, minDelta: 0.01, pinScale: 0 });
      } else {
        // list is closed → do a manual zoom-in around cluster center
        const latDelta = Math.max(0.006, (region?.latitudeDelta || 0.04) * 0.6);
        const lonDelta = Math.max(0.006, (region?.longitudeDelta || 0.04) * 0.6);
        animateToRegionSafe({ latitude, longitude, latitudeDelta: latDelta, longitudeDelta: lonDelta }, 260);
      }
    };

    return (
      <Marker key={`cluster-${id}`} coordinate={{ latitude, longitude }} onPress={handlePress} tracksViewChanges={false}>
        <View style={styles.clusterWrap}>
          <Text style={styles.clusterText}>{count}</Text>
        </View>
      </Marker>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: P.bg }]}>
      {region && (
        <ClusteredMapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_DEFAULT}
          initialRegion={region}
          onRegionChangeComplete={(r) => {
            if (isAnimatingRef.current) return; // ignore updates caused by our own animateToRegion
            const prev = regionRef.current;
            if (prev) {
              const dLat  = Math.abs((prev.latitude ?? 0)       - (r.latitude ?? 0));
              const dLon  = Math.abs((prev.longitude ?? 0)      - (r.longitude ?? 0));
              const dLatD = Math.abs((prev.latitudeDelta ?? 0)  - (r.latitudeDelta ?? 0));
              const dLonD = Math.abs((prev.longitudeDelta ?? 0) - (r.longitudeDelta ?? 0));
              // ignoruj mikrozměny, které vznikají během animací a mohou řetězit re-rendery
              if (dLat < 1e-7 && dLon < 1e-7 && dLatD < 1e-7 && dLonD < 1e-7) return;
            }
            setRegion(r);
          }}
          onPanDrag={() => { disableFollow(); }}
          showsCompass={false}
          showsMyLocationButton={false}
          showsScale={false}
          clusteringEnabled
          spiralEnabled
          radius={clusterRadiusPx}
          extent={256}
          // onClusterPress removed, handled in renderCluster
          renderCluster={renderCluster}
        >
          {searchCenter && (
            <Circle
              center={searchCenter}
              radius={radiusM}
              strokeWidth={2}
              strokeColor="rgba(56,116,255,0.7)"
              fillColor="rgba(56,116,255,0.12)"
            />
          )}

          {filteredPlaces.map(p => {
            const scale = getPinScale(p.id);
            const color = (
              p.inferredType === 'NONCONTACT' ? '#2E90FA' :
              p.inferredType === 'FULLSERVICE' ? '#12B76A' :
              p.inferredType === 'CONTACT' ? '#111' :
              '#6B7280'
            );
            return (
              <Marker
                key={p.id}
                coordinate={p.location}
                onPress={() => onMarkerPress(p)}
                tracksViewChanges={false}
                zIndex={selectedId === p.id ? 999 : 1}
                cluster={selectedId === p.id ? false : true}
                anchor={{ x: 0.5, y: 1 }}
              >
                <Animated.View style={[styles.pinWrap, { transform: [{ scale }] }]}>
                  {selectedId === p.id && <View style={[styles.pinGlow, { borderColor: color }]} />}
                  <View style={[styles.pinTop, { backgroundColor: color }]} />
                  <View style={[styles.pinStem, { backgroundColor: color }]} />
                  {isFav(p.id) && (
                    <View style={styles.pinFav}>
                      <Text style={styles.pinFavTxt}>★</Text>
                    </View>
                  )}
                </Animated.View>
              </Marker>
            );
          })}

          {coords && (
            <Marker
              coordinate={coords}
              cluster={false}          // ⬅️ NECLUSTROVAT
              zIndex={9999}            // ať je nad bublinami
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={styles.meContainer}>
                <Animated.View style={[styles.pulseRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
                <View style={styles.meDotShadow}><View style={styles.meDot} /></View>
              </View>
            </Marker>
          )}
        </ClusteredMapView>
      )}

      {/* kříž – zobrazuj jen pokud se hledá od středu mapy */}
      {settings.searchFrom === 'mapCenter' && (
        <View pointerEvents="none" style={styles.crosshair}><View style={styles.crossDot} /></View>
      )}

      {/* horní pilulka */}
      <BlurView intensity={50} tint={isDark ? 'dark' : 'light'} style={[styles.topPill, styles.glass]} onLayout={registerTopOcclusion}> 
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Image source={require('./assets/icon.png')} style={styles.brandIcon} />
          <Text style={[styles.topPillText, { color: P.text }]}>iWash</Text>
        </View>
      </BlurView>

      {/* status pilulka vpravo nahoře + ⚙︎ */}
      <BlurView intensity={50} tint={isDark ? 'dark' : 'light'} style={[styles.statusPill, styles.glass]} onLayout={registerTopOcclusion}> 
        {loading ? (
          <>
            <ActivityIndicator size="small" />
            <Text style={[styles.statusText, { color: P.text }]}>Aktualizuji…</Text>
          </>
        ) : null}
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); const v = !autoReload; setAutoReload(v); saveSettings({ autoReload: v }); }}
          style={[styles.modeBtn, { borderColor: P.border }]}
          accessibilityLabel="Přepnout manuál/auto"
        >
          <Text style={[styles.modeBtnTxt, { color: P.text }]}>{autoReload ? 'Auto' : 'Manuál'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setSettingsOpen(true); }} style={styles.gearBtn} accessibilityLabel="Nastavení">
          <Text style={{ fontSize: 16, fontWeight: '900', color: P.text }}>⚙︎</Text>
        </TouchableOpacity>
      </BlurView>

      {/* Dock s rychlým nastavením radiusu + hledání + centrování */}
      {!isExpanded && (
        <View style={styles.radiusDockWrap}>
          <BlurView intensity={50} tint={isDark ? 'dark' : 'light'} style={[
            styles.radiusDock,
            styles.glass,
            { borderColor: P.border, borderWidth: isDark ? 1 : 0 }
          ]}>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); adjustRadius(-100); }} style={styles.dockBtn}>
              <Text style={styles.dockBtnTxt}>–100</Text>
            </TouchableOpacity>

            <Text style={styles.dockRadius}>{radiusM} m</Text>

            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); adjustRadius(+100); }} style={styles.dockBtn}>
              <Text style={styles.dockBtnTxt}>+100</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={searchHere} style={[styles.dockAction, { backgroundColor: loading ? '#666' : '#111' }]} disabled={loading}>
              <Text style={styles.dockActionTxt}>{loading ? '…' : 'Hledat'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); recenter(); }} style={styles.dockCircle}>
              <Text style={styles.dockCircleTxt}>◎</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      )}

      {/* Quick radius chips (right side, vertical) */}
      <View pointerEvents="box-none" style={styles.quickChipsWrap}>
        {[{km:0.5},{km:1},{km:3},{km:5}].map(({km})=>{
          const m = Math.round(km*1000);
          const active = radiusM === m;
          return (
            <TouchableOpacity key={m}
              onPress={()=>{ Haptics.selectionAsync(); commitRadius(m); if (autoReload) searchHere(); }}
              style={[styles.quickChip, active && styles.quickChipActive]}
              accessibilityLabel={`Radius ${km} km`}>
              <Text style={[styles.quickChipTxt, active && styles.quickChipTxtActive]}>{km} km</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* BottomSheet */}
      <Animated.View
        style={[styles.sheet, { height: sheetH, backgroundColor: P.bg, borderTopColor: P.border, borderTopWidth: isDark ? 1 : 0 }]}
      >
        {/* Měříme výšku handle + hlavičky + filtrů, aby scrollToIndex nepřekryl položku */}
        <View onLayout={(e) => setSheetTopH(e.nativeEvent.layout.height)}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => { Haptics.selectionAsync(); setIsExpanded(v => !v); }}
            style={styles.sheetHandleArea}
          >
            <View style={[styles.handle, { backgroundColor: isDark ? '#26324A' : '#E2E6EE' }]} />
          </TouchableOpacity>

          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: P.text }]}>Myčky v okolí</Text>
            <Text style={[styles.sheetSubtitle, { color: P.textMute }]}>
              {filteredPlaces.length} z {places.length} • radius {(radiusM / 1000).toFixed(1)} km{lastError ? ' • ⚠️ chyba' : ''}
            </Text>
          </View>

          {/* Filtry */}
          <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {[
            { key: 'ALL', label: 'Vše' },
            { key: 'CONTACT', label: 'Kontaktní' },
            { key: 'NONCONTACT', label: 'Bezkontaktní' },
            { key: 'FULLSERVICE', label: 'Full service' },
            { key: 'FAV', label: 'Oblíbené' },
          ].map(btn => (
            <TouchableOpacity
              key={btn.key}
              onPress={() => { Haptics.selectionAsync(); setFilterMode(btn.key); }}
              style={[
                styles.filterBtn,
                { backgroundColor: (filterMode === btn.key) ? '#111' : (isDark ? '#0F1522' : '#F2F4F7'),
                  borderColor: P.border, borderWidth: isDark ? 1 : 0 }
              ]}
            >
              <Text style={[styles.filterTxt, { color: (filterMode === btn.key) ? '#fff' : P.text }]}>
                {btn.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        </View>

        <View style={styles.sheetBody}>
          {filteredPlaces.length === 0 ? (
            <Text style={[styles.placeholder, { color: P.textMute }]}>
              Žádné výsledky pro zvolený filtr. Změň poloměr, filtr, nebo ťukni na „Hledat zde“.
            </Text>
          ) : (
            <FlatList
              ref={listRef}
              style={{ flex: 1 }}
              data={filteredPlaces}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              contentContainerStyle={{ paddingBottom: 100 }}
              keyboardShouldPersistTaps="handled"
              bounces={false}
              scrollEventThrottle={16}
              nestedScrollEnabled
              getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
              onScrollToIndexFailed={(info) => {
                listRef.current?.scrollToOffset({ offset: Math.max(ITEM_H * Math.min(info.index, filteredPlaces.length - 1) - sheetTopH, 0), animated: true });
              }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.card, { backgroundColor: P.surface, borderColor: P.border, borderWidth: isDark ? 1 : 0 }, selectedId === item.id && styles.cardActive]}
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
              )}
            />
          )}
        </View>
      </Animated.View>

      {/* Nastavení */}
      <Modal visible={settingsOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSettingsOpen(false)}>
        <View style={[styles.settingsWrap, { backgroundColor: P.bg }]}> 
          <View style={[styles.settingsHeader, { borderBottomColor: P.border }]}> 
            <Text style={[styles.settingsTitle, { color: P.text }]}>Nastavení</Text>
            <TouchableOpacity onPress={() => setSettingsOpen(false)} style={styles.closeBtn}><Text style={[styles.closeTxt, { color: P.text }]}>Hotovo</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {/* Auto-reload */}
            <View style={styles.setRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.setLabel, { color: P.text }]}>Auto-reload vyhledávání</Text>
                <Text style={[styles.setHint, { color: P.textMute }]}>Po změně mapy nebo radiusu se výsledky automaticky obnoví</Text>
              </View>
              <Switch
                value={autoReload}
                onValueChange={(v) => { setAutoReload(v); saveSettings({ autoReload: v }); }}
              />
            </View>

            {/* Střed vyhledávání */}
            <View style={[styles.setGroup, { borderTopColor: P.border, borderBottomColor: P.border }]}> 
              <Text style={[styles.setGroupTitle, { color: P.text }]}>Střed vyhledávání</Text>
              <View style={styles.segRow}>
                {[
                  { key: 'myLocation', label: 'Moje poloha' },
                  { key: 'mapCenter', label: 'Střed mapy' },
                ].map(btn => (
                  <TouchableOpacity
                    key={btn.key}
                    onPress={() => saveSettings({ searchFrom: btn.key })}
                    style={[styles.segBtn, { backgroundColor: (settings.searchFrom === btn.key) ? '#111' : (isDark ? '#0F1522' : '#F2F4F7'), borderColor: P.border, borderWidth: isDark ? 1 : 0 }]}
                  >
                    <Text style={[styles.segTxt, { color: (settings.searchFrom === btn.key) ? '#fff' : P.text }]}>{btn.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Preferovaná navigace */}
            <View style={styles.setGroup}>
              <Text style={[styles.setGroupTitle, { color: P.text }]}>Preferovaná navigace</Text>
              <View style={styles.segRow}>
                {[
                  { key: 'ask', label: 'Zeptat se' },
                  { key: 'apple', label: 'Apple' },
                  { key: 'google', label: 'Google' },
                  { key: 'waze', label: 'Waze' },
                ].map(btn => (
                  <TouchableOpacity
                    key={btn.key}
                    onPress={() => saveSettings({ preferredNav: btn.key })}
                    style={[styles.segBtn, { backgroundColor: (settings.preferredNav === btn.key) ? '#111' : (isDark ? '#0F1522' : '#F2F4F7'), borderColor: P.border, borderWidth: isDark ? 1 : 0 }]}
                  >
                    <Text style={[styles.segTxt, { color: (settings.preferredNav === btn.key) ? '#fff' : P.text }]}>{btn.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>      

            {/* Výchozí radius */}
            <View style={styles.setGroup}> 
              <Text style={[styles.setGroupTitle, { color: P.text }]}>Výchozí radius</Text>
              <Text style={[styles.setHint, { color: P.textMute }]}>Použije se při startu a když posuneš jezdec zde</Text>
              <Slider
                style={{ width: '100%', height: 36, marginTop: 8 }}
                minimumValue={MIN_M}
                maximumValue={MAX_M}
                step={STEP_M}
                value={radiusM}
                onValueChange={(v)=>{ commitRadius(v); saveSettings({ defaultRadiusM: Math.round(v) }); }}
                minimumTrackTintColor="#3874FF"
                maximumTrackTintColor={isDark ? '#1E2638' : '#E6EAF2'}
                thumbTintColor="#3874FF"
              />
              <Text style={[styles.setValue, { color: P.text }]}>{radiusM} m ({(radiusM/1000).toFixed(1)} km)</Text>
            </View>

            {/* Motiv vzhledu */}
            <View style={[styles.setGroup, { borderTopColor: P.border, borderBottomColor: P.border }]}> 
              <Text style={[styles.setGroupTitle, { color: P.text }]}>Vzhled</Text>
              <View style={styles.segRow}>
                {[
                  { key: 'system', label: 'Systém' },
                  { key: 'light', label: 'Světlý' },
                  { key: 'dark', label: 'Tmavý' },
                ].map(btn => (
                  <TouchableOpacity
                    key={btn.key}
                    onPress={() => saveSettings({ theme: btn.key })}
                    style={[styles.segBtn, { backgroundColor: (settings.theme === btn.key) ? '#111' : (isDark ? '#0F1522' : '#F2F4F7'), borderColor: P.border, borderWidth: isDark ? 1 : 0 }]}
                  >
                    <Text style={[styles.segTxt, { color: (settings.theme === btn.key) ? '#fff' : P.text }]}>{btn.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppInner />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  topPill: {
    position: 'absolute',
    top: 52,
    left: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    zIndex: 5
  },
  topPillText: { fontSize: 15, fontWeight: '600' },
  brandIcon: { width: 18, height: 18, borderRadius: 4 },
  glass: { overflow: 'hidden' },

  statusPill: {
    position: 'absolute',
    top: 52,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    zIndex: 6,
  },
  statusText: { fontSize: 13, fontWeight: '700' },
  gearBtn: { marginLeft: 6, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  modeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  modeBtnTxt: { fontSize: 13, fontWeight: '800' },

  // Dock styles
  radiusDockWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 140,
    alignItems: 'center',
    zIndex: 6,
  },
  radiusDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  dockBtn: { backgroundColor: '#0F172A', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  dockBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  dockRadius: { minWidth: 84, textAlign: 'center', fontSize: 14, fontWeight: '800' },
  dockAction: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  dockActionTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  dockCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  dockCircleTxt: { color: '#fff', fontSize: 16, fontWeight: '900' },

  // moje poloha
  meContainer: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(56,116,255,0.25)' },
  meDotShadow: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#3874FF', borderWidth: 3, borderColor: '#fff', shadowColor: '#3874FF', shadowOpacity: 0.7, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  meDot: { flex: 1, borderRadius: 10 },

  crosshair: { position: 'absolute', left: '50%', top: '50%', marginLeft: -4, marginTop: -4, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: '#111', backgroundColor: 'rgba(255,255,255,0.95)' },
  crossDot: { flex: 1, borderRadius: 6 },

  // custom pin
  pinWrap: { alignItems: 'center' },
  pinGlow: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    opacity: 0.25,
    top: -6,
    left: -6,
  },
  pinTop: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: '#fff', shadowColor: '#111', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  pinStem: { width: 2, height: 10, marginTop: 1, borderRadius: 1 },

  // BottomSheet
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: -4 },
    elevation: 10,
    zIndex: 7,
  },
  sheetHandleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 44, height: 5, borderRadius: 3 },
  sheetHeader: { paddingHorizontal: 16, paddingVertical: 10 },
  sheetTitle: { fontSize: 18, fontWeight: '800' },
  sheetSubtitle: { fontSize: 13, opacity: 0.6, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 2 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  filterTxt: { fontSize: 12, fontWeight: '800' },
  sheetBody: { flex: 1, paddingHorizontal: 16, paddingVertical: 8 },
  placeholder: { fontSize: 14 },

  // cards
  card: { borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardActive: { backgroundColor: '#EEF3FF', borderWidth: 1, borderColor: '#C9DBFF' },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardSub: { fontSize: 13, marginTop: 2 },
  cardMeta: { fontSize: 12, marginTop: 4 },
  navRow: { flexDirection: 'row', gap: 6, marginLeft: 8 },
  navBtn: { backgroundColor: '#111', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  navTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  openBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  openDot: { width: 8, height: 8, borderRadius: 4 },
  openTxt: { fontSize: 12, fontWeight: '700' },

  navBigBtn: { backgroundColor: '#111', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  navBigTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  navMoreBtn: { backgroundColor: '#0F172A', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, marginLeft: 6 },
  navMoreTxt: { color: '#fff', fontSize: 16, fontWeight: '900' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeTxt: { fontSize: 11, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', marginTop: 4 },

  // favorites styles
  favIcon: { fontSize: 18, fontWeight: '900', color: '#CBD5E1' },
  favIconActive: { color: '#F59E0B' },
  pinFav: { position: 'absolute', top: -10, left: -8 },
  pinFavTxt: { fontSize: 12, fontWeight: '900', color: '#F59E0B' },
  favBtn: { marginLeft: 8, width: 24, alignItems: 'center' },

  // settings
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

  // clusters
  clusterWrap: { minWidth: 34, height: 34, paddingHorizontal: 6, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  clusterText: { color: '#fff', fontSize: 13, fontWeight: '900' },

  // quick radius chips
  quickChipsWrap: { position: 'absolute', right: 10, top: SCREEN_H * 0.28, gap: 8, zIndex: 6, alignItems: 'flex-end' },
  quickChip: { backgroundColor: '#0F172A', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12 },
  quickChipActive: { backgroundColor: '#111' },
  quickChipTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  quickChipTxtActive: { textDecorationLine: 'underline' },
});