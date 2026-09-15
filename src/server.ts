import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
import { buildCharacter, generateCharacter, type Archetype, type Vibe } from "./character.js";
import { generateDungeon } from "./dungeon.js";
import { introNarration, narrate } from "./master.js";
import { transcribeAudio } from "./transcribe.js";
import { generateFacePortrait, hasCloudflare } from "./portrait-ai.js";
import {
  addCharacter,
  appendLog,
  getState,
  removeCharacter,
  resetState,
  setDungeon,
  startGame,
  type LogEntry,
} from "./state.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const certPath = path.join(__dirname, "..", "certs", "cert.pem");
const keyPath = path.join(__dirname, "..", "certs", "key.pem");
const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

// HTTPS нужен, чтобы браузеры на телефонах игроков разрешили доступ к микрофону
// (getUserMedia работает только в "безопасном контексте" — localhost или HTTPS).
const app = Fastify({
  logger: true,
  ...(hasCerts
    ? { https: { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) } }
    : {}),
} as Parameters<typeof Fastify>[0]);

app.register(fastifyStatic, {
  root: path.join(__dirname, "..", "public"),
});

// Селфи игроков хранятся только тут, локально, и никогда никуда не отправляются
// (кроме Cloudflare Workers AI, если настроен, — см. portrait-ai.ts).
const selfiesDir = path.join(__dirname, "..", "data", "selfies");
fs.mkdirSync(selfiesDir, { recursive: true });
app.register(fastifyStatic, {
  root: selfiesDir,
  prefix: "/selfies/",
  decorateReply: false,
});

const portraitsDir = path.join(__dirname, "..", "data", "portraits");
fs.mkdirSync(portraitsDir, { recursive: true });
app.register(fastifyStatic, {
  root: portraitsDir,
  prefix: "/portraits/",
  decorateReply: false,
});

app.register(fastifyMultipart, {
  limits: { fileSize: 15 * 1024 * 1024 },
});

const ARCHETYPES: Archetype[] = ["strength", "cunning", "knowledge", "charisma"];
const VIBES: Vibe[] = ["reliable", "bold", "mysterious", "funny"];

async function handlePlayerAction(
  text: string,
  characterId: string | undefined,
  playerNameFallback: string | undefined
): Promise<LogEntry> {
  const state = getState();
  const character = state.characters.find((c) => c.id === characterId);
  const playerName = character?.name ?? playerNameFallback ?? "Игрок";

  appendLog({ from: "player", author: playerName, text });

  const replyText = await narrate(getState(), playerName, text);
  return appendLog({ from: "master", text: replyText });
}

app.get("/api/state", async () => getState());

app.post("/api/campaign/reset", async () => {
  const state = resetState();
  for (const file of fs.readdirSync(selfiesDir)) {
    fs.rm(path.join(selfiesDir, file), { force: true }, () => {});
  }
  for (const file of fs.readdirSync(portraitsDir)) {
    fs.rm(path.join(portraitsDir, file), { force: true }, () => {});
  }
  return state;
});

app.post("/api/campaign/start", async (req, reply) => {
  const state = getState();
  if (state.characters.length === 0) {
    return reply.code(400).send({ error: "нужен хотя бы один персонаж, чтобы начать игру" });
  }
  if (state.phase === "playing") {
    return state;
  }
  startGame();
  const intro = await introNarration(getState());
  appendLog({ from: "master", text: intro });
  return getState();
});

app.post<{ Body: { name?: string; race?: string; class?: string } }>(
  "/api/characters",
  async (req) => {
    const character = await generateCharacter(req.body ?? {});
    addCharacter(character);
    return character;
  }
);

app.post("/api/characters/personalized", async (req, reply) => {
  const parts = req.parts();
  let selfieBuffer: Buffer | null = null;
  let realName: string | undefined;
  let archetype: string | undefined;
  let vibe: string | undefined;
  let motto: string | undefined;

  for await (const part of parts) {
    if (part.type === "file") {
      selfieBuffer = await part.toBuffer();
    } else if (part.fieldname === "realName") {
      realName = String(part.value);
    } else if (part.fieldname === "archetype") {
      archetype = String(part.value);
    } else if (part.fieldname === "vibe") {
      vibe = String(part.value);
    } else if (part.fieldname === "motto") {
      motto = String(part.value);
    }
  }

  const { character, portraitPrompt } = await buildCharacter({
    realName,
    archetype: ARCHETYPES.includes(archetype as Archetype) ? (archetype as Archetype) : undefined,
    vibe: VIBES.includes(vibe as Vibe) ? (vibe as Vibe) : undefined,
    motto,
  });

  let warning: string | undefined;

  if (selfieBuffer && selfieBuffer.length > 0) {
    const selfieFile = `${character.id}.jpg`;
    fs.writeFileSync(path.join(selfiesDir, selfieFile), selfieBuffer);
    character.selfiePath = `/selfies/${selfieFile}`;

    if (hasCloudflare) {
      try {
        const facePrompt = `${portraitPrompt}, keep the facial features and likeness from the reference photo`;
        const portraitBuffer = await generateFacePortrait(selfieBuffer, facePrompt);
        const portraitFile = `${character.id}.jpg`;
        fs.writeFileSync(path.join(portraitsDir, portraitFile), portraitBuffer);
        character.portraitUrl = `/portraits/${portraitFile}`;
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        warning = `Не удалось сделать портрет по фото (${detail}) — использован обычный сгенерированный портрет.`;
      }
    }
  }

  addCharacter(character);
  return { ...character, warning };
});

app.delete<{ Params: { id: string } }>("/api/characters/:id", async (req) => {
  const existing = getState().characters.find((c) => c.id === req.params.id);
  if (existing?.selfiePath) {
    const file = path.join(selfiesDir, path.basename(existing.selfiePath));
    fs.rm(file, { force: true }, () => {});
  }
  return removeCharacter(req.params.id);
});

app.post("/api/dungeon/generate", async () => {
  const dungeon = generateDungeon();
  setDungeon(dungeon);
  return dungeon;
});

app.post<{ Body: { characterId?: string; playerName?: string; text: string } }>(
  "/api/action",
  async (req, reply) => {
    if (getState().phase !== "playing") {
      return reply.code(409).send({ error: "игра ещё не началась — жди, пока мастер начнёт" });
    }
    const text = req.body?.text?.trim();
    if (!text) return reply.code(400).send({ error: "text is required" });
    return handlePlayerAction(text, req.body.characterId, req.body.playerName);
  }
);

app.post("/api/action-audio", async (req, reply) => {
  if (getState().phase !== "playing") {
    return reply.code(409).send({ error: "игра ещё не началась — жди, пока мастер начнёт" });
  }
  const parts = req.parts();
  let audioBuffer: Buffer | null = null;
  let filename = "action.webm";
  let characterId: string | undefined;
  let playerName: string | undefined;

  for await (const part of parts) {
    if (part.type === "file") {
      audioBuffer = await part.toBuffer();
      filename = part.filename || filename;
    } else if (part.fieldname === "characterId") {
      characterId = String(part.value);
    } else if (part.fieldname === "playerName") {
      playerName = String(part.value);
    }
  }

  if (!audioBuffer || audioBuffer.length === 0) {
    return reply.code(400).send({ error: "audio file is required" });
  }

  let text: string;
  try {
    text = await transcribeAudio(audioBuffer, filename);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return reply.code(502).send({ error: `transcription failed: ${detail}` });
  }

  if (!text) {
    return reply.code(422).send({ error: "не удалось распознать речь, попробуй ещё раз" });
  }

  const result = await handlePlayerAction(text, characterId, playerName);
  return { transcript: text, master: result };
});

const port = Number(process.env.PORT) || 3000;
app
  .listen({ port, host: "0.0.0.0" })
  .then((address) => {
    app.log.info(`DnD master server up: ${address}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
