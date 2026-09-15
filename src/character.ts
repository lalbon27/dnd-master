import { deriveFantasyName } from "./names.js";

export type Stats = {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
};

export type Character = {
  id: string;
  name: string;
  race: string;
  class: string;
  background: string;
  stats: Stats;
  hp: number;
  ac: number;
  appearance: string;
  motto?: string;
  realName?: string;
  inventory: string[];
  portraitUrl: string;
  selfiePath?: string;
};

export type Archetype = "strength" | "cunning" | "knowledge" | "charisma";
export type Vibe = "reliable" | "bold" | "mysterious" | "funny";

type Bilingual = { ru: string; en: string };

const RACES: Bilingual[] = [
  { ru: "Человек", en: "human" },
  { ru: "Эльф", en: "elf" },
  { ru: "Дворф", en: "dwarf" },
  { ru: "Полурослик", en: "halfling" },
  { ru: "Полуорк", en: "half-orc" },
  { ru: "Тифлинг", en: "tiefling, with small horns" },
  { ru: "Драконорождённый", en: "dragonborn, with scaled skin" },
  { ru: "Гном", en: "gnome" },
];

const CLASSES: Bilingual[] = [
  { ru: "Воин", en: "fighter in armor" },
  { ru: "Плут", en: "rogue in a hooded cloak" },
  { ru: "Маг", en: "wizard with a spellbook" },
  { ru: "Жрец", en: "cleric with holy symbol" },
  { ru: "Следопыт", en: "ranger with a bow" },
  { ru: "Варвар", en: "barbarian with a big axe" },
  { ru: "Бард", en: "bard with a lute" },
  { ru: "Друид", en: "druid with wild vines and leaves" },
];

const BACKGROUNDS = [
  "беглый каторжник",
  "бывший солдат",
  "цеховой подмастерье",
  "странствующий торговец",
  "храмовый послушник",
  "изгнанный дворянин",
  "браконьер из глухого леса",
  "моряк дальнего плавания",
];

const NAME_PARTS = {
  first: ["Ар", "Бри", "Кор", "Дэл", "Эль", "Фин", "Гарв", "Ирвэ", "Кайл", "Лор", "Мир", "Нэв"],
  last: ["ин", "он", "ард", "ель", "гор", "ис", "ольд", "вин", "ей", "ик"],
};

const HAIR: Bilingual[] = [
  { ru: "чёрные", en: "black hair" },
  { ru: "русые", en: "light brown hair" },
  { ru: "рыжие", en: "red hair" },
  { ru: "седые", en: "grey hair" },
  { ru: "белые как снег", en: "snow-white hair" },
  { ru: "выбритые наголо", en: "shaved bald head" },
];
const EYES: Bilingual[] = [
  { ru: "карие", en: "brown eyes" },
  { ru: "серые", en: "grey eyes" },
  { ru: "зелёные", en: "green eyes" },
  { ru: "голубые", en: "blue eyes" },
  { ru: "янтарные", en: "amber eyes" },
  { ru: "разного цвета", en: "heterochromia, mismatched eyes" },
];
const BUILD: Bilingual[] = [
  { ru: "худощавого", en: "lean" },
  { ru: "коренастого", en: "stocky" },
  { ru: "жилистого", en: "wiry" },
  { ru: "массивного", en: "massive, muscular" },
  { ru: "среднего", en: "average build" },
];
const FEATURE: Bilingual[] = [
  { ru: "шрам через бровь", en: "scar across the eyebrow" },
  { ru: "татуировка на предплечье", en: "tattoo on the forearm" },
  { ru: "хромота на левую ногу", en: "leaning on a cane" },
  { ru: "птичья клетка на поясе", en: "small birdcage on the belt" },
  { ru: "потемневшие от ожога пальцы", en: "burn-scarred fingers" },
  { ru: "серьга в виде клыка", en: "fang-shaped earring" },
  { ru: "выцветший плащ с чужим гербом", en: "faded cloak with a foreign crest" },
  { ru: "привычка постоянно что-то насвистывать", en: "whistling, cheerful expression" },
];
const CLOTHES: Bilingual[] = [
  { ru: "потрёпанная кожаная броня", en: "worn leather armor" },
  { ru: "дорожный плащ с капюшоном", en: "hooded travel cloak" },
  { ru: "простая холщовая роба", en: "simple canvas robe" },
  { ru: "начищенная кольчуга", en: "polished chainmail" },
  { ru: "яркий, почти шутовской наряд", en: "colorful, flamboyant outfit" },
  { ru: "тёмные одежды без единого украшения", en: "plain dark clothes" },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rollD6(): number {
  return 1 + Math.floor(Math.random() * 6);
}

function rollStat(): number {
  const rolls = [rollD6(), rollD6(), rollD6(), rollD6()].sort((a, b) => b - a);
  return rolls[0] + rolls[1] + rolls[2];
}

function rollStats(): Stats {
  return {
    str: rollStat(),
    dex: rollStat(),
    con: rollStat(),
    int: rollStat(),
    wis: rollStat(),
    cha: rollStat(),
  };
}

function modifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function randomName(): string {
  return pick(NAME_PARTS.first) + pick(NAME_PARTS.last);
}

const ARCHETYPE_CLASSES: Record<Archetype, string[]> = {
  strength: ["Воин", "Варвар"],
  cunning: ["Плут", "Следопыт"],
  knowledge: ["Маг", "Жрец"],
  charisma: ["Бард", "Друид"],
};

const VIBE_TRAITS: Record<Vibe, Bilingual> = {
  reliable: { ru: "смотрит прямо и говорит по делу", en: "calm, steady expression" },
  bold: { ru: "дерзкая ухмылка не сходит с лица", en: "confident, cocky grin" },
  mysterious: { ru: "взгляд скрывает больше, чем говорят слова", en: "enigmatic, shadowed expression" },
  funny: { ru: "вечно щурится, будто вот-вот пошутит", en: "playful smirk" },
};

const STARTING_GEAR = [
  "фляга с водой",
  "верёвка (15 м)",
  "трутница",
  "сухой паёк на 3 дня",
  "мешок",
  "факел",
];

function randomInventory(): string[] {
  const count = 2 + Math.floor(Math.random() * 2);
  const shuffled = [...STARTING_GEAR].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function portraitUrl(prompt: string, seed: number): string {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=512&height=640&seed=${seed}&nologo=true`;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `char_${Date.now()}_${counter}`;
}

export type GenerateOptions = Partial<
  Pick<Character, "name" | "race" | "class" | "motto" | "selfiePath" | "realName">
> & {
  archetype?: Archetype;
  vibe?: Vibe;
};

export async function buildCharacter(
  overrides: GenerateOptions = {}
): Promise<{ character: Character; portraitPrompt: string }> {
  const raceEntry = RACES.find((r) => r.ru === overrides.race) ?? pick(RACES);
  const classPool = overrides.archetype
    ? CLASSES.filter((c) => ARCHETYPE_CLASSES[overrides.archetype!].includes(c.ru))
    : CLASSES;
  const classEntry =
    CLASSES.find((c) => c.ru === overrides.class) ?? pick(classPool.length ? classPool : CLASSES);
  const hair = pick(HAIR);
  const eyes = pick(EYES);
  const build = pick(BUILD);
  const feature = pick(FEATURE);
  const clothes = pick(CLOTHES);
  const vibeTrait = overrides.vibe ? VIBE_TRAITS[overrides.vibe] : null;

  const stats = rollStats();
  const con = modifier(stats.con);
  const baseHpByClass: Record<string, number> = {
    Воин: 10,
    Варвар: 12,
    Плут: 8,
    Маг: 6,
    Жрец: 8,
    Следопыт: 10,
    Бард: 8,
    Друид: 8,
  };
  const hp = Math.max(1, (baseHpByClass[classEntry.ru] ?? 8) + con);
  const ac = 10 + modifier(stats.dex);

  const appearance = [
    `${build.ru} телосложения ${raceEntry.ru.toLowerCase()}, ${hair.ru} волосы, ${eyes.ru} глаза.`,
    `Носит ${clothes.ru}. Особая примета: ${feature.ru}.`,
    vibeTrait ? `${vibeTrait.ru[0].toUpperCase()}${vibeTrait.ru.slice(1)}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const prompt = [
    "fantasy character portrait,",
    `${build.en} ${raceEntry.en} ${classEntry.en},`,
    `${hair.en}, ${eyes.en},`,
    `wearing ${clothes.en},`,
    `${feature.en}${vibeTrait ? `, ${vibeTrait.en}` : ""},`,
    "detailed digital painting, dnd character art, dramatic lighting",
  ].join(" ");

  const id = nextId();
  const seed = Number(id.replace(/\D/g, "").slice(-8)) || Math.floor(Math.random() * 1e8);

  const realName = overrides.realName?.trim();
  const name = realName
    ? await deriveFantasyName(realName, raceEntry.ru, classEntry.ru)
    : overrides.name?.trim() || randomName();

  const character: Character = {
    id,
    name,
    race: raceEntry.ru,
    class: classEntry.ru,
    background: pick(BACKGROUNDS),
    stats,
    hp,
    ac,
    appearance,
    motto: overrides.motto?.trim() || undefined,
    realName: realName || undefined,
    inventory: randomInventory(),
    portraitUrl: portraitUrl(prompt, seed),
    selfiePath: overrides.selfiePath,
  };

  return { character, portraitPrompt: prompt };
}

export async function generateCharacter(overrides: GenerateOptions = {}): Promise<Character> {
  const { character } = await buildCharacter(overrides);
  return character;
}
