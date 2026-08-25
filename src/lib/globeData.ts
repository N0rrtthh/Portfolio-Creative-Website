/* ══════════════════════════════════════════════════════════
   Shared globe data — the contact globe's config and flights
   ──────────────────────────────────────────────────────────
   One source for both consumers: the classic Contact band
   (orbit / close-up framings) and the EVA comms pane render the
   same globe, so the config and arc data live here once.
   ══════════════════════════════════════════════════════════ */

/* Interactive wireframe globe: vector country outlines that double
   as the living data layer (they breathe subtly at rest and peel
   off + garble under the cursor), a pulsing Manila beacon with
   great-circle arcs radiating outward. All colours resolve live
   from the active theme tokens, so Classic/EVA × dark/light retint
   it. */
export const GLOBE_CONFIG = {
  showAtmosphere: true,
  atmosphereAltitude: 0.1,
  initialPosition: { lat: 25, lng: 50 },
  autoRotate: true,
  autoRotateSpeed: 0.5,
};

/* Great-circle flights radiating out of Manila (order = stagger wave). */
export const MANILA_ARCS = [
  { order: 1, startLat: 14.5995, startLng: 120.9842, endLat: 35.6762, endLng: 139.6503, arcAlt: 0.2 },
  { order: 1, startLat: 14.5995, startLng: 120.9842, endLat: 1.3521, endLng: 103.8198, arcAlt: 0.15 },
  { order: 2, startLat: 14.5995, startLng: 120.9842, endLat: -33.8688, endLng: 151.2093, arcAlt: 0.3 },
  { order: 2, startLat: 14.5995, startLng: 120.9842, endLat: 51.5072, endLng: -0.1276, arcAlt: 0.4 },
  { order: 3, startLat: 14.5995, startLng: 120.9842, endLat: 40.7128, endLng: -74.006, arcAlt: 0.5 },
  { order: 3, startLat: 14.5995, startLng: 120.9842, endLat: 37.7749, endLng: -122.4194, arcAlt: 0.45 },
  { order: 4, startLat: 14.5995, startLng: 120.9842, endLat: 28.6139, endLng: 77.209, arcAlt: 0.25 },
  { order: 4, startLat: 14.5995, startLng: 120.9842, endLat: 52.52, endLng: 13.405, arcAlt: 0.4 },
  { order: 5, startLat: 14.5995, startLng: 120.9842, endLat: -22.9068, endLng: -43.1729, arcAlt: 0.7 },
  { order: 5, startLat: 14.5995, startLng: 120.9842, endLat: 34.0522, endLng: -118.2437, arcAlt: 0.4 },
  { order: 6, startLat: 14.5995, startLng: 120.9842, endLat: 48.8566, endLng: -2.3522, arcAlt: 0.4 },
  { order: 6, startLat: 14.5995, startLng: 120.9842, endLat: -34.6037, endLng: -58.3816, arcAlt: 0.65 },
  { order: 7, startLat: 14.5995, startLng: 120.9842, endLat: 37.5665, endLng: 126.978, arcAlt: 0.15 },
  { order: 7, startLat: 14.5995, startLng: 120.9842, endLat: -6.2088, endLng: 106.8456, arcAlt: 0.15 },
];
