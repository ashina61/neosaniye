/**
 * A 1939 STAFF MAP — the geography a campaign is actually fought over.
 *
 * The first version of this map was seventeen polygons and it looked like
 * seventeen polygons. What makes a map read as a MAP is not vertex count, it is
 * the four things every printed military map has and no outline drawing does:
 *
 *   RIVERS   the Vistula, the Bug, the San, the Narew. These are not decoration
 *            in this particular story — they are where the campaign happened.
 *            Poland's whole defensive plan was to trade space for the river
 *            lines and hold on the Vistula until France attacked in the west.
 *   RELIEF   the Carpathians close the southern flank; the fact that they do is
 *            why Army Group South came through Slovakia instead of over them.
 *   FOREST   the Kampinos and the Tuchola woods, which are where two of the
 *            encirclements actually closed.
 *   PAPER    a graticule, a fold, a printed tone. A map floating on black is a
 *            diagram; a map on paper is a document somebody was reading in a
 *            room in 1939.
 *
 * Everything is longitude/latitude, so the projection in `map.tsx` places all
 * of it consistently and the camera can push in on any of it.
 */

export type Line = [number, number][];

/* ------------------------------------------------------------------ SEA -- */

/** The coastlines that frame the theatre, at enough resolution to be read. */
export const COAST_BALTIC: Line = [
  [10.0, 54.4], [11.4, 54.4], [12.5, 54.5], [13.8, 54.1], [14.3, 53.9], [15.2, 54.1],
  [16.2, 54.3], [17.1, 54.5], [18.4, 54.6], [18.9, 54.4], [19.4, 54.4], [19.9, 54.4],
  [20.6, 54.9], [21.2, 55.3], [21.1, 56.1], [21.0, 56.8], [22.5, 57.5], [24.0, 57.3],
  [24.4, 58.4], [26.5, 58.6], [28.2, 59.4], [30.3, 59.9],
];

export const COAST_NORTH: Line = [
  [-2.0, 51.0], [1.4, 51.4], [3.4, 51.5], [4.3, 52.0], [5.0, 53.0], [6.7, 53.5],
  [8.1, 53.7], [8.5, 54.9], [9.6, 55.5], [10.6, 57.7], [11.4, 58.5], [12.9, 56.2],
];

/* --------------------------------------------------------------- RIVERS -- */

/**
 * THE LINES THE WAR WAS FOUGHT ON.
 *
 * Ordered west to east, which is also the order they were lost.
 */
export const RIVERS: {name: string; line: Line; big?: boolean}[] = [
  {
    name: 'Ren',
    line: [[8.2, 47.6], [7.6, 48.6], [8.3, 49.9], [7.0, 50.7], [6.2, 51.8], [5.9, 52.5], [4.6, 51.9]],
  },
  {
    name: 'Elbe',
    line: [[14.3, 50.6], [13.8, 51.4], [12.2, 52.5], [11.0, 53.2], [9.8, 53.5], [9.0, 53.9]],
  },
  {
    name: 'Tuna',
    line: [
      [8.5, 48.5], [11.5, 48.8], [13.5, 48.6], [16.4, 48.1], [19.0, 47.8], [18.9, 45.9],
      [21.0, 45.0], [24.0, 44.0], [28.7, 45.2],
    ],
  },
  {
    name: 'Oder',
    big: true,
    line: [[18.0, 49.6], [17.5, 50.8], [16.5, 51.5], [15.0, 52.0], [14.6, 52.6], [14.3, 53.6], [14.5, 53.9]],
  },
  {
    name: 'Warta',
    line: [[19.0, 50.6], [18.0, 51.7], [16.5, 52.4], [15.0, 52.6], [14.6, 52.6]],
  },
  {
    name: 'Vistül',
    big: true,
    line: [
      [18.9, 49.6], [19.9, 50.05], [20.9, 50.4], [21.7, 50.7], [21.6, 51.4], [21.0, 52.25],
      [20.0, 52.6], [18.6, 53.0], [18.8, 53.7], [18.7, 54.35],
    ],
  },
  {
    name: 'San',
    line: [[22.7, 49.2], [22.4, 49.7], [22.0, 50.2], [21.7, 50.7]],
  },
  {
    name: 'Narew',
    line: [[23.0, 53.2], [22.0, 53.1], [21.2, 52.9], [20.9, 52.5]],
  },
  {
    name: 'Bug',
    big: true,
    line: [[24.5, 49.9], [23.6, 50.7], [23.5, 51.5], [23.2, 52.3], [21.9, 52.6], [21.1, 52.4]],
  },
  {
    name: 'Dinyeper',
    line: [[31.0, 54.8], [30.5, 52.5], [31.0, 50.5], [30.5, 48.5], [34.0, 47.0], [32.5, 46.5]],
  },
];

/* --------------------------------------------------------------- RELIEF -- */

/**
 * MOUNTAINS, DRAWN THE WAY MAPS DRAW THEM.
 *
 * A ridge line with hachure teeth along it — the convention every printed map
 * used before shaded relief, and the one that survives being two pixels tall on
 * a phone. A grey blob does not read as high ground; a row of little peaks
 * does, instantly, without a legend.
 */
export const RIDGES: {line: Line; weight: number}[] = [
  {line: [[6.0, 46.2], [8.5, 46.6], [11.0, 47.0], [13.5, 47.2], [15.5, 46.9]], weight: 1.5}, // Alps
  {line: [[19.0, 49.6], [20.5, 49.4], [22.0, 49.2], [23.5, 48.6], [25.0, 47.9]], weight: 1.2}, // Carpathians
  {line: [[15.3, 50.8], [16.4, 50.6], [17.4, 50.3]], weight: 0.85}, // Sudetes
  {line: [[12.4, 49.2], [13.4, 49.1], [14.0, 48.8]], weight: 0.8}, // Bohemian forest
  {line: [[19.5, 49.2], [20.2, 49.2]], weight: 0.7}, // Tatras
  {line: [[7.5, 61.5], [11.0, 62.5], [14.0, 64.5], [17.5, 67.0]], weight: 1.0}, // Scandinavian
  {line: [[-3.5, 43.0], [0.5, 42.7], [2.0, 42.4]], weight: 0.9}, // Pyrenees
  {line: [[11.0, 44.2], [13.5, 42.5], [15.5, 41.0]], weight: 0.85}, // Apennines
];

/**
 * FOREST. Two of the encirclements closed in woodland, so the woods are on the
 * map for the same reason the rivers are: they are terrain that decided things.
 */
export const FORESTS: {at: [number, number]; r: number}[] = [
  {at: [20.4, 52.35], r: 0.55}, // Kampinos, north-west of Warsaw
  {at: [17.9, 53.6], r: 0.7}, // Tuchola
  {at: [23.8, 52.7], r: 0.9}, // Białowieża
  {at: [13.6, 52.9], r: 0.5},
  {at: [15.6, 53.4], r: 0.45},
  {at: [22.6, 50.4], r: 0.6},
  {at: [11.0, 51.7], r: 0.45},
  {at: [9.5, 49.5], r: 0.5},
];

/* ------------------------------------------------------------ THE FRONT -- */

/**
 * THE LINE, AND WHERE IT WENT.
 *
 * Same number of points in both, so one interpolates into the other and the
 * front DEFORMS rather than being redrawn. A front that jumps from one shape to
 * another is two diagrams; a front that bends is an army being pushed.
 *
 * `START` is the German-Polish border on 31 August. `MID` is roughly 8
 * September, with the Poznań army already cut off in the west and the northern
 * pincer past the Narew. `END` is the Vistula-Bug line either side of the
 * Soviet entry on the 17th.
 */
export const FRONT_START: Line = [
  [19.6, 54.4], [18.6, 54.0], [17.4, 53.4], [16.6, 52.6], [16.3, 51.8], [17.0, 51.0],
  [18.2, 50.4], [19.4, 49.9], [20.8, 49.4], [22.4, 49.5],
];

export const FRONT_MID: Line = [
  [20.6, 54.3], [20.4, 53.6], [20.2, 52.9], [19.8, 52.4], [19.4, 51.7], [19.6, 51.0],
  [20.2, 50.5], [20.8, 50.0], [21.4, 49.6], [22.6, 49.5],
];

export const FRONT_END: Line = [
  [22.8, 54.2], [22.6, 53.5], [22.4, 52.9], [22.0, 52.4], [22.2, 51.6], [22.6, 51.0],
  [22.8, 50.4], [23.0, 49.9], [23.4, 49.6], [24.0, 49.5],
];

/**
 * THE POCKETS.
 *
 * The thing a set of arrows cannot say on its own: an army that has been
 * SURROUNDED. Bzura is the big one — the Poznań and Pomorze armies caught west
 * of Warsaw, the largest battle of the campaign — and Warsaw itself held out
 * inside its own ring until the 28th.
 */
export const POCKETS: {name: string; at: [number, number]; rx: number; ry: number; at01: number}[] = [
  {name: 'BZURA', at: [19.6, 52.4], rx: 1.5, ry: 0.85, at01: 0.55},
  {name: 'VARŞOVA', at: [21.0, 52.25], rx: 0.7, ry: 0.42, at01: 0.8},
];

/* ------------------------------------------------------------ FORMATION -- */

/**
 * UNIT MARKERS, in the notation staff maps actually use.
 *
 * A rectangle with a diagonal cross is infantry; with an oval it is armour.
 * Two symbols, and anyone who has seen a war documentary reads them without
 * being told — which is worth more than any label, because a label has to be
 * read and a symbol is recognised.
 */
export type Unit = {at: [number, number]; to: [number, number]; kind: 'armour' | 'infantry'; side: 'de' | 'pl' | 'su'; at01: number};

export const UNITS: Unit[] = [
  {at: [16.2, 54.0], to: [20.2, 53.2], kind: 'armour', side: 'de', at01: 0.05},
  {at: [15.0, 52.4], to: [20.4, 52.3], kind: 'armour', side: 'de', at01: 0.0},
  {at: [17.2, 50.6], to: [21.0, 51.2], kind: 'infantry', side: 'de', at01: 0.15},
  {at: [19.2, 49.4], to: [22.2, 50.6], kind: 'armour', side: 'de', at01: 0.25},
  {at: [19.4, 52.5], to: [19.7, 52.4], kind: 'infantry', side: 'pl', at01: 0.0},
  {at: [21.2, 52.1], to: [21.1, 52.2], kind: 'infantry', side: 'pl', at01: 0.0},
  {at: [22.0, 50.8], to: [22.4, 50.6], kind: 'infantry', side: 'pl', at01: 0.0},
];
