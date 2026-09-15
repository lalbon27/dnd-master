// Piper TTS: открытый нейросинтез (MIT), работает на своём сервере — без ключей,
// без квот, без блокировок по стране. github.com/rhasspy/piper
import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const isWin = process.platform === "win32";
const BIN_DIR = path.join(process.cwd(), "bin", "piper");
const VOICE_DIR = path.join(process.cwd(), "bin", "voices");
const VOICE_NAME = process.env.PIPER_VOICE || "ru_RU-denis-medium";

const PIPER_EXE = path.join(BIN_DIR, isWin ? "piper.exe" : "piper");
const MODEL_PATH = path.join(VOICE_DIR, `${VOICE_NAME}.onnx`);

// Чуть медленнее и с лёгкой вариативностью — ближе к неторопливой "сказительной" подаче,
// чем к нейтральному дефолту. Настраивается через .env при желании.
const LENGTH_SCALE = process.env.PIPER_LENGTH_SCALE || "1.15";
const NOISE_SCALE = process.env.PIPER_NOISE_SCALE || "0.6";
const NOISE_W = process.env.PIPER_NOISE_W || "0.8";

export const hasPiper = fs.existsSync(PIPER_EXE) && fs.existsSync(MODEL_PATH);

const shortDirCache = new Map<string, string>();

// На Windows с нелатинским именем пользователя espeak-ng (внутри Piper) не может
// открыть свои файлы данных по полному пути — обходим через короткие 8.3-имена
// (актуально только для локальной разработки; на Linux/Render такой проблемы нет).
// Резолвим короткое имя только для директории (она должна существовать), имя файла
// в наших случаях всегда латиницей (piper.exe, ru_RU-denis-medium.onnx, temp .wav).
function shortenDir(dirPath: string): string {
  const cached = shortDirCache.get(dirPath);
  if (cached) return cached;
  try {
    const out = execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `(New-Object -ComObject Scripting.FileSystemObject).GetFolder('${dirPath.replace(/'/g, "''")}').ShortPath`,
      ],
      { encoding: "utf-8" }
    ).trim();
    const resolved = out || dirPath;
    shortDirCache.set(dirPath, resolved);
    return resolved;
  } catch {
    return dirPath;
  }
}

function toRunnablePath(p: string): string {
  if (!isWin) return p;
  return path.join(shortenDir(path.dirname(p)), path.basename(p));
}

function runPiper(exe: string, args: string[], text: string, timeoutMs = 20000): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("piper: таймаут синтеза"));
    }, timeoutMs);

    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`piper завершился с кодом ${code}: ${stderr.trim()}`));
    });

    child.stdin.write(text, "utf-8");
    child.stdin.end();
  });
}

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  if (!hasPiper) {
    throw new Error("Piper не найден (bin/piper/, bin/voices/) — см. README про озвучку");
  }

  const exe = toRunnablePath(PIPER_EXE);
  const model = toRunnablePath(MODEL_PATH);
  const outFile = path.join(
    os.tmpdir(),
    `piper-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`
  );

  await runPiper(
    exe,
    [
      "--model",
      model,
      "--output_file",
      toRunnablePath(outFile),
      "--length_scale",
      LENGTH_SCALE,
      "--noise_scale",
      NOISE_SCALE,
      "--noise_w",
      NOISE_W,
    ],
    text
  );

  const buffer = fs.readFileSync(outFile);
  fs.rm(outFile, { force: true }, () => {});
  return buffer;
}
