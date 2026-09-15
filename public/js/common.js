function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function renderLog(el, log) {
  el.innerHTML = log
    .map((entry) => {
      const who = entry.from === "master" ? "Мастер" : entry.author || "Игрок";
      return `<div class="log-entry ${entry.from}">
        <div class="who">${who} · ${fmtTime(entry.ts)}</div>
        <div>${escapeHtml(entry.text).replace(/\n/g, "<br/>")}</div>
      </div>`;
    })
    .join("");
  el.scrollTop = el.scrollHeight;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const TAG_ICON = {
  start: "🏁",
  boss: "💀",
  monster: "⚔️",
  trap: "🪤",
  treasure: "💰",
  empty: "·",
};

const TAG_LABEL_RU = {
  start: "старт",
  boss: "босс",
  monster: "враги",
  trap: "ловушка",
  treasure: "сокровище",
  empty: "пусто",
};

function renderDungeonBanner(el, dungeon) {
  if (!dungeon) {
    el.innerHTML = "";
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.innerHTML = `
    <span class="dungeon-banner-icon">🗺️</span>
    <span class="dungeon-banner-title">${escapeHtml(dungeon.theme)}</span>
    <span class="dungeon-banner-count">Комнат: ${dungeon.rooms.length}</span>
  `;
}

function loadSplashImage(wrap, img, url) {
  wrap.classList.remove("error");
  wrap.classList.add("loading");
  img.onload = () => wrap.classList.remove("loading");
  img.onerror = () => {
    wrap.classList.remove("loading");
    wrap.classList.add("error");
  };
  // "_r=" сбивает кеш браузера на повторной попытке для того же URL
  img.src = url + (url.includes("?") ? "&" : "?") + "_r=" + Date.now();
}

function renderSplash(wrap, img, dungeon) {
  if (!dungeon || !dungeon.splashImageUrl) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  if (img.dataset.src === dungeon.splashImageUrl) return;
  img.dataset.src = dungeon.splashImageUrl;
  loadSplashImage(wrap, img, dungeon.splashImageUrl);
}

// Тайлы: CC0 (public domain) "Top Down Dungeon Pack" от Screaming Brain Studios, opengameart.org.
const TILE_PX = 32;
const TILE_SRC = 64;

// hue-rotate() тут почти не работает — камень слишком малонасыщенный, поворот
// оттенка на серо-бежевом даёт незаметную разницу. Вместо этого накладываем
// цвет через composite-режим "overlay": тон виден чётко, текстура не теряется.
const THEME_TINT = {
  ice: "79, 179, 232",
  volcano: "224, 89, 42",
  swamp: "90, 143, 76",
  crypt: "122, 122, 138",
  coral: "47, 182, 160",
  mushroom: "138, 79, 214",
};

const floorTileImg = new Image();
floorTileImg.src = "/assets/tiles/floor-stone.png";
const wallTileImg = new Image();
wallTileImg.src = "/assets/tiles/wall-stone.png";

function drawDungeonTiles(canvas, dungeon) {
  canvas.width = dungeon.width * TILE_PX;
  canvas.height = dungeon.height * TILE_PX;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      const img = dungeon.grid[y][x] === 1 ? floorTileImg : wallTileImg;
      ctx.drawImage(img, 0, 0, TILE_SRC, TILE_SRC, x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
    }
  }

  const tint = THEME_TINT[dungeon.themeKey];
  if (tint) {
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = `rgba(${tint}, 0.4)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  dungeon.rooms.forEach((room) => {
    const cx = (room.x + room.w / 2) * TILE_PX;
    const cy = (room.y + room.h / 2) * TILE_PX;
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(13, 11, 9, 0.72)";
    ctx.fill();
    ctx.strokeStyle = "#b8862f";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = "13px sans-serif";
    ctx.fillText(TAG_ICON[room.tag] || String(room.id), cx, cy + 1);
  });
}

function renderDungeonCanvas(wrap, canvas, dungeon) {
  if (!dungeon) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  const draw = () => drawDungeonTiles(canvas, dungeon);
  if (floorTileImg.complete && wallTileImg.complete) {
    draw();
  } else {
    let pending = 2;
    const onReady = () => {
      pending -= 1;
      if (pending <= 0) draw();
    };
    floorTileImg.addEventListener("load", onReady, { once: true });
    wallTileImg.addEventListener("load", onReady, { once: true });
  }
}

function dungeonLegend(dungeon) {
  if (!dungeon) return "Карта не сгенерирована.";
  return dungeon.rooms
    .map(
      (r) =>
        `<div><span class="legend-icon">${TAG_ICON[r.tag] || "·"}</span> <b>#${r.id}</b> <span class="muted">[${TAG_LABEL_RU[r.tag] || r.tag}]</span> — ${escapeHtml(r.note)}</div>`
    )
    .join("");
}

function renderCharCard(c, opts) {
  opts = opts || {};
  const del = opts.deletable
    ? `<button data-del="${c.id}" style="float:right">Удалить</button>`
    : "";
  const portrait = c.portraitUrl
    ? `<img src="${c.portraitUrl}" alt="${escapeHtml(c.name)}" class="portrait" loading="lazy" onerror="this.style.display='none'" />`
    : "";
  const selfie = c.selfiePath
    ? `<img src="${c.selfiePath}" alt="селфи ${escapeHtml(c.name)}" class="selfie-badge" loading="lazy" onerror="this.style.display='none'" />`
    : "";
  return `<div class="char-card">
    ${del}
    <div class="char-card-body">
      <div class="portrait-wrap">
        ${portrait}
        ${selfie}
      </div>
      <div class="char-card-info">
        <b>${escapeHtml(c.name)}</b> — ${c.race} ${c.class}
        <div class="stats">
          <span>СИЛ ${c.stats.str}</span>
          <span>ЛОВ ${c.stats.dex}</span>
          <span>ТЕЛ ${c.stats.con}</span>
          <span>ИНТ ${c.stats.int}</span>
          <span>МДР ${c.stats.wis}</span>
          <span>ХАР ${c.stats.cha}</span>
        </div>
        <div class="muted">HP ${c.hp} · AC ${c.ac} · ${escapeHtml(c.background)}</div>
        <div class="muted">${escapeHtml(c.appearance)}</div>
        ${c.motto ? `<div class="muted">Девиз: «${escapeHtml(c.motto)}»</div>` : ""}
        ${c.realName ? `<div class="muted">В миру: ${escapeHtml(c.realName)}</div>` : ""}
        <div class="muted">Снаряжение: ${c.inventory.map(escapeHtml).join(", ")}</div>
      </div>
    </div>
  </div>`;
}
