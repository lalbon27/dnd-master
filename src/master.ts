import type { CampaignState } from "./state.js";
import { chatCompletion, hasGroqKey, type ChatMessage } from "./groq.js";

function dungeonSummary(state: CampaignState): string {
  if (!state.dungeon) return "Карта подземелья ещё не сгенерирована.";
  const rooms = state.dungeon.rooms
    .map((r) => `- Комната ${r.id} [${r.tag}]: ${r.note}`)
    .join("\n");
  return `Подземелье: ${state.dungeon.theme}.\nКомнаты подземелья:\n${rooms}`;
}

function partySummary(state: CampaignState): string {
  if (state.characters.length === 0) return "Персонажи ещё не созданы.";
  return state.characters
    .map(
      (c) =>
        `- ${c.name}, ${c.race} ${c.class}, HP ${c.hp}, AC ${c.ac}. ${c.background}. ${c.appearance}` +
        (c.motto ? ` Девиз героя: «${c.motto}».` : "")
    )
    .join("\n");
}

function buildSystemPrompt(state: CampaignState): string {
  return [
    "Ты — опытный мастер подземелий в игре по мотивам D&D 5e, ведущий партию на русском языке.",
    "Твой стиль: атмосферно, кратко и по делу — 3-6 предложений на реплику, без длинных лекций.",
    "Описывай последствия действий игроков, окружение, звуки, опасности. Держи интригу.",
    "Если действие рискованное — предложи бросок кубика (d20 + модификатор) и жди результат, не решай исход сам, если не очевиден.",
    "Не говори от лица игроков и не решай за них, что они делают.",
    "",
    partySummary(state),
    "",
    dungeonSummary(state),
  ].join("\n");
}

const FALLBACK_LINES = [
  "Мастер (без ключа) кивает: «Действие принято. Тени вокруг сгущаются, но что происходит дальше — решать тебе за столом.»",
  "Мастер разводит руками: «Настрой GROQ_API_KEY в .env, чтобы я по-настоящему описывал происходящее. Пока просто фиксирую твой ход.»",
  "Мастер делает пометку в тетради и молча смотрит на тебя, ожидая, что ты продолжишь сам.",
];

const FALLBACK_INTRO =
  "Отряд стоит у входа в подземелье. Воздух пахнет сыростью и старым камнем, где-то вдалеке капает вода. " +
  "Настрой GROQ_API_KEY в .env, чтобы мастер по-настоящему описывал происходящее — пока это шаблонное начало. Что вы делаете?";

export async function introNarration(state: CampaignState): Promise<string> {
  if (!hasGroqKey) return FALLBACK_INTRO;

  try {
    const text = await chatCompletion([
      { role: "system", content: buildSystemPrompt(state) },
      {
        role: "user",
        content:
          "Начни приключение: опиши, как отряд стоит у входа в подземелье в самом начале пути. " +
          "Задай атмосферу места, опиши, что видят и слышат герои, и дай зацепку для первого действия. 3-6 предложений.",
      },
    ]);
    return text || FALLBACK_INTRO;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return `${FALLBACK_INTRO}\n\n(не удалось получить полноценное вступление от ИИ: ${detail})`;
  }
}

export async function narrate(
  state: CampaignState,
  playerName: string,
  action: string
): Promise<string> {
  if (!hasGroqKey) {
    const line = FALLBACK_LINES[Math.floor(Math.random() * FALLBACK_LINES.length)];
    return `${line}\n\n(${playerName}: ${action})`;
  }

  const history: ChatMessage[] = state.log.slice(-12).map((entry) => ({
    role: entry.from === "master" ? "assistant" : "user",
    content:
      entry.from === "master" ? entry.text : `${entry.author ?? "Игрок"}: ${entry.text}`,
  }));

  try {
    const text = await chatCompletion([
      { role: "system", content: buildSystemPrompt(state) },
      ...history,
      { role: "user", content: `${playerName}: ${action}` },
    ]);

    return text || "Мастер задумывается и молчит — попробуй переформулировать действие.";
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return `Мастер на секунду теряет дар речи — не удалось получить ответ от ИИ (${detail}). Действие записано, продолжайте за столом.\n\n(${playerName}: ${action})`;
  }
}
