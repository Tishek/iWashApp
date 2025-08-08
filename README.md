# iWash (Expo + React Native)

Najdi **nejbližší myčku aut** na mapě, filtruj podle typu a otevři **navigaci** jedním ťuknutím.  
iOS (Expo Go), podklad Apple Maps, data z **Google Places Nearby**.

## ✨ Funkce
- Interaktivní mapa + **radius hledání** (dock ±100 m, výchozí v Nastavení)
- Rychlé **radius čipy**
- Volba **středu hledání** (moje poloha / střed mapy)
- **Automatický / Manuální** reload výsledků
- **Filtry**: Kontaktní / Bezkontaktní / Full service (heuristika + overrides)
- **Seznam myček** v bottom-sheetu (seřazeno podle vzdálenosti)
- **Oblíbené myčky** (AsyncStorage)
- Tap na pin/kartu → plynulé vycentrování na **viditelný střed** mapy
- **Clustering pinů** s `next_page_token` (víc výsledků v okolí)
- Možnost **načíst více výsledků**
- **Otevřeno/Zavřeno** (z Places `opening_hours.open_now`, pokud je dostupné)
- **Navigace**: Apple / Google / Waze
  - volitelně **preferovaná navigace** → jedno velké tlačítko „Navigovat“ + „…“
- **Dark/Light** režim (respektuje systém / lze přepnout v Nastavení)
- **Splash screen** & **app ikona**

## 🗂 Struktura
iWashApp/
├─ App.js
├─ app.json
├─ assets/
│  ├─ icon.png
│  ├─ splash.png
│  └─ splash-dark.png
├─ package.json
└─ .env   (lokálně – necommitovat)

## 🔑 Konfigurace
Vytvoř `.env` podle šablony:
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=TVUJ_KLIC

> Klíč získáš v Google Cloud Console (povol **Places API → Nearby Search**).  
> Proměnná musí mít prefix `EXPO_PUBLIC_`, aby se dostala do klienta.

## ▶️ Spuštění
`bash`
`npm install`
`npx expo start -c`

## 🧭 Navigace
- Nastavení → Preferovaná navigace (Apple / Google / Waze / Zeptat se).
- Pokud je zvolená jedna appka, v kartě je jedno velké „Navigovat“ + „…“ pro rychlou změnu.

## 🌓 Vzhled
- app.json má "userInterfaceStyle": "automatic" (respektuje systém).
- V appce lze přepnout Systém / Světlý / Tmavý.

## 🛣 Roadmap
- Další filtry (nonstop, samoobsluha…)
- Recenze & detail hodnocení
- Cache + offline poslední výsledky


