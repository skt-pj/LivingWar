(() => {
  "use strict";

  const GB_COLORS = {
    light: "#9BBC0F",
    lightMid: "#8BAC0F",
    darkMid: "#306230",
    dark: "#0F380F",
  };

  const CANVAS_W = 160;
  const CANVAS_H = 144;
  const HUD_H = 16;
  const TILE = 8;
  const COLS = 20;
  const ROWS = 16;
  const SAVE_KEY = "livingwar:dungeon:v2";
  const MAX_ZOOM = 4;
  const LONG_PRESS_MS = 350;
  const DRAG_THRESHOLD = 7;
  const DOUBLE_TAP_MS = 300;
  const TOUCH_PLACEMENT_OFFSET_PX = 54;

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
    wall: "壁\n移動不可。入口から出口（階段）への通路を塞ぐ配置はできません。モンスター・罠は通路判定に含みません。",
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
  let longPressTimer = null;
  let paintStroke = null;
  let pendingTapTimer = null;
  let pendingTap = null;
  let placementPreviewTile = null;

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
      enforceValidDungeonRoute();
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

  function clearCanvas(color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  const PIXEL_FONT = {
    A:["01110","10001","10001","11111","10001","10001","10001"],
    C:["01111","10000","10000","10000","10000","10000","01111"],
    D:["11110","10001","10001","10001","10001","10001","11110"],
    E:["11111","10000","10000","11110","10000","10000","11111"],
    G:["01111","10000","10000","10111","10001","10001","01111"],
    H:["10001","10001","10001","11111","10001","10001","10001"],
    I:["11111","00100","00100","00100","00100","00100","11111"],
    L:["10000","10000","10000","10000","10000","10000","11111"],
    M:["10001","11011","10101","10101","10001","10001","10001"],
    N:["10001","11001","10101","10011","10001","10001","10001"],
    O:["01110","10001","10001","10001","10001","10001","01110"],
    R:["11110","10001","10001","11110","10100","10010","10001"],
    S:["01111","10000","10000","01110","00001","00001","11110"],
    T:["11111","00100","00100","00100","00100","00100","00100"],
    U:["10001","10001","10001","10001","10001","10001","01110"],
    V:["10001","10001","10001","10001","01010","01010","00100"],
    W:["10001","10001","10001","10101","10101","11011","10001"],
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
      const glyph = PIXEL_FONT[ch] || PIXEL_FONT[" "];
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

  function drawStartScreen() {
    clearCanvas(GB_COLORS.light);
    pixelText("LIVING WAR", 80, 26, 2, GB_COLORS.dark, "center");
    pixelText("YUUSHA", 80, 58, 1, GB_COLORS.darkMid, "center");
    pixelText("VS", 80, 72, 1, GB_COLORS.dark, "center");
    pixelText("MAOU", 80, 86, 1, GB_COLORS.darkMid, "center");
    pixelText("SELECT ARMY", 80, 118, 1, GB_COLORS.dark, "center");
  }

  function drawDungeon() {
    clearCanvas(GB_COLORS.lightMid);
    drawHud();

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        drawTile(x, y, state.tiles[y][x]);
      }
    }

    if (state.entrance) drawEntrance(state.entrance);
    if (state.stairs) drawStairs(state.stairs);
    state.traps.forEach(drawTrap);
    state.monsters.forEach(drawMonster);
    drawPlacementPreview();
  }

  function drawHud() {
    ctx.fillStyle = GB_COLORS.dark;
    ctx.fillRect(0, 0, CANVAS_W, HUD_H);
    pixelText("MAOU 1F", 4, 4, 1, GB_COLORS.light, "left");
    pixelText(simulation ? "RUN" : "EDIT", 156, 4, 1, GB_COLORS.light, "right");
  }

  function drawTile(x, y, type) {
    const px = x * TILE;
    const py = HUD_H + y * TILE;

    if (type === "wall") {
      ctx.fillStyle = GB_COLORS.darkMid;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = GB_COLORS.dark;
      ctx.fillRect(px, py, TILE, 2);
      ctx.fillRect(px, py, 2, TILE);
      ctx.fillStyle = GB_COLORS.lightMid;
      ctx.fillRect(px + 3, py + 3, 4, 2);
      ctx.fillRect(px + 1, py + 6, 4, 1);
    } else {
      ctx.fillStyle = (x + y) % 2 === 0 ? GB_COLORS.light : GB_COLORS.lightMid;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = GB_COLORS.darkMid;
      ctx.fillRect(px + 2, py + 2, 1, 1);
      ctx.fillRect(px + 6, py + 5, 1, 1);
    }

    ctx.strokeStyle = GB_COLORS.darkMid;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
  }

  function drawEntrance(point) {
    const px = point.x * TILE;
    const py = HUD_H + point.y * TILE;
    ctx.fillStyle = GB_COLORS.dark;
    ctx.fillRect(px + 1, py + 1, 6, 7);
    ctx.fillStyle = GB_COLORS.light;
    ctx.fillRect(px + 3, py + 3, 3, 5);
    ctx.fillStyle = GB_COLORS.darkMid;
    ctx.fillRect(px + 4, py + 5, 1, 1);
  }

  function drawStairs(point) {
    const px = point.x * TILE;
    const py = HUD_H + point.y * TILE;
    ctx.fillStyle = GB_COLORS.dark;
    ctx.fillRect(px + 1, py + 1, 6, 6);
    ctx.fillStyle = GB_COLORS.lightMid;
    ctx.fillRect(px + 2, py + 5, 5, 1);
    ctx.fillRect(px + 3, py + 3, 4, 1);
    ctx.fillRect(px + 4, py + 1, 3, 1);
  }

  function drawTrap(trap) {
    const px = trap.x * TILE;
    const py = HUD_H + trap.y * TILE;
    ctx.fillStyle = GB_COLORS.darkMid;
    ctx.fillRect(px + 1, py + 6, 6, 1);
    ctx.fillStyle = GB_COLORS.dark;
    ctx.fillRect(px + 1, py + 4, 1, 2);
    ctx.fillRect(px + 3, py + 2, 1, 4);
    ctx.fillRect(px + 5, py + 3, 1, 3);
  }

  function drawMonster(monster) {
    const px = monster.x * TILE;
    const py = HUD_H + monster.y * TILE;
    if (monster.type === "slime") drawSlime(px, py);
    if (monster.type === "goblin") drawGoblin(px, py);
  }

  function drawSlime(px, py) {
    ctx.fillStyle = GB_COLORS.dark;
    ctx.fillRect(px + 2, py + 3, 4, 1);
    ctx.fillRect(px + 1, py + 4, 6, 3);
    ctx.fillStyle = GB_COLORS.light;
    ctx.fillRect(px + 2, py + 5, 1, 1);
    ctx.fillRect(px + 5, py + 5, 1, 1);
  }

  function drawGoblin(px, py) {
    ctx.fillStyle = GB_COLORS.dark;
    ctx.fillRect(px + 2, py + 1, 4, 1);
    ctx.fillRect(px + 1, py + 2, 6, 5);
    ctx.fillStyle = GB_COLORS.light;
    ctx.fillRect(px + 2, py + 3, 1, 1);
    ctx.fillRect(px + 5, py + 3, 1, 1);
    ctx.fillStyle = GB_COLORS.lightMid;
    ctx.fillRect(px + 3, py + 5, 2, 1);
  }

  function drawPlacementPreview() {
    if (!placementPreviewTile || mode !== "editor" || simulation) return;

    const { x, y } = placementPreviewTile;
    const px = x * TILE;
    const py = HUD_H + y * TILE;

    if (selectedTool === "wall") {
      ctx.fillStyle = GB_COLORS.darkMid;
      ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
      ctx.fillStyle = GB_COLORS.dark;
      ctx.fillRect(px + 1, py + 1, TILE - 2, 2);
    } else if (selectedTool === "floor") {
      ctx.fillStyle = GB_COLORS.light;
      ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
    } else if (selectedTool === "erase") {
      ctx.fillStyle = GB_COLORS.dark;
      for (let i = 1; i < TILE - 1; i++) {
        ctx.fillRect(px + i, py + i, 1, 1);
        ctx.fillRect(px + TILE - 1 - i, py + i, 1, 1);
      }
    } else if (selectedTool === "entrance") {
      drawEntrance({ x, y });
    } else if (selectedTool === "stairs") {
      drawStairs({ x, y });
    } else if (selectedTool === "trap") {
      drawTrap({ x, y, type: "spike" });
    } else if (selectedTool === "slime") {
      drawSlime(px, py);
    } else if (selectedTool === "goblin") {
      drawGoblin(px, py);
    }

    ctx.strokeStyle = GB_COLORS.dark;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    ctx.fillStyle = GB_COLORS.light;
    ctx.fillRect(px, py, 2, 1);
    ctx.fillRect(px, py, 1, 2);
    ctx.fillRect(px + TILE - 2, py, 2, 1);
    ctx.fillRect(px + TILE - 1, py, 1, 2);
    ctx.fillRect(px, py + TILE - 1, 2, 1);
    ctx.fillRect(px, py + TILE - 2, 1, 2);
    ctx.fillRect(px + TILE - 2, py + TILE - 1, 2, 1);
    ctx.fillRect(px + TILE - 1, py + TILE - 2, 1, 2);
  }

  function placementTileFromTouch(touch) {
    const offsets = [
      TOUCH_PLACEMENT_OFFSET_PX,
      42,
      30,
      18,
      0,
    ];

    for (const offset of offsets) {
      const tile = canvasToTile({
        clientX: touch.clientX,
        clientY: touch.clientY - offset,
      });
      if (tile) return tile;
    }

    return null;
  }

  function canvasToTile(event) {
    const rect = viewport.getBoundingClientRect();
    const localX = (event.clientX - rect.left - view.offsetX) / view.scale;
    const localY = (event.clientY - rect.top - view.offsetY) / view.scale;
    const logicalX = (localX / rect.width) * CANVAS_W;
    const logicalY = (localY / rect.height) * CANVAS_H;

    if (logicalY < HUD_H) return null;

    const tileX = Math.floor(logicalX / TILE);
    const tileY = Math.floor((logicalY - HUD_H) / TILE);

    if (tileX < 0 || tileX >= COLS || tileY < 0 || tileY >= ROWS) return null;
    return { x: tileX, y: tileY };
  }

  const DIRS = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  function samePoint(point, x, y) {
    return point && point.x === x && point.y === y;
  }

  function removeMonsterAndTrapAt(x, y) {
    state.monsters = state.monsters.filter((m) => !(m.x === x && m.y === y));
    state.traps = state.traps.filter((t) => !(t.x === x && t.y === y));
  }

  function removePlacedAt(x, y) {
    if (simulation) return false;

    const monsterBefore = state.monsters.length;
    const trapBefore = state.traps.length;
    removeMonsterAndTrapAt(x, y);

    let removed = state.monsters.length !== monsterBefore || state.traps.length !== trapBefore;

    if (state.tiles[y][x] === "wall" && !samePoint(state.entrance, x, y) && !samePoint(state.stairs, x, y)) {
      state.tiles[y][x] = "floor";
      removed = true;
    }

    if (!removed) {
      if (samePoint(state.entrance, x, y) || samePoint(state.stairs, x, y)) {
        screenHelp.textContent = "入口と出口は必須なので削除できません。移動してください。";
      }
      return false;
    }

    enforceValidDungeonRoute();
    updateCounts();
    drawDungeon();
    screenHelp.textContent = "配置物を削除しました。";
    return true;
  }

  function runPendingTap() {
    if (!pendingTap) return;

    const tile = pendingTap.tile;
    pendingTap = null;
    if (pendingTapTimer !== null) {
      clearTimeout(pendingTapTimer);
      pendingTapTimer = null;
    }
    placeAt(tile.x, tile.y);
  }

  function queueTap(tile) {
    if (!tile || simulation) return;

    const now = Date.now();
    if (
      pendingTap &&
      now - pendingTap.time <= DOUBLE_TAP_MS &&
      pendingTap.tile.x === tile.x &&
      pendingTap.tile.y === tile.y
    ) {
      if (pendingTapTimer !== null) {
        clearTimeout(pendingTapTimer);
        pendingTapTimer = null;
      }
      pendingTap = null;
      removePlacedAt(tile.x, tile.y);
      suppressClickUntil = now + 500;
      return;
    }

    if (pendingTap) runPendingTap();

    pendingTap = { tile, time: now };
    pendingTapTimer = setTimeout(() => {
      runPendingTap();
    }, DOUBLE_TAP_MS);
  }

  function hasEntranceToExitPath(entrance = state.entrance, stairs = state.stairs) {
    if (!entrance || !stairs) return false;
    if (samePoint(entrance, stairs.x, stairs.y)) return false;
    if (state.tiles[entrance.y]?.[entrance.x] !== "floor") return false;
    if (state.tiles[stairs.y]?.[stairs.x] !== "floor") return false;

    const queue = [entrance];
    const visited = new Set([`${entrance.x},${entrance.y}`]);

    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      if (samePoint(stairs, current.x, current.y)) return true;

      for (const dir of DIRS) {
        const nx = current.x + dir.x;
        const ny = current.y + dir.y;
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
        if (state.tiles[ny][nx] !== "floor") continue;

        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }

    return false;
  }

  function rejectBlockedRoute() {
    screenHelp.textContent = "入口から出口への通路が塞がるため、その配置はできません。";
  }

  function repairEntranceToExitPath() {
    if (!state.entrance || !state.stairs) return false;
    if (hasEntranceToExitPath()) return false;

    const start = state.entrance;
    const goal = state.stairs;
    const dist = Array.from({ length: ROWS }, () => Array(COLS).fill(Infinity));
    const prev = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const deque = [{ x: start.x, y: start.y }];
    dist[start.y][start.x] = 0;

    while (deque.length > 0) {
      const current = deque.shift();
      if (current.x === goal.x && current.y === goal.y) break;

      for (const dir of DIRS) {
        const nx = current.x + dir.x;
        const ny = current.y + dir.y;
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;

        const cost = state.tiles[ny][nx] === "wall" ? 1 : 0;
        const nextDist = dist[current.y][current.x] + cost;
        if (nextDist >= dist[ny][nx]) continue;

        dist[ny][nx] = nextDist;
        prev[ny][nx] = current;

        if (cost === 0) {
          deque.unshift({ x: nx, y: ny });
        } else {
          deque.push({ x: nx, y: ny });
        }
      }
    }

    if (!Number.isFinite(dist[goal.y][goal.x])) return false;

    let cursor = { x: goal.x, y: goal.y };
    while (!(cursor.x === start.x && cursor.y === start.y)) {
      state.tiles[cursor.y][cursor.x] = "floor";
      const previous = prev[cursor.y][cursor.x];
      if (!previous) break;
      cursor = previous;
    }

    state.tiles[start.y][start.x] = "floor";
    state.tiles[goal.y][goal.x] = "floor";
    return true;
  }

  function enforceValidDungeonRoute() {
    if (hasEntranceToExitPath()) return false;

    const repaired = repairEntranceToExitPath();
    if (repaired) {
      screenHelp.textContent = "入口から出口への経路が塞がれていたため、最小限の壁を床に戻しました。";
      drawDungeon();
    }
    return repaired;
  }

  function placeAt(x, y) {
    if (simulation) return;

    if (selectedTool === "wall") {
      if (samePoint(state.entrance, x, y) || samePoint(state.stairs, x, y)) {
        rejectBlockedRoute();
        return;
      }

      const previousTile = state.tiles[y][x];
      state.tiles[y][x] = "wall";

      if (!hasEntranceToExitPath()) {
        state.tiles[y][x] = previousTile;
        rejectBlockedRoute();
        drawDungeon();
        return;
      }

      removeMonsterAndTrapAt(x, y);
    } else if (selectedTool === "floor") {
      state.tiles[y][x] = "floor";
    } else if (selectedTool === "erase") {
      state.tiles[y][x] = "floor";
      removeMonsterAndTrapAt(x, y);
    } else if (selectedTool === "entrance") {
      if (state.tiles[y][x] !== "floor" || samePoint(state.stairs, x, y)) return;

      const previousEntrance = state.entrance;
      state.entrance = { x, y };

      if (!hasEntranceToExitPath()) {
        state.entrance = previousEntrance;
        rejectBlockedRoute();
        drawDungeon();
        return;
      }
    } else if (selectedTool === "stairs") {
      if (state.tiles[y][x] !== "floor" || samePoint(state.entrance, x, y)) return;

      const previousStairs = state.stairs;
      state.stairs = { x, y };

      if (!hasEntranceToExitPath()) {
        state.stairs = previousStairs;
        rejectBlockedRoute();
        drawDungeon();
        return;
      }
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

    enforceValidDungeonRoute();
    updateCounts();
    drawDungeon();
  }

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

      if (!hasEntranceToExitPath()) {
        repairEntranceToExitPath();
      }

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

  function clearLongPressTimer() {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function paintLineTo(tile) {
    if (!tile || simulation) return;

    if (!paintStroke || !paintStroke.lastTile) {
      placeAt(tile.x, tile.y);
      paintStroke = { active: true, lastTile: tile };
      return;
    }

    let x0 = paintStroke.lastTile.x;
    let y0 = paintStroke.lastTile.y;
    const x1 = tile.x;
    const y1 = tile.y;
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    while (true) {
      if (x0 !== paintStroke.lastTile.x || y0 !== paintStroke.lastTile.y) {
        placeAt(x0, y0);
      }
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }

    paintStroke.lastTile = tile;
  }

  function beginLongPressPlacement(clientX, clientY) {
    clearLongPressTimer();
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      if (mode !== "editor" || simulation || pinch || !pan || pan.moved) return;

      paintStroke = { active: true, lastTile: null };
      const tile = placementTileFromTouch({ clientX, clientY });
      placementPreviewTile = tile;

      if (tile) {
        paintLineTo(tile);
        screenHelp.textContent = "連続設置中。指の上に表示されたカーソル位置へ配置します。";
      } else {
        drawDungeon();
      }
      suppressClickUntil = Date.now() + 400;
    }, LONG_PRESS_MS);
  }

  viewport.addEventListener("touchstart", (event) => {
    if (mode !== "editor") return;

    if (event.touches.length === 2) {
      event.preventDefault();
      clearLongPressTimer();
      paintStroke = null;
      placementPreviewTile = null;
      drawDungeon();
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

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      pan = {
        startX: touch.clientX,
        startY: touch.clientY,
        startOffsetX: view.offsetX,
        startOffsetY: view.offsetY,
        moved: false,
        allowTap: true,
      };
      paintStroke = null;
      beginLongPressPlacement(touch.clientX, touch.clientY);
    }
  }, { passive: false });

  viewport.addEventListener("touchmove", (event) => {
    if (mode !== "editor") return;

    if (event.touches.length === 2 && pinch) {
      event.preventDefault();
      clearLongPressTimer();
      paintStroke = null;
      placementPreviewTile = null;
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

    if (event.touches.length !== 1) return;

    const touch = event.touches[0];

    if (paintStroke && paintStroke.active) {
      event.preventDefault();
      const tile = placementTileFromTouch(touch);
      placementPreviewTile = tile;
      if (tile) {
        paintLineTo(tile);
      } else {
        drawDungeon();
      }
      suppressClickUntil = Date.now() + 300;
      return;
    }

    if (!pan) return;

    const dx = touch.clientX - pan.startX;
    const dy = touch.clientY - pan.startY;
    if (!pan.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

    clearLongPressTimer();
    pan.moved = true;
    suppressClickUntil = Date.now() + 250;

    if (view.scale > 1) {
      event.preventDefault();
      view.offsetX = pan.startOffsetX + dx;
      view.offsetY = pan.startOffsetY + dy;
      clampView();
      applyViewTransform();
    }
  }, { passive: false });

  viewport.addEventListener("touchend", (event) => {
    const didPan = Boolean(pan && pan.moved);
    const didPaint = Boolean(paintStroke && paintStroke.active);
    const allowTap = Boolean(pan && pan.allowTap && !didPan && !didPaint);
    const endedTouch = event.changedTouches[0] || null;

    clearLongPressTimer();

    if (event.touches.length < 2) pinch = null;

    if (event.touches.length === 0) {
      pan = null;
      paintStroke = null;
      placementPreviewTile = null;

      if (didPaint) {
        drawDungeon();
        screenHelp.textContent = "連続設置を終了しました。";
        suppressClickUntil = Date.now() + 500;
      } else if (didPan) {
        suppressClickUntil = Date.now() + 350;
      } else if (allowTap && endedTouch) {
        const tile = canvasToTile(endedTouch);
        if (tile) queueTap(tile);
        suppressClickUntil = Date.now() + 700;
      }
    } else if (event.touches.length === 1 && pinch === null) {
      const touch = event.touches[0];
      pan = {
        startX: touch.clientX,
        startY: touch.clientY,
        startOffsetX: view.offsetX,
        startOffsetY: view.offsetY,
        moved: false,
        allowTap: false,
      };
      paintStroke = null;
    }
  }, { passive: true });

  viewport.addEventListener("touchcancel", () => {
    clearLongPressTimer();
    pinch = null;
    pan = null;
    paintStroke = null;
    placementPreviewTile = null;
    drawDungeon();
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
    if (tile) queueTap(tile);
  });

  canvas.addEventListener("dblclick", (event) => {
    event.preventDefault();
  });

  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
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
