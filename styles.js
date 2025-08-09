import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  // --- MarkerPin ---
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
  pinTop: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#111',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  pinStem: { width: 2, height: 10, marginTop: 1, borderRadius: 1 },
  pinFav: { position: 'absolute', top: -10, left: -8 },
  pinFavTxt: { fontSize: 12, fontWeight: '900', color: '#F59E0B' },

  // --- PlaceCard ---
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

  favIcon: { fontSize: 18, fontWeight: '900', color: '#CBD5E1' },
  favIconActive: { color: '#F59E0B' },
  favBtn: { marginLeft: 8, width: 24, alignItems: 'center' },
});