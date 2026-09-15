const charSelect = document.getElementById("char-select");
const charSheet = document.getElementById("char-sheet");
const logEl = document.getElementById("log");
const splashWrapEl = document.getElementById("splash-wrap");
const splashImgEl = document.getElementById("splash-img");
const waitingPanelEl = document.getElementById("waiting-panel");
const playingPanelsEl = document.getElementById("playing-panels");

document.getElementById("splash-retry").addEventListener("click", () => {
  const url = splashImgEl.dataset.src;
  if (url) loadSplashImage(splashWrapEl, splashImgEl, url);
});

let currentState = null;

function selectedCharacterId() {
  return charSelect.value;
}

function renderCharSelect(state) {
  const prev = charSelect.value;
  charSelect.innerHTML =
    '<option value="">— выбери персонажа —</option>' +
    state.characters
      .map((c) => `<option value="${c.id}">${c.name} (${c.race} ${c.class})</option>`)
      .join("");
  if (pendingSelectId && state.characters.some((c) => c.id === pendingSelectId)) {
    charSelect.value = pendingSelectId;
    pendingSelectId = null;
  } else if (state.characters.some((c) => c.id === prev)) {
    charSelect.value = prev;
  }
}

function renderSheet(state) {
  const c = state.characters.find((c) => c.id === selectedCharacterId());
  charSheet.innerHTML = c ? renderCharCard(c) : "Персонаж не выбран.";
}

async function refresh() {
  const res = await fetch("/api/state");
  currentState = await res.json();
  renderSplash(splashWrapEl, splashImgEl, currentState.dungeon);
  renderCharSelect(currentState);
  renderSheet(currentState);

  const isPlaying = currentState.phase === "playing";
  waitingPanelEl.hidden = isPlaying;
  playingPanelsEl.hidden = !isPlaying;
  if (isPlaying) renderLog(logEl, currentState.log);
}

charSelect.addEventListener("change", () => renderSheet(currentState));

document.getElementById("action-btn").addEventListener("click", async () => {
  const el = document.getElementById("action-text");
  const text = el.value.trim();
  if (!text) return;
  const characterId = selectedCharacterId();
  el.value = "";
  el.disabled = true;
  try {
    await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId, text }),
    });
  } finally {
    el.disabled = false;
    refresh();
  }
});

const recordBtn = document.getElementById("record-btn");
const recordStatus = document.getElementById("record-status");

let mediaRecorder = null;
let chunks = [];
let isRecording = false;

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) {
    recordStatus.textContent =
      "Микрофон недоступен в этом браузере (нужен HTTPS-адрес — проверь, что ссылка начинается с https://).";
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      uploadRecording(new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" }));
    };
    mediaRecorder.start();
    isRecording = true;
    recordBtn.textContent = "⏹ Стоп";
    recordStatus.textContent = "Идёт запись...";
  } catch (err) {
    recordStatus.textContent = `Не удалось включить микрофон: ${err.message}`;
  }
}

function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    recordBtn.textContent = "🎤 Записать голосом";
  }
}

async function uploadRecording(blob) {
  recordStatus.textContent = "Распознаю речь...";
  recordBtn.disabled = true;
  const form = new FormData();
  form.append("file", blob, "action.webm");
  form.append("characterId", selectedCharacterId());
  try {
    const res = await fetch("/api/action-audio", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "ошибка сервера");
    recordStatus.textContent = `Распознано: «${data.transcript}»`;
  } catch (err) {
    recordStatus.textContent = `Ошибка: ${err.message}`;
  } finally {
    recordBtn.disabled = false;
    refresh();
  }
}

recordBtn.addEventListener("click", () => {
  if (isRecording) stopRecording();
  else startRecording();
});

// --- Мастер создания персонажа ---
const wizard = document.getElementById("wizard");
const wizardStatus = document.getElementById("wizard-status");
const steps = [0, 1, 2, 3, 4].map((n) => document.getElementById(`wizard-step-${n}`));

const wizardData = { realName: "", archetype: null, vibe: null, motto: "", selfieBlob: null };
let selfieStream = null;
let pendingSelectId = null;

function showStep(n) {
  steps.forEach((el, i) => (el.hidden = i !== n));
}

document.getElementById("new-char-toggle").addEventListener("click", () => {
  wizard.hidden = !wizard.hidden;
  if (!wizard.hidden) {
    wizardData.realName = "";
    wizardData.archetype = null;
    wizardData.vibe = null;
    wizardData.motto = "";
    wizardData.selfieBlob = null;
    document.getElementById("wizard-realname").value = "";
    document.getElementById("wizard-motto").value = "";
    wizardStatus.textContent = "";
    showStep(0);
  } else {
    stopSelfieCamera();
  }
});

document.getElementById("wizard-to-archetype").addEventListener("click", () => {
  wizardData.realName = document.getElementById("wizard-realname").value.trim();
  if (!wizardData.realName) {
    wizardStatus.textContent = "Напиши своё настоящее имя — от него мастер оттолкнётся.";
    return;
  }
  wizardStatus.textContent = "";
  showStep(1);
});

document.querySelectorAll("[data-archetype]").forEach((btn) => {
  btn.addEventListener("click", () => {
    wizardData.archetype = btn.getAttribute("data-archetype");
    showStep(2);
  });
});

document.querySelectorAll("[data-vibe]").forEach((btn) => {
  btn.addEventListener("click", () => {
    wizardData.vibe = btn.getAttribute("data-vibe");
    showStep(3);
  });
});

document.getElementById("wizard-to-selfie").addEventListener("click", () => {
  wizardData.motto = document.getElementById("wizard-motto").value.trim();
  showStep(4);
  startSelfieCamera();
});

const selfieVideo = document.getElementById("selfie-video");
const selfieCanvas = document.getElementById("selfie-canvas");
const selfiePreview = document.getElementById("selfie-preview");
const selfieShoot = document.getElementById("selfie-shoot");
const selfieRetake = document.getElementById("selfie-retake");

async function startSelfieCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    wizardStatus.textContent = "Камера недоступна в этом браузере (нужен https-адрес).";
    return;
  }
  try {
    selfieStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    selfieVideo.srcObject = selfieStream;
    selfieVideo.hidden = false;
    selfiePreview.hidden = true;
    selfieShoot.hidden = false;
    selfieRetake.hidden = true;
  } catch (err) {
    wizardStatus.textContent = `Не удалось включить камеру: ${err.message}. Можно пропустить этот шаг.`;
  }
}

function stopSelfieCamera() {
  if (selfieStream) {
    selfieStream.getTracks().forEach((t) => t.stop());
    selfieStream = null;
  }
}

selfieShoot.addEventListener("click", () => {
  const cropSize = Math.min(selfieVideo.videoWidth, selfieVideo.videoHeight) || 320;
  const outputSize = Math.min(cropSize, 512); // модель для портрета по фото принимает картинки не крупнее 512x512
  selfieCanvas.width = outputSize;
  selfieCanvas.height = outputSize;
  const ctx = selfieCanvas.getContext("2d");
  const sx = (selfieVideo.videoWidth - cropSize) / 2;
  const sy = (selfieVideo.videoHeight - cropSize) / 2;
  ctx.drawImage(selfieVideo, sx, sy, cropSize, cropSize, 0, 0, outputSize, outputSize);
  selfieCanvas.toBlob((blob) => {
    wizardData.selfieBlob = blob;
    selfiePreview.src = URL.createObjectURL(blob);
    selfiePreview.hidden = false;
    selfieVideo.hidden = true;
    selfieShoot.hidden = true;
    selfieRetake.hidden = false;
    stopSelfieCamera();
  }, "image/jpeg", 0.9);
});

selfieRetake.addEventListener("click", () => {
  wizardData.selfieBlob = null;
  startSelfieCamera();
});

document.getElementById("selfie-skip").addEventListener("click", () => {
  wizardData.selfieBlob = null;
  stopSelfieCamera();
  submitWizard();
});

document.getElementById("wizard-submit").addEventListener("click", () => submitWizard());

async function submitWizard() {
  wizardStatus.textContent = "Создаю героя...";
  const form = new FormData();
  form.append("realName", wizardData.realName);
  if (wizardData.archetype) form.append("archetype", wizardData.archetype);
  if (wizardData.vibe) form.append("vibe", wizardData.vibe);
  if (wizardData.motto) form.append("motto", wizardData.motto);
  if (wizardData.selfieBlob) form.append("file", wizardData.selfieBlob, "selfie.jpg");

  try {
    const res = await fetch("/api/characters/personalized", { method: "POST", body: form });
    if (!res.ok) throw new Error((await res.json()).error || "ошибка сервера");
    const character = await res.json();
    pendingSelectId = character.id;
    const warningText = character.warning ? ` ${character.warning}` : "";
    wizardStatus.textContent = `Готово! ${wizardData.realName}, в этом мире тебя зовут ${character.name}.${warningText}`;
    wizard.hidden = true;
    await refresh();
  } catch (err) {
    wizardStatus.textContent = `Ошибка: ${err.message}`;
  }
}

refresh();
setInterval(refresh, 2500);
