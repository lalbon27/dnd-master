import fs from "node:fs";
import path from "node:path";
import type { Character } from "./character.js";
import type { Dungeon } from "./dungeon.js";

export type LogEntry = {
  id: string;
  ts: number;
  from: "master" | "player";
  author?: string;
  text: string;
};

export type CampaignPhase = "setup" | "playing";

export type CampaignState = {
  phase: CampaignPhase;
  characters: Character[];
  dungeon: Dungeon | null;
  log: LogEntry[];
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const STATE_FILE = path.join(DATA_DIR, "session.json");

function emptyState(): CampaignState {
  return { phase: "setup", characters: [], dungeon: null, log: [] };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

let state: CampaignState = loadState();

function loadState(): CampaignState {
  ensureDataDir();
  if (!fs.existsSync(STATE_FILE)) return emptyState();
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    const loaded = JSON.parse(raw) as CampaignState;
    return { ...emptyState(), ...loaded };
  } catch {
    return emptyState();
  }
}

function persist() {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

export function getState(): CampaignState {
  return state;
}

export function resetState(): CampaignState {
  state = emptyState();
  persist();
  return state;
}

export function startGame(): CampaignState {
  state.phase = "playing";
  persist();
  return state;
}

export function addCharacter(character: Character): CampaignState {
  state.characters.push(character);
  persist();
  return state;
}

export function removeCharacter(id: string): CampaignState {
  state.characters = state.characters.filter((c) => c.id !== id);
  persist();
  return state;
}

export function setDungeon(dungeon: Dungeon): CampaignState {
  state.dungeon = dungeon;
  persist();
  return state;
}

let logCounter = 0;
export function appendLog(entry: Omit<LogEntry, "id" | "ts">): LogEntry {
  logCounter += 1;
  const full: LogEntry = { ...entry, id: `log_${Date.now()}_${logCounter}`, ts: Date.now() };
  state.log.push(full);
  if (state.log.length > 300) state.log = state.log.slice(-300);
  persist();
  return full;
}
