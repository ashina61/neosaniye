/**
 * EUROPE, 1939 — AS COORDINATES, NOT AS A PICTURE.
 *
 * The one graphic a film about the start of a war cannot do without, and the
 * one thing that separates a documentary from a slideshow: a map the viewer can
 * READ. Borders that draw themselves, territory that fills, arrows that sweep
 * along a real path between two real places.
 *
 * These are longitude/latitude, simplified to between twelve and twenty points
 * a country — enough that Poland is recognisably Poland and the Baltic is where
 * the Baltic goes, few enough that the whole continent is one SVG the renderer
 * can draw sixty times a second without thinking about it.
 *
 * Equirectangular, FITTED TO THE VIEWBOX: longitude -12..42 and latitude 71..36
 * map onto 0..100 in both axes. The first pass used constants that put northern
 * Norway at y = -25 and left the whole continent in the top-left corner with
 * Scandinavia outside the frame — a map is not a map if it does not fit the
 * paper. At these bounds the two scales are within one percent of each other at
 * fifty degrees north, so the shapes are not stretched either.
 */

export type Country = {
  id: string;
  name: string;
  /** Longitude/latitude pairs, closed automatically. */
  points: [number, number][];
};

/** lon/lat → viewBox units. The viewBox is 0 0 100 100. */
export const project = ([lon, lat]: [number, number]): [number, number] => [
  (lon + 12) * 1.85,
  (71 - lat) * 2.857,
];

export const pathOf = (points: [number, number][]): string =>
  `${points
    .map((p, i) => {
      const [x, y] = project(p);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ')} Z`;

export const COUNTRIES: Country[] = [
  {
    id: 'gb',
    name: 'Britanya',
    points: [
      [-5.0, 58.6], [-3.0, 58.6], [-2.0, 57.0], [-1.5, 55.0], [0.5, 53.0], [1.7, 52.7],
      [1.3, 51.4], [-1.0, 50.7], [-5.0, 50.0], [-5.5, 51.5], [-3.0, 53.4], [-4.8, 54.0],
      [-5.0, 55.5], [-5.8, 57.5],
    ],
  },
  {
    id: 'ie',
    name: 'İrlanda',
    points: [[-10.0, 54.3], [-7.5, 55.3], [-6.0, 54.6], [-6.0, 52.2], [-9.5, 51.6], [-10.3, 53.3]],
  },
  {
    id: 'fr',
    name: 'Fransa',
    points: [
      [2.5, 51.1], [0.0, 49.5], [-1.6, 49.7], [-1.9, 48.7], [-4.8, 48.6], [-4.4, 47.8],
      [-1.2, 46.3], [-1.4, 44.4], [-1.8, 43.4], [3.1, 42.4], [6.6, 43.0], [7.5, 43.8],
      [7.0, 45.5], [6.8, 47.0], [7.6, 47.6], [8.2, 48.9], [6.4, 49.5], [4.2, 49.9],
    ],
  },
  {
    id: 'es',
    name: 'İspanya',
    points: [
      [-1.8, 43.4], [-9.0, 43.7], [-9.5, 41.9], [-8.9, 38.7], [-7.4, 37.2], [-5.6, 36.0],
      [-2.1, 36.7], [0.9, 38.0], [3.1, 41.9], [3.1, 42.4],
    ],
  },
  {
    id: 'de',
    name: 'Almanya',
    points: [
      [7.1, 53.7], [8.5, 54.9], [9.9, 54.8], [11.0, 54.4], [12.5, 54.5], [14.1, 53.9],
      [14.7, 52.1], [15.0, 51.0], [14.3, 51.0], [12.9, 50.4], [12.1, 50.3], [12.5, 49.5],
      [13.8, 48.8], [13.0, 47.5], [10.5, 47.5], [8.6, 47.6], [7.6, 47.6], [7.6, 49.0],
      [6.4, 49.5], [6.1, 50.1], [6.0, 51.0], [6.8, 51.9],
    ],
  },
  {
    id: 'pl',
    name: 'Polonya',
    points: [
      [14.1, 53.9], [16.5, 54.6], [18.6, 54.7], [19.6, 54.4], [22.8, 54.4], [23.5, 53.9],
      [23.9, 52.7], [23.2, 52.3], [23.6, 51.5], [24.1, 50.4], [22.6, 49.6], [20.9, 49.3],
      [19.8, 49.2], [18.9, 49.5], [17.6, 50.0], [16.9, 50.4], [15.0, 51.0], [14.7, 52.1],
    ],
  },
  {
    id: 'su',
    name: 'Sovyetler',
    points: [
      [23.9, 52.7], [25.5, 55.2], [28.0, 56.5], [30.5, 58.0], [40.0, 58.0], [42.0, 46.0],
      [33.0, 44.5], [28.5, 45.5], [26.5, 48.3], [24.1, 50.4], [23.6, 51.5], [23.2, 52.3],
    ],
  },
  {
    id: 'cs',
    name: 'Çekoslovakya',
    points: [
      [12.1, 50.3], [12.9, 50.4], [14.3, 51.0], [15.0, 51.0], [16.9, 50.4], [17.6, 50.0],
      [18.9, 49.5], [19.8, 49.2], [22.6, 49.6], [22.1, 48.5], [19.0, 48.0], [17.2, 48.0],
      [16.9, 48.6], [15.0, 48.9], [13.8, 48.8], [12.5, 49.5],
    ],
  },
  {
    id: 'lo',
    name: 'Benelüks',
    points: [[2.5, 51.1], [4.2, 49.9], [6.4, 49.5], [6.1, 50.1], [6.0, 51.0], [6.8, 51.9], [7.1, 53.7], [5.0, 53.5], [3.4, 51.5]],
  },
  {
    id: 'dk',
    name: 'Danimarka',
    points: [[8.1, 55.0], [8.2, 57.1], [10.6, 57.7], [10.9, 56.5], [12.6, 56.0], [12.0, 54.9], [9.9, 54.8], [8.5, 54.9]],
  },
  {
    id: 'no',
    name: 'İskandinavya',
    points: [
      [4.9, 58.1], [5.0, 62.0], [10.5, 65.0], [15.0, 68.5], [21.0, 70.0], [28.0, 70.5],
      [30.0, 68.0], [24.0, 65.5], [24.0, 61.0], [21.5, 60.0], [18.0, 59.3], [16.5, 56.2],
      [12.9, 55.4], [11.4, 58.5], [8.5, 58.2],
    ],
  },
  {
    id: 'fi',
    name: 'Finlandiya',
    points: [[21.5, 60.0], [24.0, 61.0], [24.0, 65.5], [30.0, 68.0], [31.5, 62.5], [27.5, 60.5], [25.0, 60.0]],
  },
  {
    id: 'it',
    name: 'İtalya',
    points: [
      [7.0, 45.5], [7.5, 43.8], [10.2, 42.9], [12.4, 41.3], [15.0, 40.0], [17.0, 40.5],
      [18.5, 40.1], [16.2, 41.9], [13.5, 43.6], [12.4, 45.5], [13.6, 45.7], [13.0, 47.5],
      [10.5, 47.5], [8.6, 47.6], [6.8, 47.0],
    ],
  },
  {
    id: 'hu',
    name: 'Macaristan',
    points: [[16.9, 48.6], [17.2, 48.0], [19.0, 48.0], [22.1, 48.5], [22.9, 47.9], [21.0, 45.9], [18.9, 45.8], [16.4, 46.5]],
  },
  {
    id: 'ro',
    name: 'Romanya',
    points: [[22.9, 47.9], [26.5, 48.3], [28.5, 45.5], [29.6, 44.9], [27.0, 43.7], [22.7, 44.2], [21.0, 45.9]],
  },
  {
    id: 'yu',
    name: 'Balkanlar',
    points: [[13.6, 45.7], [16.4, 46.5], [18.9, 45.8], [21.0, 45.9], [22.7, 44.2], [23.0, 41.4], [21.0, 40.1], [19.3, 40.0], [18.5, 42.5], [15.3, 44.2]],
  },
  {
    id: 'gr',
    name: 'Yunanistan',
    points: [[21.0, 40.1], [23.0, 41.4], [26.0, 41.3], [26.6, 40.0], [23.5, 38.0], [22.0, 36.8], [21.1, 38.3], [19.3, 40.0]],
  },
];

/**
 * WHERE THE ARROWS GO.
 *
 * Real places, because a documentary arrow that starts nowhere in particular is
 * a decoration. Three German axes into Poland on 1 September and one Soviet
 * axis from the east on the 17th — which is the shape of the campaign and the
 * reason it took five weeks rather than five months.
 */
export type Thrust = {from: [number, number]; to: [number, number]; bend: number; at: number};

export const GERMAN_THRUSTS: Thrust[] = [
  {from: [12.4, 54.0], to: [20.0, 52.6], bend: -8, at: 0}, // Pomerania → Warsaw from the north
  {from: [14.6, 52.3], to: [20.4, 52.2], bend: 0, at: 0.12}, // Brandenburg → Warsaw, the direct axis
  {from: [18.0, 49.6], to: [21.2, 51.4], bend: 7, at: 0.24}, // Slovakia → Lublin from the south
];

export const SOVIET_THRUSTS: Thrust[] = [
  {from: [27.5, 53.9], to: [22.6, 52.2], bend: 5, at: 0},
  {from: [26.3, 50.6], to: [22.0, 50.2], bend: -4, at: 0.14},
];

/** A quadratic arc between two places, bent so it reads as a sweep. */
export const arcOf = (thrust: Thrust): string => {
  const [x1, y1] = project(thrust.from);
  const [x2, y2] = project(thrust.to);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return `M${x1.toFixed(2)},${y1.toFixed(2)} Q${(mx - (dy / len) * thrust.bend).toFixed(2)},${(
    my +
    (dx / len) * thrust.bend
  ).toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}`;
};

/** Cities worth naming. A map with no names on it is a shape. */
export const CITIES: {name: string; at: [number, number]}[] = [
  {name: 'BERLİN', at: [13.4, 52.5]},
  {name: 'VARŞOVA', at: [21.0, 52.2]},
  {name: 'MOSKOVA', at: [37.6, 55.8]},
  {name: 'PARİS', at: [2.35, 48.85]},
  {name: 'LONDRA', at: [-0.13, 51.5]},
];
