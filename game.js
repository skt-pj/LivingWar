(() => {
  "use strict";

  const EDIT_COLORS = {
    floor: "#d9c9ad",
    floorAlt: "#cfb995",
    grid: "#b7a587",
    wall: "#5e6671",
    wallTop: "#7a8491",
    wallDark: "#3f4650",
    entrance: "#2f6fc4",
    entranceLight: "#9bc1f5",
    stairs: "#d79d2b",
    stairsDark: "#7d5712",
    slime: "#49a85b",
    slimeDark: "#226632",
    goblin: "#b36b32",
    goblinDark: "#653719",
    trap: "#b63a3a",
    trapDark: "#662020",
    white: "#ffffff",
    text: "#1f2937",
  };

  const GB_COLORS = {
    light: "#9BBC0F",
    lightMid: "#8BAC0F",
    darkMid: "#306230",
    dark: "#0F380F",
  };

  const CANVAS_W = 640;
  const CANVAS_H = 512;
  const TILE = 32;
  const COLS = 20;
  const ROWS = 16;
  const SAVE_KEY = "livingwar:dungeon:v2";
  const MAX_ZOOM = 4;

  const MONSTER_DEFS = {
    slime: {
      name: "スライム",
      level: 1,
      drop: "未設定",
      evolution: "未設定",
      logic: "時計回り優先で移動。進めなければ向きを変える。",
    },
    goblin: {
      name: "ゴブリン",
      level: 1,
      drop: "未設定",
      evolution: "未設定",
      logic: "直進優先。壁に当たると右折し、右も塞がれば左折する。",
    },
  };

  const TOOL_INFO = {
    floor: "床\n歩行可能なマスです。",
    wall: "壁\n移動不可。配置済みのモンスター・罠・設備も消去します。",
    erase: "消去\nモンスター・罠・設備を消し、床に戻します。",
    entrance: "入口\n勇者が1Fへ侵入する開始地点です。1Fに1か所だけ置けます。",
    stairs: "次の階段\n次の階へ進む地点です。1Fに1か所だけ置けます。",
    slime: `スライム\nLv ${MONSTER_DEFS.slime.level}\nドロップ: ${MONSTER_DEFS.slime.drop}\n進化条件: ${MONSTER_DEFS.slime.evolution}\n行動: ${MONSTER_DEFS.slime.logic}`,
    goblin: `ゴブリン\nLv ${MONSTER_DEFS.goblin.level}\nドロップ: ${MONSTER_DEFS.goblin.drop}\n進化条件: ${MONSTER_DEFS.goblin.evolution}\n行動: ${MONSTER_DEFS.goblin.logic}`,
    trap: "トゲ罠\n床に設置できます。勇者への効果は勇者側実装時に接続します。",
  };

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const viewport = document.getElementById("canvasViewport");
  ctx.imageSmoothingEnabled = false;

  const startPanel = document.getElementById("startPanel");
  const editorPanel = document.getElementById("editorPanel");
  const heroButton = document.getElementById("heroButton");
  const maouButton = document.getElementById("maouButton");
  const backButton = document.getElementById("backButton");
  const simulateButton = document.getElementById("simulateButton");
  const resetButton = document.getElementById("resetButton");
  const saveButton = document.getElementById("saveButton");
  const loadButton = document.getElementById("loadButton");
  const zoomResetButton = document.getElementById("zoomResetButton");
  const toolInfo = document.getElementById("toolInfo");
  const monsterCount = document.getElementById("monsterCount");
  const trapCount = document.getElementById("trapCount");
  const simState = document.getElementById("simState");
  const screenHelp = document.getElementById("screenHelp");
  const toolButtons = [...document.querySelectorAll(".tool-button")];

  let mode = "start";
  let selectedTool = "floor";
  let simulation = false;
  let lastStepAt = 0;
  let nextMonsterId = 1;
  let suppressClickUntil = 0;

  const view = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  };

  let pinch = null;
  let pan = null;

  const state = {
    tiles: [],
    monsters: [],
    traps: [],
    entrance: null,
    stairs: null,
  };

  function makeInitialDungeon() {
    state.tiles = Array.from({ length: ROWS }, (_, y) =>
      Array.from({ length: COLS }, (_, x) => {
        if (x === 0 || x === COLS - 1 || y === 0 || y === ROWS - 1) return "wall";
        return "floor";
      })
    );
    state.monsters = [];
    state.traps = [];
    state.entrance = { x: 1, y: 1 };
    state.stairs = { x: COLS - 2, y: ROWS - 2 };
    nextMonsterId = 1;
    updateCounts();
  }

  function setMode(next) {
    mode = next;
    if (mode === "start") {
      simulation = false;
      startPanel.classList.remove("hidden");
      editorPanel.classList.add("hidden");
      zoomResetButton.classList.add("hidden");
      resetView();
      screenHelp.textContent = "軍勢を選択してください。";
      drawStartScreen();
    } else {
      startPanel.classList.add("hidden");
      editorPanel.classList.remove("hidden");
      zoomResetButton.classList.remove("hidden");
      resetView();
      screenHelp.textContent = "マスをクリックして編集。2本指のピンチで拡大・縮小できます。";
      updateSimulationButton();
      drawDungeon();
    }
  }

  function setTool(tool) {
    selectedTool = tool;
    toolButtons.forEach((button) => button.classList.toggle("active", button.dataset.tool === tool));
    toolInfo.textContent = TOOL_INFO[tool] || "";
  }

  function updateCounts() {
    monsterCount.textContent = String(state.monsters.length);
    trapCount.textContent = String(state.traps.length);
  }

  function updateSimulationButton() {
    simulateButton.textContent = simulation ? "徘徊テスト停止" : "徘徊テスト開始";
    simState.textContent = simulation ? "GBモード" : "停止";
  }

  function clearCanvas(color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  function drawStartScreen() {
    const gradient = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
    gradient.addColorStop(0, "#dfe8f5");
    gradient.addColorStop(1, "#f4e8dc");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = "#1f2937";
    ctx.textAlign = "center";
    ctx.font = "700 52px system-ui, sans-serif";
    ctx.fillText("LivingWar", CANVAS_W / 2, 190);

    ctx.fillStyle = "#667085";
    ctx.font = "24px system-ui, sans-serif";
    ctx.fillText("勇者軍 vs 魔王軍", CANVAS_W / 2, 242);

    ctx.fillStyle = "#3157d5";
    ctx.font = "700 22px system-ui, sans-serif";
    ctx.fillText("魔王軍プロトタイプ", CANVAS_W / 2, 318);
    ctx.textAlign = "start";
  }

  function drawDungeon() {
    clearCanvas(simulation ? GB_COLORS.light : EDIT_COLORS.floor);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        drawTile(x, y, state.tiles[y][x]);
      }
    }

    if (state.entrance) drawEntrance(state.entrance);
    if (state.stairs) drawStairs(state.stairs);
    state.traps.forEach(drawTrap);
    state.monsters.forEach(drawMonster);
  }

  function drawTile(x, y, type) {
    const px = x * TILE;
    const py = y * TILE;

    if (simulation) {
      if (type === "wall") {
        ctx.fillStyle = GB_COLORS.darkMid;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = GB_COLORS.dark;
        ctx.fillRect(px, py, TILE, 6);
        ctx.fillRect(px, py, 6, TILE);
        ctx.fillStyle = GB_COLORS.lightMid;
        ctx.fillRect(px + 8, py + 10, 16, 6);
        ctx.fillRect(px + 16, py + 20, 16, 6);
      } else {
        ctx.fillStyle = (x + y) % 2 === 0 ? GB_COLORS.light : GB_COLORS.lightMid;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = GB_COLORS.darkMid;
        ctx.fillRect(px + 6, py + 8, 4, 4);
        ctx.fillRect(px + 22, py + 21, 4, 4);
      }
      ctx.strokeStyle = GB_COLORS.darkMid;
    } else {
      if (type === "wall") {
        ctx.fillStyle = EDIT_COLORS.wall;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = EDIT_COLORS.wallTop;
        ctx.fillRect(px + 2, py + 2, TILE - 4, 7);
        ctx.fillStyle = EDIT_COLORS.wallDark;
        ctx.fillRect(px + 2, py + TILE - 6, TILE - 4, 4);
        ctx.fillRect(px + 2, py + 12, 10, 2);
        ctx.fillRect(px + 18, py + 19, 11, 2);
      } else {
        ctx.fillStyle = (x + y) % 2 === 0 ? EDIT_COLORS.floor : EDIT_COLORS.floorAlt;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "rgba(80, 65, 45, .12)";
        ctx.fillRect(px + 6, py + 7, 3, 3);
        ctx.fillRect(px + 22, py + 21, 3, 3);
      }
      ctx.strokeStyle = EDIT_COLORS.grid;
    }

    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
  }

  function drawEntrance(point) {
    const px = point.x * TILE;
    const py = point.y * TILE;
    ctx.fillStyle = simulation ? GB_COLORS.dark : EDIT_COLORS.entrance;
    ctx.fillRect(px + 6, py + 5, 20, 22);
    ctx.fillStyle = simulation ? GB_COLORS.light : EDIT_COLORS.entranceLight;
    ctx.fillRect(px + 10, py + 9, 12, 18);
    ctx.fillStyle = simulation ? GB_COLORS.darkMid : EDIT_COLORS.white;
    ctx.beginPath();
    ctx.moveTo(px + 12, py + 18);
    ctx.lineTo(px + 20, py + 13);
    ctx.lineTo(px + 20, py + 23);
    ctx.closePath();
    ctx.fill();
  }

  function drawStairs(point) {
    const px = point.x * TILE;
    const py = point.y * TILE;
    ctx.fillStyle = simulation ? GB_COLORS.dark : EDIT_COLORS.stairsDark;
    ctx.fillRect(px + 5, py + 7, 22, 20);
    ctx.fillStyle = simulation ? GB_COLORS.lightMid : EDIT_COLORS.stairs;
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(px + 7 + i * 3, py + 22 - i * 4, 18 - i * 3, 3);
    }
  }

  function drawTrap(trap) {
    const px = trap.x * TILE;
    const py = trap.y * TILE;
    ctx.fillStyle = simulation ? GB_COLORS.darkMid : EDIT_COLORS.trapDark;
    ctx.fillRect(px + 5, py + 24, 22, 3);
    ctx.fillStyle = simulation ? GB_COLORS.dark : EDIT_COLORS.trap;
    for (let i = 0; i < 4; i++) {
      const bx = px + 5 + i * 6;
      ctx.beginPath();
      ctx.moveTo(bx, py + 24);
      ctx.lineTo(bx + 3, py + 12);
      ctx.lineTo(bx + 6, py + 24);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawMonster(monster) {
    const px = monster.x * TILE;
    const py = monster.y * TILE;
    if (monster.type === "slime") drawSlime(px, py);
    if (monster.type === "goblin") drawGoblin(px, py);
  }

  function drawSlime(px, py) {
    ctx.fillStyle = simulation ? GB_COLORS.dark : EDIT_COLORS.slimeDark;
    ctx.beginPath();
    ctx.arc(px + 16, py + 18, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(px + 7, py + 17, 18, 9);

    ctx.fillStyle = simulation ? GB_COLORS.darkMid : EDIT_COLORS.slime;
    ctx.beginPath();
    ctx.arc(px + 16, py + 17, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = simulation ? GB_COLORS.light : EDIT_COLORS.white;
    ctx.fillRect(px + 11, py + 15, 4, 4);
    ctx.fillRect(px + 18, py + 15, 4, 4);
  }

  function drawGoblin(px, py) {
    ctx.fillStyle = simulation ? GB_COLORS.dark : EDIT_COLORS.goblinDark;
    ctx.fillRect(px + 8, py + 7, 16, 19);
    ctx.fillRect(px + 4, py + 11, 6, 7);
    ctx.fillRect(px + 22, py + 11, 6, 7);

    ctx.fillStyle = simulation ? GB_COLORS.darkMid : EDIT_COLORS.goblin;
    ctx.fillRect(px + 10, py + 9, 12, 15);

    ctx.fillStyle = simulation ? GB_COLORS.light : EDIT_COLORS.white;
    ctx.fillRect(px + 11, py + 13, 4, 4);
    ctx.fillRect(px + 18, py + 13, 4, 4);
  }

  function canvasToTile(event) {
    const rect = viewport.getBoundingClientRect();
    const localX = (event.clientX - rect.left - view.offsetX) / view.scale;
    const localY = (event.clientY - rect.top - view.offsetY) / view.scale;
    const logicalX = (localX / rect.width) * CANVAS_W;
    const logicalY = (localY / rect.height) * CANVAS_H;
    const tileX = Math.floor(logicalX / TILE);
    const tileY = Math.floor(logicalY / TILE);

    if (tileX < 0 || tileX >= COLS || tileY < 0 || tileY >= ROWS) return null;
    return { x: tileX, y: tileY };
  }

  function samePoint(point, x, y) {
    return point && point.x === x && point.y === y;
  }

  function removeEntitiesAt(x, y) {
    state.monsters = state.monsters.filter((m) => !(m.x === x && m.y === y));
    state.traps = state.traps.filter((t) => !(t.x === x && t.y === y));
    if (samePoint(state.entrance, x, y)) state.entrance = null;
    if (samePoint(state.stairs, x, y)) state.stairs = null;
  }

  function isAnchorAt(x, y) {
    return samePoint(state.entrance, x, y) || samePoint(state.stairs, x, y);
  }

  function placeAt(x, y) {
    if (simulation) return;

    if (selectedTool === "wall") {
      state.tiles[y][x] = "wall";
      removeEntitiesAt(x, y);
    } else if (selectedTool === "floor") {
      state.tiles[y][x] = "floor";
    } else if (selectedTool === "erase") {
      state.tiles[y][x] = "floor";
      removeEntitiesAt(x, y);
    } else if (selectedTool === "entrance") {
      if (state.tiles[y][x] !== "floor") return;
      state.entrance = { x, y };
      if (samePoint(state.stairs, x, y)) state.stairs = null;
      state.monsters = state.monsters.filter((m) => !(m.x === x && m.y === y));
      state.traps = state.traps.filter((t) => !(t.x === x && t.y === y));
    } else if (selectedTool === "stairs") {
      if (state.tiles[y][x] !== "floor") return;
      state.stairs = { x, y };
      if (samePoint(state.entrance, x, y)) state.entrance = null;
      state.monsters = state.monsters.filter((m) => !(m.x === x && m.y === y));
      state.traps = state.traps.filter((t) => !(t.x === x && t.y === y));
    } else if (selectedTool === "trap") {
      if (state.tiles[y][x] !== "floor" || isAnchorAt(x, y)) return;
      state.traps = state.traps.filter((t) => !(t.x === x && t.y === y));
      state.traps.push({ x, y, type: "spike" });
    } else if (selectedTool === "slime" || selectedTool === "goblin") {
      if (state.tiles[y][x] !== "floor" || isAnchorAt(x, y)) return;
      state.monsters = state.monsters.filter((m) => !(m.x === x && m.y === y));
      state.monsters.push({
        id: nextMonsterId++,
        type: selectedTool,
        x,
        y,
        dir: selectedTool === "slime" ? 1 : 2,
        steps: 0,
      });
    }

    updateCounts();
    drawDungeon();
  }

  const DIRS = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  function canMoveTo(monster, x, y, occupied) {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
    if (state.tiles[y][x] !== "floor") return false;
    const key = `${x},${y}`;
    return !occupied.has(key) || (monster.x === x && monster.y === y);
  }

  function moveMonster(monster, occupied) {
    occupied.delete(`${monster.x},${monster.y}`);

    const tryDirs = monster.type === "slime"
      ? [monster.dir, (monster.dir + 1) % 4, (monster.dir + 2) % 4, (monster.dir + 3) % 4]
      : [monster.dir, (monster.dir + 1) % 4, (monster.dir + 3) % 4, (monster.dir + 2) % 4];

    for (const dir of tryDirs) {
      const nx = monster.x + DIRS[dir].x;
      const ny = monster.y + DIRS[dir].y;
      if (!canMoveTo(monster, nx, ny, occupied)) continue;
      monster.x = nx;
      monster.y = ny;
      monster.dir = dir;
      monster.steps += 1;
      break;
    }

    occupied.add(`${monster.x},${monster.y}`);
  }

  function simulateStep() {
    const occupied = new Set(state.monsters.map((m) => `${m.x},${m.y}`));
    [...state.monsters]
      .sort((a, b) => a.id - b.id)
      .forEach((monster) => moveMonster(monster, occupied));
  }

  function loop(now) {
    if (mode === "editor" && simulation && now - lastStepAt >= 420) {
      simulateStep();
      drawDungeon();
      lastStepAt = now;
    }
    requestAnimationFrame(loop);
  }

  function saveDungeon() {
    const data = {
      version: 2,
      cols: COLS,
      rows: ROWS,
      tiles: state.tiles,
      monsters: state.monsters,
      traps: state.traps,
      entrance: state.entrance,
      stairs: state.stairs,
      nextMonsterId,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    screenHelp.textContent = "1Fの設計をブラウザに保存しました。";
  }

  function loadDungeon() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      screenHelp.textContent = "保存データがありません。";
      return;
    }

    try {
      const data = JSON.parse(raw);
      if (
        data.version !== 2 ||
        data.cols !== COLS ||
        data.rows !== ROWS ||
        !Array.isArray(data.tiles) ||
        data.tiles.length !== ROWS
      ) {
        throw new Error("invalid dungeon");
      }

      state.tiles = data.tiles;
      state.monsters = Array.isArray(data.monsters) ? data.monsters : [];
      state.traps = Array.isArray(data.traps) ? data.traps : [];
      state.entrance = data.entrance || null;
      state.stairs = data.stairs || null;
      nextMonsterId = Number.isInteger(data.nextMonsterId) ? data.nextMonsterId : state.monsters.length + 1;

      simulation = false;
      updateSimulationButton();
      updateCounts();
      resetView();
      drawDungeon();
      screenHelp.textContent = "保存した1Fを読み込みました。";
    } catch {
      screenHelp.textContent = "保存データを読み込めませんでした。";
    }
  }

  function applyViewTransform() {
    canvas.style.transform = `translate(${view.offsetX}px, ${view.offsetY}px) scale(${view.scale})`;
  }

  function clampView() {
    const rect = viewport.getBoundingClientRect();
    const minX = rect.width - rect.width * view.scale;
    const minY = rect.height - rect.height * view.scale;
    view.offsetX = Math.min(0, Math.max(minX, view.offsetX));
    view.offsetY = Math.min(0, Math.max(minY, view.offsetY));
  }

  function resetView() {
    view.scale = 1;
    view.offsetX = 0;
    view.offsetY = 0;
    applyViewTransform();
  }

  function touchDistance(touchA, touchB) {
    return Math.hypot(touchB.clientX - touchA.clientX, touchB.clientY - touchA.clientY);
  }

  function touchMidpoint(touchA, touchB, rect) {
    return {
      x: ((touchA.clientX + touchB.clientX) / 2) - rect.left,
      y: ((touchA.clientY + touchB.clientY) / 2) - rect.top,
    };
  }

  viewport.addEventListener("touchstart", (event) => {
    if (mode !== "editor") return;

    if (event.touches.length === 2) {
      event.preventDefault();
      pan = null;

      const rect = viewport.getBoundingClientRect();
      const mid = touchMidpoint(event.touches[0], event.touches[1], rect);
      pinch = {
        startDistance: touchDistance(event.touches[0], event.touches[1]),
        startScale: view.scale,
        worldX: (mid.x - view.offsetX) / view.scale,
        worldY: (mid.y - view.offsetY) / view.scale,
      };
      suppressClickUntil = Date.now() + 350;
      return;
    }

    if (event.touches.length === 1 && view.scale > 1) {
      const touch = event.touches[0];
      pan = {
        startX: touch.clientX,
        startY: touch.clientY,
        startOffsetX: view.offsetX,
        startOffsetY: view.offsetY,
        moved: false,
      };
    }
  }, { passive: false });

  viewport.addEventListener("touchmove", (event) => {
    if (mode !== "editor") return;

    if (event.touches.length === 2 && pinch) {
      event.preventDefault();
      pan = null;

      const rect = viewport.getBoundingClientRect();
      const mid = touchMidpoint(event.touches[0], event.touches[1], rect);
      const distance = touchDistance(event.touches[0], event.touches[1]);
      const nextScale = Math.max(1, Math.min(MAX_ZOOM, pinch.startScale * (distance / pinch.startDistance)));

      view.scale = nextScale;
      view.offsetX = mid.x - pinch.worldX * nextScale;
      view.offsetY = mid.y - pinch.worldY * nextScale;
      clampView();
      applyViewTransform();
      suppressClickUntil = Date.now() + 350;
      return;
    }

    if (event.touches.length === 1 && pan && view.scale > 1) {
      const touch = event.touches[0];
      const dx = touch.clientX - pan.startX;
      const dy = touch.clientY - pan.startY;

      if (!pan.moved && Math.hypot(dx, dy) < 6) return;

      event.preventDefault();
      pan.moved = true;
      view.offsetX = pan.startOffsetX + dx;
      view.offsetY = pan.startOffsetY + dy;
      clampView();
      applyViewTransform();
      suppressClickUntil = Date.now() + 250;
    }
  }, { passive: false });

  viewport.addEventListener("touchend", (event) => {
    const didPan = Boolean(pan && pan.moved);

    if (event.touches.length < 2) pinch = null;
    if (event.touches.length === 0) {
      pan = null;
      if (didPan) suppressClickUntil = Date.now() + 250;
    } else if (event.touches.length === 1 && view.scale > 1 && pinch === null) {
      const touch = event.touches[0];
      pan = {
        startX: touch.clientX,
        startY: touch.clientY,
        startOffsetX: view.offsetX,
        startOffsetY: view.offsetY,
        moved: false,
      };
    }
  }, { passive: true });

  viewport.addEventListener("touchcancel", () => {
    pinch = null;
    pan = null;
    suppressClickUntil = Date.now() + 250;
  }, { passive: true });

  viewport.addEventListener("wheel", (event) => {
    if (mode !== "editor" || !event.ctrlKey) return;

    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const pointX = event.clientX - rect.left;
    const pointY = event.clientY - rect.top;
    const worldX = (pointX - view.offsetX) / view.scale;
    const worldY = (pointY - view.offsetY) / view.scale;
    const factor = Math.exp(-event.deltaY * 0.01);
    const nextScale = Math.max(1, Math.min(MAX_ZOOM, view.scale * factor));

    view.scale = nextScale;
    view.offsetX = pointX - worldX * nextScale;
    view.offsetY = pointY - worldY * nextScale;
    clampView();
    applyViewTransform();
    suppressClickUntil = Date.now() + 120;
  }, { passive: false });

  heroButton.addEventListener("click", () => {
    screenHelp.textContent = "勇者軍は次段階で実装します。";
  });

  maouButton.addEventListener("click", () => {
    setMode("editor");
  });

  backButton.addEventListener("click", () => setMode("start"));

  toolButtons.forEach((button) => {
    button.addEventListener("click", () => setTool(button.dataset.tool));
  });

  canvas.addEventListener("click", (event) => {
    if (mode !== "editor" || Date.now() < suppressClickUntil) return;
    const tile = canvasToTile(event);
    if (tile) placeAt(tile.x, tile.y);
  });

  simulateButton.addEventListener("click", () => {
    simulation = !simulation;
    lastStepAt = performance.now();
    updateSimulationButton();
    screenHelp.textContent = simulation
      ? "モンスターが暫定ロジックで徘徊中。"
      : "徘徊テストを停止しました。";
  });

  resetButton.addEventListener("click", () => {
    simulation = false;
    updateSimulationButton();
    makeInitialDungeon();
    resetView();
    drawDungeon();
    screenHelp.textContent = "1Fを初期状態に戻しました。";
  });

  saveButton.addEventListener("click", saveDungeon);
  loadButton.addEventListener("click", loadDungeon);
  zoomResetButton.addEventListener("click", resetView);

  window.addEventListener("resize", () => {
    clampView();
    applyViewTransform();
  });

  makeInitialDungeon();
  setTool("floor");
  setMode("start");
  requestAnimationFrame(loop);

  window.LivingWarBattleTheme = Object.freeze({
    width: 160,
    height: 144,
    colors: Object.freeze(GB_COLORS),
  });
})();
