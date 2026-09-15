export type RoomTag = "start" | "empty" | "monster" | "trap" | "treasure" | "boss";

export type Room = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  tag: RoomTag;
  note: string;
};

export type ThemeKey = "ice" | "volcano" | "swamp" | "crypt" | "coral" | "mushroom";

export type Dungeon = {
  width: number;
  height: number;
  grid: number[][]; // 0 = стена, 1 = пол
  rooms: Room[];
  theme: string;
  themeKey: ThemeKey;
  splashImageUrl: string;
};

const THEMES: { ru: string; key: ThemeKey }[] = [
  { ru: "Ледяная пещера", key: "ice" },
  { ru: "Вулканическая кузница", key: "volcano" },
  { ru: "Затопленные руины", key: "swamp" },
  { ru: "Древняя гробница", key: "crypt" },
  { ru: "Коралловая грот", key: "coral" },
  { ru: "Грибной лес", key: "mushroom" },
];

// Атмосферная заставка локации — не карта, а живописная иллюстрация "момента",
// в духе обложек актуал-плей шоу (Подземелья Чикен Карри и т.п.). Тут глаголы
// вроде "glowing"/"misty"/"dramatic" наоборот работают на нас, в отличие от
// промпта для тактической карты, где они ломали вид сверху.
const SPLASH_SCENE: Record<ThemeKey, string> = {
  ice: "vast ice crystal cavern, towering glowing blue ice formations, frozen underground lake, cold mist, shafts of light",
  volcano: "underground volcanic forge, rivers of molten lava, glowing embers, black obsidian rock, heat haze",
  swamp: "overgrown flooded ruins, ancient stone pillars wrapped in vines, murky green water, fireflies, mist",
  crypt: "ancient stone crypt, rows of cracked sarcophagi, cobwebs, flickering torchlight, dust in the air",
  coral: "bioluminescent underground sea cave, glowing coral formations, crystal-clear lagoon, soft blue light",
  mushroom: "giant glowing mushroom forest cavern, bioluminescent fungi, purple and teal glow, misty atmosphere",
};

function splashImageUrl(themeKey: ThemeKey, seed: number): string {
  const prompt = [
    "digital painting, dynamic fantasy RPG scene illustration, actual play tabletop RPG cover art,",
    `${SPLASH_SCENE[themeKey]},`,
    "dramatic cinematic lighting, painterly digital illustration, vibrant colors, atmospheric, highly detailed, epic fantasy adventure mood",
  ].join(" ");
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=1200&height=675&seed=${seed}&model=flux&nologo=true`;
}

const WIDTH = 32;
const HEIGHT = 20;
const MIN_ROOM = 3;
const MAX_ROOM = 6;
const ROOM_ATTEMPTS = 60;
const TARGET_ROOMS = 7;

const MONSTER_NOTES = [
  "логово гоблинов, воняет гнилым мясом",
  "стая гигантских крыс в тенях",
  "спящий пещерный тролль",
  "культисты у алтаря",
  "скелеты-стражники встают при приближении",
];
const TRAP_NOTES = [
  "нажимная плита с дротиками в стенах",
  "яма-ловушка, прикрытая гнилыми досками",
  "рунный символ, вспыхивающий огнём",
  "растяжка, обрушивающая потолок",
];
const TREASURE_NOTES = [
  "сундук, окованный железом",
  "алтарь с драгоценным подношением",
  "тайник за фальшивой стеной",
  "тело незадачливого искателя приключений с добычей",
];
const EMPTY_NOTES = [
  "пыльная пустая комната",
  "обрушившийся свод, проход завален",
  "старый лагерь, давно покинутый",
  "эхо капающей где-то воды",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rectsOverlap(a: Room, b: Room, padding = 1): boolean {
  return (
    a.x - padding < b.x + b.w &&
    a.x + a.w + padding > b.x &&
    a.y - padding < b.y + b.h &&
    a.y + a.h + padding > b.y
  );
}

function carveRoom(grid: number[][], room: Room) {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      grid[y][x] = 1;
    }
  }
}

function carveCorridor(grid: number[][], x1: number, y1: number, x2: number, y2: number) {
  let x = x1;
  let y = y1;
  while (x !== x2) {
    grid[y][x] = 1;
    x += x < x2 ? 1 : -1;
  }
  while (y !== y2) {
    grid[y][x] = 1;
    y += y < y2 ? 1 : -1;
  }
  grid[y][x] = 1;
}

function roomCenter(r: Room): [number, number] {
  return [Math.floor(r.x + r.w / 2), Math.floor(r.y + r.h / 2)];
}

function tagRoom(index: number, total: number): { tag: RoomTag; note: string } {
  if (index === 0) return { tag: "start", note: "здесь начинается путь отряда" };
  if (index === total - 1) return { tag: "boss", note: "логово хозяина подземелья" };
  const roll = Math.random();
  if (roll < 0.3) return { tag: "monster", note: pick(MONSTER_NOTES) };
  if (roll < 0.5) return { tag: "trap", note: pick(TRAP_NOTES) };
  if (roll < 0.7) return { tag: "treasure", note: pick(TREASURE_NOTES) };
  return { tag: "empty", note: pick(EMPTY_NOTES) };
}

export function generateDungeon(): Dungeon {
  const grid: number[][] = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(0));
  const rooms: Room[] = [];

  for (let attempt = 0; attempt < ROOM_ATTEMPTS && rooms.length < TARGET_ROOMS; attempt++) {
    const w = MIN_ROOM + Math.floor(Math.random() * (MAX_ROOM - MIN_ROOM + 1));
    const h = MIN_ROOM + Math.floor(Math.random() * (MAX_ROOM - MIN_ROOM + 1));
    const x = 1 + Math.floor(Math.random() * (WIDTH - w - 2));
    const y = 1 + Math.floor(Math.random() * (HEIGHT - h - 2));
    const candidate: Room = { id: rooms.length, x, y, w, h, tag: "empty", note: "" };

    if (rooms.some((r) => rectsOverlap(candidate, r))) continue;
    rooms.push(candidate);
  }

  rooms.forEach((room) => carveRoom(grid, room));

  for (let i = 1; i < rooms.length; i++) {
    const [x1, y1] = roomCenter(rooms[i - 1]);
    const [x2, y2] = roomCenter(rooms[i]);
    carveCorridor(grid, x1, y1, x2, y2);
  }

  rooms.forEach((room, i) => {
    const { tag, note } = tagRoom(i, rooms.length);
    room.tag = tag;
    room.note = note;
  });

  const theme = pick(THEMES);
  const seed = Math.floor(Math.random() * 1e8);

  return {
    width: WIDTH,
    height: HEIGHT,
    grid,
    rooms,
    theme: theme.ru,
    themeKey: theme.key,
    splashImageUrl: splashImageUrl(theme.key, seed),
  };
}
