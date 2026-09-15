// Groq: бесплатный уровень, регистрация без карты. https://console.groq.com/keys
const GROQ_MODEL = "openai/gpt-oss-120b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export const hasGroqKey = Boolean(process.env.GROQ_API_KEY);

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chatCompletion(messages: ChatMessage[], maxTokens = 500): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY не задан");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: GROQ_MODEL, max_tokens: maxTokens, messages }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${res.status} ${errText}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
