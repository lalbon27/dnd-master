const splashWrapEl = document.getElementById("splash-wrap");
const splashImgEl = document.getElementById("splash-img");
const dungeonLegendEl = document.getElementById("dungeon-legend");
const dungeonBannerEl = document.getElementById("dungeon-banner");
const dungeonMapWrapEl = document.getElementById("dungeon-map-wrap");
const dungeonCanvasEl = document.getElementById("dungeon-canvas");
const charactersEl = document.getElementById("characters");
const logEl = document.getElementById("log");
const voiceToggle = document.getElementById("voice-toggle");
const phaseSetupEl = document.getElementById("phase-setup");
const phasePlayingEl = document.getElementById("phase-playing");
const phaseStatusTextEl = document.getElementById("phase-status-text");
const startGameBtn = document.getElementById("start-game-btn");

voiceToggle.checked = localStorage.getItem("dnd-voice") === "1";
voiceToggle.addEventListener("change", () => {
  localStorage.setItem("dnd-voice", voiceToggle.checked ? "1" : "0");
});

function pickRussianVoice() {
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("ru")) || null;
}

function speakBrowser(text) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickRussianVoice();
    if (voice) utter.voice = voice;
    utter.lang = "ru-RU";
    utter.onend = resolve;
    utter.onerror = resolve;
    speechSynthesis.speak(utter);
  });
}

// Сначала пробуем серверный голос (Piper TTS) — заметно естественнее браузерного
// SAPI-голоса. При любой ошибке (бинарник не установлен, сбой) тихо откатываемся
// на встроенный голос браузера.
async function speakOne(text) {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error("tts unavailable");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    await new Promise((resolve) => {
      const audio = new Audio(url);
      audio.onended = resolve;
      audio.onerror = resolve;
      audio.play().catch(resolve);
    });
    URL.revokeObjectURL(url);
  } catch {
    await speakBrowser(text);
  }
}

let speechQueue = [];
let isSpeaking = false;

async function processSpeechQueue() {
  if (isSpeaking || speechQueue.length === 0) return;
  isSpeaking = true;
  const text = speechQueue.shift();
  await speakOne(text);
  isSpeaking = false;
  processSpeechQueue();
}

function enqueueSpeech(text) {
  if (!voiceToggle.checked) return;
  speechQueue.push(text);
  processSpeechQueue();
}

let lastSpokenId = null;
let voiceInitialized = false;

function speakNewMasterLines(log) {
  const masterEntries = log.filter((e) => e.from === "master");
  if (!voiceInitialized) {
    lastSpokenId = masterEntries.length ? masterEntries[masterEntries.length - 1].id : null;
    voiceInitialized = true;
    return;
  }
  const lastIndex = masterEntries.findIndex((e) => e.id === lastSpokenId);
  const newEntries = lastIndex === -1 ? masterEntries : masterEntries.slice(lastIndex + 1);
  newEntries.forEach((e) => enqueueSpeech(e.text));
  if (masterEntries.length) lastSpokenId = masterEntries[masterEntries.length - 1].id;
}

async function refresh() {
  const res = await fetch("/api/state");
  const state = await res.json();
  renderSplash(splashWrapEl, splashImgEl, state.dungeon);
  renderDungeonBanner(dungeonBannerEl, state.dungeon);
  renderDungeonCanvas(dungeonMapWrapEl, dungeonCanvasEl, state.dungeon);
  dungeonLegendEl.innerHTML = dungeonLegend(state.dungeon);
  charactersEl.innerHTML = state.characters
    .map((c) => renderCharCard(c, { deletable: true }))
    .join("") || '<p class="muted">Персонажей пока нет.</p>';
  renderLog(logEl, state.log);
  speakNewMasterLines(state.log);

  const isPlaying = state.phase === "playing";
  phaseSetupEl.hidden = isPlaying;
  phasePlayingEl.hidden = !isPlaying;
  if (!isPlaying) {
    const count = state.characters.length;
    phaseStatusTextEl.textContent =
      count === 0
        ? "Персонажей ещё нет — пусть игроки создадут героев на /player.html."
        : `Персонажей создано: ${count}. Когда все готовы — начинай.`;
    startGameBtn.disabled = count === 0;
  }
}

document.getElementById("reset-btn").addEventListener("click", async () => {
  if (!confirm("Точно сбросить кампанию? Персонажи, карта и хроника будут удалены.")) return;
  await fetch("/api/campaign/reset", { method: "POST" });
  refresh();
});

startGameBtn.addEventListener("click", async () => {
  startGameBtn.disabled = true;
  startGameBtn.textContent = "Мастер собирается с мыслями...";
  try {
    const res = await fetch("/api/campaign/start", { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Не удалось начать игру");
    }
  } finally {
    startGameBtn.textContent = "▶ Начать игру";
    await refresh();
  }
});

document.getElementById("splash-retry").addEventListener("click", () => {
  const url = splashImgEl.dataset.src;
  if (url) loadSplashImage(splashWrapEl, splashImgEl, url);
});

document.getElementById("dungeon-btn").addEventListener("click", async () => {
  await fetch("/api/dungeon/generate", { method: "POST" });
  refresh();
});

document.getElementById("char-btn").addEventListener("click", async () => {
  const name = document.getElementById("char-name").value.trim();
  await fetch("/api/characters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  document.getElementById("char-name").value = "";
  refresh();
});

charactersEl.addEventListener("click", async (e) => {
  const id = e.target.getAttribute("data-del");
  if (!id) return;
  await fetch(`/api/characters/${id}`, { method: "DELETE" });
  refresh();
});

refresh();
setInterval(refresh, 2500);
