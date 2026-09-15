const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const WHISPER_MODEL = "whisper-large-v3-turbo";

const apiKey = process.env.GROQ_API_KEY;

export async function transcribeAudio(buffer: Buffer, filename: string): Promise<string> {
  if (!apiKey) {
    throw new Error("GROQ_API_KEY не задан — распознавание речи недоступно");
  }

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)]), filename);
  form.append("model", WHISPER_MODEL);
  form.append("language", "ru");
  form.append("response_format", "json");

  const res = await fetch(GROQ_TRANSCRIBE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${res.status} ${errText}`);
  }

  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}
