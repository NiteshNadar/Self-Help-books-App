export type SheetId = 'covers' | 'spines' | 'fix' | 'fix2';

export interface SheetSpec {
  id: SheetId;
  url: string;
  width: number;
  height: number;
}

export interface CropBox {
  sheet: SheetId;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type DecadeKey = 'all' | '1950s' | '1960s' | '1970s' | '1980s';

export interface Film {
  index: number;
  id: string;
  title: string;
  romaji: string;
  kanji: string;
  year: number;
  decade: Exclude<DecadeKey, 'all'>;
  genre: string;
  minutes: number;
  synopsis: string;
  aspectRatio: string;
  gauge: string;
  accentHex: string;
}

export interface InkBlobSpec {
  cx: number;
  cy: number;
  delay: number;
}

export const SHEETS: Record<SheetId, SheetSpec> = {
  covers: {
    id: 'covers',
    url: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261029_010644_837e04ca-2418-45c1-b8e0-0233265c4cd5.png&w=1744&q=85',
    width: 1744,
    height: 2336,
  },
  spines: {
    id: 'spines',
    url: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261029_010738_a3e47ead-18f2-4974-9468-06d16a25edc5.png&w=2688&q=85',
    width: 2688,
    height: 1152,
  },
  fix: {
    id: 'fix',
    url: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261029_010831_3ebb874b-93dc-433e-87ed-6299aba720f0.png&w=1520&q=85',
    width: 1520,
    height: 2688,
  },
  fix2: {
    id: 'fix2',
    url: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261029_092020_f96bc094-db7b-46de-9298-074a24e0a3b8.png&w=1520&q=85',
    width: 1520,
    height: 2688,
  },
};

export const CROPS: Record<string, CropBox> = {
  'spine-valley': { sheet: 'spines', x: 266, y: 31, w: 189, h: 1089 },
  'cover-valley': { sheet: 'covers', x: 497, y: 72, w: 344, h: 659 },

  'spine-bluehour': { sheet: 'spines', x: 492, y: 31, w: 189, h: 1089 },
  'cover-bluehour': { sheet: 'covers', x: 914, y: 72, w: 342, h: 659 },

  'spine-river': { sheet: 'fix', x: 197, y: 54, w: 324, h: 2566 },
  'cover-river': { sheet: 'covers', x: 1332, y: 72, w: 344, h: 659 },

  'spine-summer': { sheet: 'spines', x: 937, y: 31, w: 188, h: 1089 },
  'cover-summer': { sheet: 'covers', x: 74, y: 813, w: 344, h: 676 },

  'spine-green': { sheet: 'spines', x: 1157, y: 31, w: 185, h: 1090 },
  'cover-green': { sheet: 'covers', x: 497, y: 815, w: 344, h: 674 },

  'spine-noon': { sheet: 'spines', x: 44, y: 32, w: 184, h: 1088 },
  'cover-noon': { sheet: 'covers', x: 74, y: 72, w: 347, h: 659 },

  'spine-observer': { sheet: 'fix2', x: 371, y: 15, w: 349, h: 2655 },
  'cover-observer': { sheet: 'covers', x: 915, y: 815, w: 342, h: 675 },

  'spine-birds': { sheet: 'spines', x: 1573, y: 31, w: 183, h: 1089 },
  'cover-birds': { sheet: 'covers', x: 1331, y: 815, w: 345, h: 675 },

  'spine-storm': { sheet: 'fix2', x: 808, y: 15, w: 347, h: 2656 },
  'cover-storm': { sheet: 'covers', x: 74, y: 1571, w: 345, h: 681 },

  'spine-tide': { sheet: 'spines', x: 2012, y: 31, w: 188, h: 1089 },
  'cover-tide': { sheet: 'covers', x: 496, y: 1577, w: 343, h: 678 },

  'spine-war': { sheet: 'spines', x: 2236, y: 31, w: 189, h: 1089 },
  'cover-war': { sheet: 'covers', x: 913, y: 1579, w: 343, h: 676 },

  'spine-door': { sheet: 'spines', x: 2462, y: 31, w: 188, h: 1089 },
  'cover-door': { sheet: 'covers', x: 1331, y: 1579, w: 344, h: 677 },
};

export const FILMS: Film[] = [
  {
    index: 0,
    id: 'valley',
    title: 'The Silent Valley',
    romaji: 'SHIZUKANA TANI',
    kanji: '静かな谷',
    year: 1958,
    decade: '1950s',
    genre: 'Drama',
    minutes: 104,
    synopsis:
      'A schoolteacher returns to the mountain village that exiled her father, and finds the valley has kept every one of its secrets.',
    aspectRatio: '1.37:1 Academy',
    gauge: '35mm B&W',
    accentHex: '#1F3FB0',
  },
  {
    index: 1,
    id: 'bluehour',
    title: 'The Blue Hour',
    romaji: 'AO NO TOKI',
    kanji: '青の刻',
    year: 1962,
    decade: '1960s',
    genre: 'Romance',
    minutes: 97,
    synopsis:
      'Over one long evening in a harbour town, a widow and a stranger trade small lies until the light runs out.',
    aspectRatio: '1.66:1 European',
    gauge: '35mm Eastmancolor',
    accentHex: '#1F3FB0',
  },
  {
    index: 2,
    id: 'river',
    title: 'River of Salt',
    romaji: 'SHIO NO KAWA',
    kanji: '塩の川',
    year: 1964,
    decade: '1960s',
    genre: 'Drama',
    minutes: 121,
    synopsis:
      'Two brothers drag a salt barge downriver to a city that no longer wants anything they carry.',
    aspectRatio: '2.35:1 Scope',
    gauge: '35mm Monochrome',
    accentHex: '#C83B2B',
  },
  {
    index: 3,
    id: 'summer',
    title: 'The Last Summer',
    romaji: 'SAIGO NO NATSU',
    kanji: '最後の夏',
    year: 1966,
    decade: '1960s',
    genre: 'Drama',
    minutes: 109,
    synopsis:
      'The summer before the dam floods their village, three friends set fire to everything they cannot take with them.',
    aspectRatio: '1.85:1 Flat',
    gauge: '35mm Fujicolor',
    accentHex: '#C83B2B',
  },
  {
    index: 4,
    id: 'green',
    title: 'The Green Road',
    romaji: 'MIDORI NO MICHI',
    kanji: '緑の道',
    year: 1969,
    decade: '1960s',
    genre: 'Mystery',
    minutes: 101,
    synopsis:
      'A surveyor mapping a forest road keeps finding the same footprints, always one day ahead of him.',
    aspectRatio: '1.66:1 European',
    gauge: '35mm Eastmancolor',
    accentHex: '#1F3FB0',
  },
  {
    index: 5,
    id: 'noon',
    title: 'Noon in Ashes',
    romaji: 'HAI NO SHOGO',
    kanji: '灰の正午',
    year: 1971,
    decade: '1970s',
    genre: 'Western',
    minutes: 112,
    synopsis:
      'A rider crosses a white desert to settle an old debt, and learns too late who sent him.',
    aspectRatio: '2.35:1 Scope',
    gauge: '35mm Technicolor',
    accentHex: '#C83B2B',
  },
  {
    index: 6,
    id: 'observer',
    title: 'The Observer',
    romaji: 'KANSATSUSHA',
    kanji: '観察者',
    year: 1973,
    decade: '1970s',
    genre: 'Thriller',
    minutes: 96,
    synopsis:
      'A night watchman begins to suspect that the building he guards has started watching him back.',
    aspectRatio: '1.85:1 Flat',
    gauge: '35mm Eastmancolor',
    accentHex: '#1F3FB0',
  },
  {
    index: 7,
    id: 'birds',
    title: 'The Fallen Birds',
    romaji: 'OCHITA TORI',
    kanji: '落ちた鳥',
    year: 1975,
    decade: '1970s',
    genre: 'Drama',
    minutes: 118,
    synopsis:
      "When the birds stop singing over a frontier town, the mayor's daughter is the only one who goes looking for the reason.",
    aspectRatio: '1.85:1 Flat',
    gauge: '35mm Fujicolor',
    accentHex: '#C83B2B',
  },
  {
    index: 8,
    id: 'storm',
    title: 'Light in the Storm',
    romaji: 'ARASHI NO HI',
    kanji: '嵐の灯',
    year: 1978,
    decade: '1970s',
    genre: 'Drama',
    minutes: 127,
    synopsis:
      'A lighthouse keeper and his son wait out a three-day storm with a shipwrecked sailor who will not give his name.',
    aspectRatio: '2.35:1 Scope',
    gauge: '35mm Eastmancolor',
    accentHex: '#1F3FB0',
  },
  {
    index: 9,
    id: 'tide',
    title: 'The Long Tide',
    romaji: 'NAGAI SHIO',
    kanji: '長い潮',
    year: 1981,
    decade: '1980s',
    genre: 'Drama',
    minutes: 99,
    synopsis:
      "A fisherman's wife counts the tides on the harbour wall while her husband's boat fails to come home.",
    aspectRatio: '1.66:1 European',
    gauge: '35mm Fujicolor',
    accentHex: '#1F3FB0',
  },
  {
    index: 10,
    id: 'war',
    title: 'A Quiet War',
    romaji: 'SHIZUKANA SENSO',
    kanji: '静かな戦争',
    year: 1985,
    decade: '1980s',
    genre: 'Comedy',
    minutes: 103,
    synopsis:
      'Two neighbours fight a silent war over a garden wall for thirty years, and neither will say how it began.',
    aspectRatio: '1.85:1 Flat',
    gauge: '35mm Eastmancolor',
    accentHex: '#C83B2B',
  },
  {
    index: 11,
    id: 'door',
    title: 'Red Door',
    romaji: 'AKAI TOBIRA',
    kanji: '赤い扉',
    year: 1989,
    decade: '1980s',
    genre: 'Thriller',
    minutes: 114,
    synopsis:
      'A projectionist follows a reel of unknown film through the corridors of a cinema on its final night.',
    aspectRatio: '1.85:1 Flat',
    gauge: '35mm Fujicolor',
    accentHex: '#C83B2B',
  },
];

export const DECADE_TABS: Array<{ key: DecadeKey; label: string; firstFilmIndex: number }> = [
  { key: 'all', label: 'All / すべて', firstFilmIndex: 0 },
  { key: '1950s', label: '1950s', firstFilmIndex: 0 },
  { key: '1960s', label: '1960s', firstFilmIndex: 1 },
  { key: '1970s', label: '1970s', firstFilmIndex: 5 },
  { key: '1980s', label: '1980s', firstFilmIndex: 9 },
];

export const INK_BLOBS: InkBlobSpec[] = [
  { cx: 150, cy: 330, delay: 0 },
  { cx: 340, cy: 600, delay: 120 },
  { cx: 250, cy: 120, delay: 220 },
  { cx: 90, cy: 760, delay: 300 },
  { cx: 400, cy: 250, delay: 360 },
  { cx: 260, cy: 860, delay: 420 },
  { cx: 230, cy: 470, delay: 180 },
];

export const INITIAL_FILM_INDEX = 5; // Noon in Ashes
export const COPIES = 3;
export const FILM_COUNT = FILMS.length;
export const TOTAL_TAPES = FILM_COUNT * COPIES; // 36
export const INITIAL_SCROLL = INITIAL_FILM_INDEX + FILM_COUNT; // 17
