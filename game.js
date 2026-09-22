(() => {
  "use strict";

  const COLORS = {
    light: "#9BBC0F",
    lightMid: "#8BAC0F",
    darkMid: "#306230",
    dark: "#0F380F",
  };

  const CANVAS_W = 160;
  const CANVAS_H = 144;
  const HUD_H = 16;
  const TILE = 16;
  const COLS = 10;
  const ROWS = 8;
  const SAVE_KEY = "livingwar:dungeon:v1";

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
    wall: "壁\n移動不可。配置済みのモンスターと罠も消去します。",
    erase: "消去\nモンスター・罠を消します。地形は床になります。",
    slime: `スライム\nLv ${MONSTER_DEFS.slime.level}\nドロップ: ${MONSTER_DEFS.slime.drop}\n進化条件: ${MONSTER_DEFS.slime.evolution}\n行動: ${MONSTER_DEFS.slime.logic}`,
    goblin: `ゴブリン\nLv ${MONSTER_DEFS.goblin.level}\nドロップ: ${MONSTER_DEFS.goblin.drop}\n進化条件: ${MONSTER_DEFS.goblin.evolution}\n行動: ${MONSTER_DEFS.goblin.logic}`,
    trap: "トゲ罠\n床に設置できます。勇者への効果は勇者側実装時に接続します。",
  };

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
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

  const state = {
    tiles: [],
    monsters: [],
    traps: [],
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
    nextMonsterId = 1;
    updateCounts();
  }

  function setMode(next) {
    mode = next;
    if (mode === "start") {
      simulation = false;
      startPanel.classList.remove("hidden");
      editorPanel.classList.add("hidden");
      screenHelp.textContent = "軍勢を選択してください。";
      drawStartScreen();
    } else {
      startPanel.classList.add("hidden");
      editorPanel.classList.remove("hidden");
      screenHelp.textContent = "マスをクリックしてダンジョンを編集。";
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
    simState.textContent = simulation ? "稼働" : "停止";
  }

  function clearCanvas(color = COLORS.light) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  function drawStartScreen() {
    clearCanvas(COLORS.light);
    pixelText("YUUSHA", 80, 26, 2, COLORS.dark, "center");
    pixelText("VS", 80, 48, 2, COLORS.darkMid, "center");
    pixelText("MAOU", 80, 70, 2, COLORS.dark, "center");
    drawTinyCrown(72, 84);
    pixelText("SELECT ARMY", 80, 116, 1, COLORS.dark, "center");
    pixelText("MAOU READY", 80, 130, 1, COLORS.darkMid, "center");
  }

  function drawDungeon() {
    clearCanvas(COLORS.lightMid);
    drawHud();

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        drawTile(x, y, state.tiles[y][x]);
      }
    }

    state.traps.forEach(drawTrap);
    state.monsters.forEach(drawMonster);
  }

  function drawHud() {
    ctx.fillStyle = COLORS.dark;
    ctx.fillRect(0, 0, CANVAS_W, HUD_H);
    pixelText("MAOU 1F", 4, 4, 1, COLORS.light, "left");
    pixelText(simulation ? "RUN" : "EDIT", 156, 4, 1, COLORS.light, "right");
  }

  function drawTile(x, y, type) {
    const px = x * TILE;
    const py = HUD_H + y * TILE;

    if (type === "wall") {
      ctx.fillStyle = COLORS.darkMid;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = COLORS.dark;
      ctx.fillRect(px, py, TILE, 3);
      ctx.fillRect(px, py, 3, TILE);
      ctx.fillStyle = COLORS.lightMid;
      ctx.fillRect(px + 4, py + 5, 8, 3);
      ctx.fillRect(px + 8, py + 10, 8, 3);
    } else {
      ctx.fillStyle = COLORS.light;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = COLORS.lightMid;
      ctx.fillRect(px + 2, py + 3, 2, 2);
      ctx.fillRect(px + 11, py + 10, 2, 2);
    }

    ctx.strokeStyle = COLORS.darkMid;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
  }

  function drawTrap(trap) {
    const px = trap.x * TILE;
    const py = HUD_H + trap.y * TILE;
    ctx.fillStyle = COLORS.darkMid;
    ctx.fillRect(px + 3, py + 11, 10, 2);
    ctx.fillStyle = COLORS.dark;
    for (let i = 0; i < 3; i++) {
      const bx = px + 3 + i * 4;
      ctx.beginPath();
      ctx.moveTo(bx, py + 11);
      ctx.lineTo(bx + 2, py + 5);
      ctx.lineTo(bx + 4, py + 11);
      ctx.fill();
    }
  }

  function drawMonster(monster) {
    const px = monster.x * TILE;
    const py = HUD_H + monster.y * TILE;
    if (monster.type === "slime") drawSlime(px, py);
    if (monster.type === "goblin") drawGoblin(px, py);
  }

  function drawSlime(px, py) {
    ctx.fillStyle = COLORS.dark;
    ctx.fillRect(px + 5, py + 5, 6, 2);
    ctx.fillRect(px + 3, py + 7, 10, 5);
    ctx.fillRect(px + 5, py + 12, 2, 2);
    ctx.fillRect(px + 9, py + 12, 2, 2);
    ctx.fillStyle = COLORS.light;
    ctx.fillRect(px + 5, py + 8, 2, 2);
    ctx.fillRect(px + 9, py + 8, 2, 2);
  }

  function drawGoblin(px, py) {
    ctx.fillStyle = COLORS.dark;
    ctx.fillRect(px + 5, py + 3, 6, 2);
    ctx.fillRect(px + 3, py + 5, 10, 7);
    ctx.fillRect(px + 4, py + 12, 3, 2);
    ctx.fillRect(px + 9, py + 12, 3, 2);
    ctx.fillRect(px + 2, py + 6, 2, 3);
    ctx.fillRect(px + 12, py + 6, 2, 3);
    ctx.fillStyle = COLORS.light;
    ctx.fillRect(px + 5, py + 7, 2, 2);
    ctx.fillRect(px + 9, py + 7, 2, 2);
    ctx.fillStyle = COLORS.lightMid;
    ctx.fillRect(px + 7, py + 10, 2, 2);
  }

  function drawTinyCrown(x, y) {
    ctx.fillStyle = COLORS.dark;
    ctx.fillRect(x, y + 8, 16, 5);
    ctx.fillRect(x + 1, y + 4, 3, 5);
    ctx.fillRect(x + 6, y + 1, 4, 8);
    ctx.fillRect(x + 12, y + 4, 3, 5);
  }

  const FONT = {
    A:["01110","10001","10001","11111","10001","10001","10001"],
    C:["01111","10000","10000","10000","10000","10000","01111"],
    D:["11110","10001","10001","10001","10001","10001","11110"],
    E:["11111","10000","10000","11110","10000","10000","11111"],
    F:["11111","10000","10000","11110","10000","10000","10000"],
    H:["10001","10001","10001","11111","10001","10001","10001"],
    I:["11111","00100","00100","00100","00100","00100","11111"],
    L:["10000","10000","10000","10000","10000","10000","11111"],
    M:["10001","11011","10101","10101","10001","10001","10001"],
    N:["10001","11001","11001","10101","10011","10011","10001"],
    O:["01110","10001","10001","10001","10001","10001","01110"],
    R:["11110","10001","10001","11110","10100","10010","10001"],
    S:["01111","10000","10000","01110","00001","00001","11110"],
    T:["11111","00100","00100","00100","00100","00100","00100"],
    U:["10001","10001","10001","10001","10001","10001","01110"],
    V:["10001","10001","10001","10001","01010","01010","00100"],
    Y:["10001","10001","01010","00100","00100","00100","00100"],
    "1":["00100","01100","00100","00100","00100","00100","01110"],
    " ":["00000","00000","00000","00000","00000","00000","00000"],
  };

  function pixelText(text, x, y, scale, color, align = "left") {
    const chars = [...text.toUpperCase()];
    const glyphW = 5 * scale;
    const gap = scale;
    const width = chars.length * (glyphW + gap) - gap;
    let cursor = x;
    if (align === "center") cursor -= Math.floor(width / 2);
    if (align === "right") cursor -= width;
    ctx.fillStyle = color;

    for (const ch of chars) {
      const glyph = FONT[ch] || FONT[" "];
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row][col] === "1") {
            ctx.fillRect(cursor + col * scale, y + row * scale, scale, scale);
          }
        }
      }
      cursor += glyphW + gap;
    }
  }

  function canvasToTile(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((event.clientY - rect.top) / rect.height) * CANVAS_H;
    if (y < HUD_H) return null;
    const tileX = Math.floor(x / TILE);
    const tileY = Math.floor((y - HUD_H) / TILE);
    if (tileX < 0 || tileX >= COLS || tileY < 0 || tileY >= ROWS) return null;
    return { x: tileX, y: tileY };
  }

  function removeEntitiesAt(x, y) {
    state.monsters = state.monsters.filter((m) => !(m.x === x && m.y === y));
    state.traps = state.traps.filter((t) => !(t.x === x && t.y === y));
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
    } else if (selectedTool === "trap") {
      if (state.tiles[y][x] !== "floor") return;
      state.traps = state.traps.filter((t) => !(t.x === x && t.y === y));
      state.traps.push({ x, y, type: "spike" });
    } else if (selectedTool === "slime" || selectedTool === "goblin") {
      if (state.tiles[y][x] !== "floor") return;
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
      version: 1,
      tiles: state.tiles,
      monsters: state.monsters,
      traps: state.traps,
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
      if (!Array.isArray(data.tiles) || data.tiles.length !== ROWS) throw new Error("invalid tiles");
      state.tiles = data.tiles;
      state.monsters = Array.isArray(data.monsters) ? data.monsters : [];
      state.traps = Array.isArray(data.traps) ? data.traps : [];
      nextMonsterId = Number.isInteger(data.nextMonsterId) ? data.nextMonsterId : state.monsters.length + 1;
      simulation = false;
      updateSimulationButton();
      updateCounts();
      drawDungeon();
      screenHelp.textContent = "保存した1Fを読み込みました。";
    } catch {
      screenHelp.textContent = "保存データを読み込めませんでした。";
    }
  }

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
    if (mode !== "editor") return;
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
    drawDungeon();
    screenHelp.textContent = "1Fを初期状態に戻しました。";
  });

  saveButton.addEventListener("click", saveDungeon);
  loadButton.addEventListener("click", loadDungeon);

  makeInitialDungeon();
  setTool("floor");
  setMode("start");
  requestAnimationFrame(loop);
})();
