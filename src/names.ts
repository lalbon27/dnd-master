import { chatCompletion, hasGroqKey } from "./groq.js";

const FANTASY_SUFFIXES = ["ир", "ан", "ор", "эль", "ина", "уил", "ард", "ей", "ольд", "ис"];

function proceduralDerive(realName: string): string {
  const base = realName.trim().split(/\s+/)[0] || "Герой";
  const stem = base.slice(0, Math.max(3, Math.ceil(base.length * 0.6)));
  const suffix = FANTASY_SUFFIXES[Math.floor(Math.random() * FANTASY_SUFFIXES.length)];
  return stem[0].toUpperCase() + stem.slice(1).toLowerCase() + suffix;
}

export async function deriveFantasyName(
  realName: string,
  race: string,
  klass: string
): Promise<string> {
  const clean = realName.trim();
  if (!clean) return proceduralDerive("Герой");
  if (!hasGroqKey) return proceduralDerive(clean);

  try {
    const text = await chatCompletion(
      [
        {
          role: "system",
          content:
            "Ты придумываешь короткие фэнтезийные имена для персонажей D&D на основе настоящего имени игрока. " +
            "Имя должно быть узнаваемо созвучно оригиналу (сохраняй часть звучания) и подходить расе и классу персонажа. " +
            "Ответь ровно одним именем на русском, без пояснений, кавычек и точек.",
        },
        { role: "user", content: `Настоящее имя: ${clean}. Раса: ${race}. Класс: ${klass}.` },
      ],
      20
    );

    const cleaned = text.split("\n")[0].replace(/["'«».]/g, "").trim();
    return cleaned || proceduralDerive(clean);
  } catch {
    return proceduralDerive(clean);
  }
}
