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
  const LEGACY_SAVE_KEY = "livingwar:dungeon:v2";
  const SAVE_SLOT_PREFIX = "livingwar:save:v3:";
  const SAVE_SLOT_COUNT = 3;
  const MAX_ZOOM = 4;
  const LONG_PRESS_MS = 350;
  const DRAG_THRESHOLD = 7;
  const DOUBLE_TAP_MS = 300;
  const TOUCH_PLACEMENT_OFFSET_PX = 54;
  const DEX_DISCOVERY_KEY = "livingwar:dex:v1";
  const MONSTER_SIZE_COST = Object.freeze({ S: 1, M: 2, L: 4, XL: 8 });
  const ROOM_CAPACITY = Object.freeze({ "小部屋": 4, "中部屋": 8, "大部屋": 12 });

  const MONSTER_DEFS = {
    slime: {
      dexNo: 1,
      name: "スライム",
      family: "ゼリー系",
      size: "S",
      levelRange: [1, 2],
      stats: { hp: 12, attack: 4, defense: 2, speed: 5 },
      movement: { style: "wander", territory: "room_locked", moveEvery: 1 },
      dexText: "最下級。数だけは立派だ。部屋から出る度胸もないが、足止めくらいにはなる。",
    },
    redSlime: {
      dexNo: 2,
      name: "赤スライム",
      family: "ゼリー系",
      size: "S",
      levelRange: [3, 5],
      stats: { hp: 15, attack: 8, defense: 3, speed: 7 },
      movement: { style: "chase", territory: "room_preferred", moveEvery: 1 },
      dexText: "少し赤くなっただけで強者気取りだ。とはいえ追いかける根性はある。逃げる勇者には便利。",
    },
    hardSlime: {
      dexNo: 3,
      name: "ハードスライム",
      family: "ゼリー系",
      size: "M",
      levelRange: [4, 6],
      stats: { hp: 26, attack: 5, defense: 12, speed: 2 },
      movement: { style: "guard", territory: "room_locked", moveEvery: 2 },
      dexText: "硬い。遅い。以上だ。入口に居座らせれば役には立つが、追撃を期待するだけ無駄である。",
    },
    goblin: {
      dexNo: 90,
      name: "ゴブリン",
      family: "ゴブリン系",
      size: "M",
      levelRange: [1, 1],
      stats: { hp: 18, attack: 6, defense: 4, speed: 5 },
      movement: { style: "patrol", territory: "free_roam", moveEvery: 1 },
      dexText: "旧配置個体。命令を聞くふりだけは上手い。",
      legacy: true,
    },
  };

  const SPAWNER_DEFS = {
    jellyBase: {
      name: "ゼリーの元",
      monsterType: "slime",
      batchSize: 2,
      activeLimit: 6,
      intervalMs: 3600,
    },
    redJelly: {
      name: "赤いゼリーの元",
      monsterType: "redSlime",
      batchSize: 2,
      activeLimit: 5,
      intervalMs: 4400,
    },
    hardJelly: {
      name: "硬いゼリーの元",
      monsterType: "hardSlime",
      batchSize: 1,
      activeLimit: 3,
      intervalMs: 5600,
    },
  };

  const TOOL_INFO = {
    room: "部屋\nドラッグで範囲を指定します。外周は壁、内部は床になり、出入口を1マス自動で作ります。",
    floor: "床\n歩行可能なマスです。",
    wall: "壁\n移動不可。入口から出口（階段）への通路を塞ぐ配置はできません。",
    erase: "消去\nモンスター・罠・出現アイテムを消し、床に戻します。",
    entrance: "入口\n勇者が1Fへ侵入する開始地点です。1Fに1か所だけ置けます。",
    stairs: "次の階段\n次の階へ進む地点です。1Fに1か所だけ置けます。",
    jellyBase: "ゼリーの元\n部屋内でスライムを発生。サイズS。1回2体、同時生存6体まで。部屋からは出ません。",
    redJelly: "赤いゼリーの元\n部屋内で赤スライムを発生。サイズS。1回2体、同時生存5体まで。部屋を中心に動き、外へ出ることがあります。",
    hardJelly: "硬いゼリーの元\n部屋内でハードスライムを発生。サイズM。1回1体、同時生存3体まで。部屋から出ません。",
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
  const menuButton = document.getElementById("menuButton");
  const editorMenu = document.getElementById("editorMenu");
  const openHistoryButton = document.getElementById("openHistoryButton");
  const historyPanel = document.getElementById("historyPanel");
  const closeHistoryButton = document.getElementById("closeHistoryButton");
  const openDexButton = document.getElementById("openDexButton");
  const dexPanel = document.getElementById("dexPanel");
  const closeDexButton = document.getElementById("closeDexButton");
  const dexList = document.getElementById("dexList");
  const dexProgress = document.getElementById("dexProgress");
  const simulateButton = document.getElementById("simulateButton");
  const resetButton = document.getElementById("resetButton");
  const saveButton = document.getElementById("saveButton");
  const loadButton = document.getElementById("loadButton");
  const savePanel = document.getElementById("savePanel");
  const savePanelTitle = document.getElementById("savePanelTitle");
  const saveSlotList = document.getElementById("saveSlotList");
  const closeSavePanelButton = document.getElementById("closeSavePanelButton");
  const zoomResetButton = document.getElementById("zoomResetButton");
  const toolInfo = document.getElementById("toolInfo");
  const monsterCount = document.getElementById("monsterCount");
  const trapCount = document.getElementById("trapCount");
  const simState = document.getElementById("simState");
  const screenHelp = document.getElementById("screenHelp");
  const messageLog = document.getElementById("messageLog");
  const toolButtons = [...document.querySelectorAll(".tool-button")];

  let mode = "start";
  let selectedTool = "floor";
  let simulation = false;
  let lastStepAt = 0;
  let nextMonsterId = 1;
  let nextSpawnerId = 1;
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
  let roomDrag = null;
  let roomSnapshot = [];
  let roomEffects = [];
  let nextMessageId = 1;
  let lastMessageText = "";
  let lastMessageAt = 0;
  let savePanelMode = "save";
  const discoveredMonsters = new Set();

  const state = {
    tiles: [],
    monsters: [],
    spawners: [],
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
    state.spawners = [];
    state.traps = [];
    state.entrance = { x: 1, y: 1 };
    state.stairs = { x: COLS - 2, y: ROWS - 2 };
    nextMonsterId = 1;
    nextSpawnerId = 1;
    updateCounts();
  }

  function setMode(next) {
    mode = next;
    if (mode === "start") {
      simulation = false;
      roomDrag = null;
      closeEditorMenu();
      historyPanel.classList.add("hidden");
      dexPanel.classList.add("hidden");
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
      analyzeRooms({ announce: false });
      drawDungeon();
      addMessage("ダンジョン製作を開始しました。", "info", true);
    }
  }

  function setTool(tool) {
    if (roomDrag) {
      roomDrag = null;
      drawDungeon();
    }
    selectedTool = tool;
    toolButtons.forEach((button) => button.classList.toggle("active", button.dataset.tool === tool));
    toolInfo.textContent = TOOL_INFO[tool] || "";
  }

  function updateCounts() {
    monsterCount.textContent = String(state.monsters.length);
    trapCount.textContent = String(state.traps.length);
  }

  function addMessage(text, kind = "info", dedupe = false) {
    if (!messageLog || !text) return;

    const now = Date.now();
    if (dedupe && text === lastMessageText && now - lastMessageAt < 900) return;
    lastMessageText = text;
    lastMessageAt = now;

    const nearBottom = messageLog.scrollHeight - messageLog.scrollTop - messageLog.clientHeight < 28;
    const entry = document.createElement("div");
    entry.className = `message-entry message-entry--${kind}`;

    const number = document.createElement("span");
    number.className = "message-index";
    number.textContent = String(nextMessageId++).padStart(2, "0");

    const body = document.createElement("span");
    body.className = "message-text";
    body.textContent = text;

    entry.append(number, body);
    messageLog.appendChild(entry);

    while (messageLog.children.length > 80) {
      messageLog.removeChild(messageLog.firstElementChild);
    }

    if (nearBottom) {
      messageLog.scrollTop = messageLog.scrollHeight;
    }
  }

  function resetMessageHistory() {
    if (!messageLog) return;
    messageLog.replaceChildren();
    nextMessageId = 1;
    lastMessageText = "";
    lastMessageAt = 0;
  }

  function closeEditorMenu() {
    editorMenu.classList.add("hidden");
    menuButton.setAttribute("aria-expanded", "false");
  }

  function toggleEditorMenu() {
    const willOpen = editorMenu.classList.contains("hidden");
    editorMenu.classList.toggle("hidden", !willOpen);
    menuButton.setAttribute("aria-expanded", String(willOpen));
  }

  function openHistoryPanel() {
    closeEditorMenu();
    historyPanel.classList.remove("hidden");
    requestAnimationFrame(() => {
      messageLog.scrollTop = messageLog.scrollHeight;
      closeHistoryButton.focus();
    });
  }

  function closeHistoryPanel() {
    historyPanel.classList.add("hidden");
    menuButton.focus();
  }

  function loadDexDiscovery() {
    discoveredMonsters.clear();
    try {
      const stored = JSON.parse(localStorage.getItem(DEX_DISCOVERY_KEY) || "[]");
      if (Array.isArray(stored)) {
        stored.forEach((type) => {
          if (MONSTER_DEFS[type] && !MONSTER_DEFS[type].legacy) discoveredMonsters.add(type);
        });
      }
    } catch {
      // 図鑑データが壊れている場合は未発見から始める。
    }
  }

  function discoverMonster(type) {
    const def = MONSTER_DEFS[type];
    if (!def || def.legacy || discoveredMonsters.has(type)) return;
    discoveredMonsters.add(type);
    try {
      localStorage.setItem(DEX_DISCOVERY_KEY, JSON.stringify([...discoveredMonsters]));
    } catch {
      // 図鑑解放自体はゲーム進行を止めない。
    }
    renderDex();
    addMessage(`図鑑に「${def.name}」が登録されました。`, "info", true);
  }

  function movementText(def) {
    const territory = {
      room_locked: "部屋から出ない",
      room_preferred: "部屋中心・外出可",
      free_roam: "自由移動",
    }[def.movement.territory] || "不明";
    const style = {
      wander: "徘徊",
      chase: "追跡型",
      guard: "警備型",
      patrol: "巡回",
    }[def.movement.style] || def.movement.style;
    return `${style} / ${territory}`;
  }

  function spawnerForMonster(type) {
    return Object.values(SPAWNER_DEFS).find((def) => def.monsterType === type) || null;
  }

  function renderDex() {
    if (!dexList || !dexProgress) return;
    const types = Object.keys(MONSTER_DEFS).filter((type) => !MONSTER_DEFS[type].legacy);
    dexProgress.textContent = `発見 ${types.filter((type) => discoveredMonsters.has(type)).length} / ${types.length}`;

    dexList.replaceChildren();
    for (const type of types) {
      const def = MONSTER_DEFS[type];
      const discovered = discoveredMonsters.has(type);
      const entry = document.createElement("article");
      entry.className = `dex-entry${discovered ? "" : " dex-entry--locked"}`;

      const side = document.createElement("div");
      side.innerHTML = `<div class="dex-number">No.${String(def.dexNo).padStart(3, "0")}</div><div class="dex-name">${discovered ? def.name : "???"}</div><div class="dex-family">${discovered ? `${def.family} / SIZE ${def.size}` : "未発見"}</div>`;

      const body = document.createElement("div");
      if (!discovered) {
        body.innerHTML = '<div class="dex-locked-copy">まだ実物を確認していない。魔王軍のくせに報告が遅い。</div>';
      } else {
        const source = spawnerForMonster(type);
        const spawnText = source ? `${source.name} / 1回${source.batchSize}体 / 同時${source.activeLimit}体` : "出現源不明";
        body.innerHTML = `
          <div class="dex-stats">
            <div class="dex-stat"><span>HP</span><strong>${def.stats.hp}</strong></div>
            <div class="dex-stat"><span>ATK</span><strong>${def.stats.attack}</strong></div>
            <div class="dex-stat"><span>DEF</span><strong>${def.stats.defense}</strong></div>
            <div class="dex-stat"><span>SPD</span><strong>${def.stats.speed}</strong></div>
          </div>
          <div class="dex-meta">Lv ${def.levelRange[0]}〜${def.levelRange[1]}<br>出現：${spawnText}<br>移動：${movementText(def)}</div>
          <div class="dex-comment">${def.dexText}</div>
        `;
      }

      entry.append(side, body);
      dexList.appendChild(entry);
    }
  }

  function openDexPanel() {
    closeEditorMenu();
    renderDex();
    dexPanel.classList.remove("hidden");
    requestAnimationFrame(() => closeDexButton.focus());
  }

  function closeDexPanel() {
    dexPanel.classList.add("hidden");
    menuButton.focus();
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
    state.spawners.forEach(drawSpawner);
    state.traps.forEach(drawTrap);
    state.monsters.forEach(drawMonster);
    drawPlacementPreview();
    drawRoomBuildPreview();
    drawRoomEffects(performance.now());
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

      ctx.strokeStyle = GB_COLORS.dark;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      return;
    }

    ctx.fillStyle = GB_COLORS.light;
    ctx.fillRect(px, py, TILE, TILE);

    // 床は形を読み取りやすくするため、暗い点模様を使わず弱い境界だけ残す。
    ctx.fillStyle = GB_COLORS.lightMid;
    ctx.fillRect(px + TILE - 1, py, 1, TILE);
    ctx.fillRect(px, py + TILE - 1, TILE, 1);
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
    else if (monster.type === "redSlime") drawRedSlime(px, py);
    else if (monster.type === "hardSlime") drawHardSlime(px, py);
    else if (monster.type === "goblin") drawGoblin(px, py);
  }

  function drawSlime(px, py) {
    ctx.fillStyle = GB_COLORS.dark;
    ctx.fillRect(px + 2, py + 3, 4, 1);
    ctx.fillRect(px + 1, py + 4, 6, 3);
    ctx.fillStyle = GB_COLORS.light;
    ctx.fillRect(px + 2, py + 5, 1, 1);
    ctx.fillRect(px + 5, py + 5, 1, 1);
  }

  function drawRedSlime(px, py) {
    drawSlime(px, py);
    ctx.fillStyle = GB_COLORS.lightMid;
    ctx.fillRect(px + 3, py + 3, 2, 1);
    ctx.fillStyle = GB_COLORS.dark;
    ctx.fillRect(px + 3, py + 6, 2, 1);
  }

  function drawHardSlime(px, py) {
    ctx.fillStyle = GB_COLORS.dark;
    ctx.fillRect(px + 1, py + 2, 6, 5);
    ctx.fillStyle = GB_COLORS.darkMid;
    ctx.fillRect(px + 2, py + 1, 4, 1);
    ctx.fillStyle = GB_COLORS.light;
    ctx.fillRect(px + 2, py + 4, 1, 1);
    ctx.fillRect(px + 5, py + 4, 1, 1);
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

  function drawSpawner(spawner) {
    const px = spawner.x * TILE;
    const py = HUD_H + spawner.y * TILE;

    ctx.fillStyle = GB_COLORS.darkMid;
    ctx.fillRect(px + 2, py + 2, 4, 5);
    ctx.fillStyle = GB_COLORS.dark;
    ctx.fillRect(px + 3, py + 1, 2, 1);
    ctx.fillRect(px + 1, py + 5, 6, 2);

    if (spawner.type === "redJelly") {
      ctx.fillStyle = GB_COLORS.light;
      ctx.fillRect(px + 3, py + 3, 2, 2);
      ctx.fillStyle = GB_COLORS.dark;
      ctx.fillRect(px + 4, py + 2, 1, 1);
    } else if (spawner.type === "hardJelly") {
      ctx.fillStyle = GB_COLORS.dark;
      ctx.fillRect(px + 2, py + 2, 4, 1);
      ctx.fillRect(px + 2, py + 4, 4, 1);
    } else {
      ctx.fillStyle = GB_COLORS.light;
      ctx.fillRect(px + 3, py + 3, 2, 2);
    }
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
    } else if (SPAWNER_DEFS[selectedTool]) {
      drawSpawner({ x, y, type: selectedTool });
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

  function normalizeRoomRect(start, end) {
    return {
      minX: Math.min(start.x, end.x),
      maxX: Math.max(start.x, end.x),
      minY: Math.min(start.y, end.y),
      maxY: Math.max(start.y, end.y),
      width: Math.abs(end.x - start.x) + 1,
      height: Math.abs(end.y - start.y) + 1,
    };
  }

  function isRoomPerimeter(rect, x, y) {
    return x === rect.minX || x === rect.maxX || y === rect.minY || y === rect.maxY;
  }

  function roomDoorCandidates(rect) {
    const candidates = [];

    for (let x = rect.minX + 1; x < rect.maxX; x++) {
      candidates.push({ x, y: rect.minY, outsideX: x, outsideY: rect.minY - 1 });
      candidates.push({ x, y: rect.maxY, outsideX: x, outsideY: rect.maxY + 1 });
    }
    for (let y = rect.minY + 1; y < rect.maxY; y++) {
      candidates.push({ x: rect.minX, y, outsideX: rect.minX - 1, outsideY: y });
      candidates.push({ x: rect.maxX, y, outsideX: rect.maxX + 1, outsideY: y });
    }

    return candidates.filter((candidate) =>
      candidate.outsideX >= 0 &&
      candidate.outsideX < COLS &&
      candidate.outsideY >= 0 &&
      candidate.outsideY < ROWS &&
      state.tiles[candidate.outsideY][candidate.outsideX] === "floor"
    );
  }

  function chooseRoomDoor(rect) {
    const candidates = roomDoorCandidates(rect);
    if (candidates.length === 0) return null;

    const target = state.entrance || {
      x: Math.floor((rect.minX + rect.maxX) / 2),
      y: Math.floor((rect.minY + rect.maxY) / 2),
    };

    return candidates.sort((a, b) => {
      const distanceA = Math.abs(a.x - target.x) + Math.abs(a.y - target.y);
      const distanceB = Math.abs(b.x - target.x) + Math.abs(b.y - target.y);
      return distanceA - distanceB;
    })[0];
  }

  function roomRectStatus(rect) {
    if (rect.width < 4 || rect.height < 4) {
      return { valid: false, message: "部屋は外周を含めて4×4マス以上にしてください。" };
    }

    if (
      rect.minX <= 0 ||
      rect.minY <= 0 ||
      rect.maxX >= COLS - 1 ||
      rect.maxY >= ROWS - 1
    ) {
      return { valid: false, message: "部屋はダンジョン外周から1マス内側に作ってください。" };
    }

    for (let y = rect.minY; y <= rect.maxY; y++) {
      for (let x = rect.minX; x <= rect.maxX; x++) {
        if (!isRoomPerimeter(rect, x, y)) continue;
        if (samePoint(state.entrance, x, y) || samePoint(state.stairs, x, y)) {
          return { valid: false, message: "入口・出口に壁が重なる部屋は作れません。" };
        }
      }
    }

    const door = chooseRoomDoor(rect);
    if (!door) {
      return { valid: false, message: "外側の床につながる出入口を作れません。" };
    }

    return { valid: true, door };
  }

  function drawRoomBuildPreview() {
    if (!roomDrag || !roomDrag.active || mode !== "editor" || simulation) return;

    const rect = normalizeRoomRect(roomDrag.startTile, roomDrag.currentTile);
    const status = roomRectStatus(rect);
    const door = status.door || null;

    for (let y = rect.minY; y <= rect.maxY; y++) {
      for (let x = rect.minX; x <= rect.maxX; x++) {
        const isDoor = door && door.x === x && door.y === y;
        const tileType = isRoomPerimeter(rect, x, y) && !isDoor ? "wall" : "floor";
        drawTile(x, y, tileType);
      }
    }

    ctx.strokeStyle = status.valid ? GB_COLORS.dark : GB_COLORS.light;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      rect.minX * TILE + 0.5,
      HUD_H + rect.minY * TILE + 0.5,
      rect.width * TILE - 1,
      rect.height * TILE - 1
    );
  }

  function updateRoomDragHelp() {
    if (!roomDrag) return;
    const rect = normalizeRoomRect(roomDrag.startTile, roomDrag.currentTile);
    const innerWidth = Math.max(0, rect.width - 2);
    const innerHeight = Math.max(0, rect.height - 2);
    const innerArea = innerWidth * innerHeight;
    screenHelp.textContent = `部屋 ${rect.width}×${rect.height} / 床 ${innerArea}マス。指を離して確定。`;
  }

  function commitRoomDrag(start, end) {
    if (!start || !end || simulation) return false;

    const rect = normalizeRoomRect(start, end);
    const status = roomRectStatus(rect);

    if (!status.valid) {
      screenHelp.textContent = status.message;
      addMessage(status.message, "warning", true);
      drawDungeon();
      return false;
    }

    const previousTiles = state.tiles.map((row) => [...row]);
    const wallKeys = new Set();

    for (let y = rect.minY; y <= rect.maxY; y++) {
      for (let x = rect.minX; x <= rect.maxX; x++) {
        const isDoor = status.door.x === x && status.door.y === y;
        if (isRoomPerimeter(rect, x, y) && !isDoor) {
          state.tiles[y][x] = "wall";
          wallKeys.add(roomTileKey(x, y));
        } else {
          state.tiles[y][x] = "floor";
        }
      }
    }

    if (!hasEntranceToExitPath()) {
      state.tiles = previousTiles;
      const text = "入口から出口への経路を塞ぐため、この部屋は作れません。";
      screenHelp.textContent = text;
      addMessage(text, "warning", true);
      drawDungeon();
      return false;
    }

    state.monsters = state.monsters.filter((monster) => !wallKeys.has(roomTileKey(monster.x, monster.y)));
    state.spawners = state.spawners.filter((source) => !wallKeys.has(roomTileKey(source.x, source.y)));
    state.traps = state.traps.filter((trap) => !wallKeys.has(roomTileKey(trap.x, trap.y)));

    updateCounts();
    analyzeRooms();
    drawDungeon();

    const innerArea = (rect.width - 2) * (rect.height - 2);
    const sizeLabel = roomSizeLabel(innerArea);
    const capacity = ROOM_CAPACITY[sizeLabel] || 0;
    screenHelp.textContent = `${sizeLabel}を作りました。床 ${innerArea}マス / 容量 ${capacity}。`;
    return true;
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

  function roomTileKey(x, y) {
    return `${x},${y}`;
  }

  function isFloorTile(x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS && state.tiles[y][x] === "floor";
  }

  function isRoomCoreTile(x, y) {
    if (!isFloorTile(x, y)) return false;

    for (let oy = -1; oy <= 0; oy++) {
      for (let ox = -1; ox <= 0; ox++) {
        const x0 = x + ox;
        const y0 = y + oy;
        if (
          isFloorTile(x0, y0) &&
          isFloorTile(x0 + 1, y0) &&
          isFloorTile(x0, y0 + 1) &&
          isFloorTile(x0 + 1, y0 + 1)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  function roomSizeLabel(area) {
    if (area <= 15) return "小部屋";
    if (area <= 35) return "中部屋";
    return "大部屋";
  }

  function roomAttributeForTiles(tileSet) {
    const monsters = state.monsters.filter((monster) => tileSet.has(roomTileKey(monster.x, monster.y))).length;
    const traps = state.traps.filter((trap) => tileSet.has(roomTileKey(trap.x, trap.y))).length;

    if (monsters >= 1 && traps >= 2) return "警備室";
    if (traps >= 3) return "罠部屋";
    if (monsters >= 2) return "魔物部屋";
    return "空き部屋";
  }

  function detectRooms() {
    const core = Array.from({ length: ROWS }, (_, y) =>
      Array.from({ length: COLS }, (_, x) => isRoomCoreTile(x, y))
    );
    const visited = new Set();
    const rooms = [];

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!core[y][x]) continue;
        const startKey = roomTileKey(x, y);
        if (visited.has(startKey)) continue;

        const queue = [{ x, y }];
        const tiles = [];
        visited.add(startKey);

        for (let index = 0; index < queue.length; index++) {
          const current = queue[index];
          tiles.push(current);

          for (const dir of DIRS) {
            const nx = current.x + dir.x;
            const ny = current.y + dir.y;
            if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS || !core[ny][nx]) continue;
            const key = roomTileKey(nx, ny);
            if (visited.has(key)) continue;
            visited.add(key);
            queue.push({ x: nx, y: ny });
          }
        }

        if (tiles.length < 4) continue;

        const tileSet = new Set(tiles.map((tile) => roomTileKey(tile.x, tile.y)));
        const xs = tiles.map((tile) => tile.x);
        const ys = tiles.map((tile) => tile.y);
        rooms.push({
          tiles,
          tileSet,
          area: tiles.length,
          sizeLabel: roomSizeLabel(tiles.length),
          attribute: roomAttributeForTiles(tileSet),
          bounds: {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
          },
        });
      }
    }

    return rooms;
  }

  function roomIntersectionCount(roomA, roomB) {
    let count = 0;
    const smaller = roomA.tileSet.size <= roomB.tileSet.size ? roomA.tileSet : roomB.tileSet;
    const larger = smaller === roomA.tileSet ? roomB.tileSet : roomA.tileSet;
    for (const key of smaller) {
      if (larger.has(key)) count += 1;
    }
    return count;
  }

  function triggerRoomEffect(room) {
    roomEffects.push({
      tiles: room.tiles.map((tile) => ({ ...tile })),
      bounds: { ...room.bounds },
      startedAt: performance.now(),
      duration: 1300,
    });
  }

  function announceRoom(room, prefix = "完成") {
    addMessage(`${room.sizeLabel}「${room.attribute}」が${prefix}しました。`, "room");
    triggerRoomEffect(room);
  }

  function analyzeRooms({ announce = true } = {}) {
    const currentRooms = detectRooms();
    const unmatchedPrevious = new Set(roomSnapshot.map((_, index) => index));
    const matches = new Map();

    const currentByArea = currentRooms
      .map((room, index) => ({ room, index }))
      .sort((a, b) => b.room.area - a.room.area);

    for (const { room, index } of currentByArea) {
      let bestIndex = -1;
      let bestScore = 0;

      for (const previousIndex of unmatchedPrevious) {
        const previous = roomSnapshot[previousIndex];
        const intersection = roomIntersectionCount(room, previous);
        if (intersection === 0) continue;
        const currentRatio = intersection / room.area;
        const previousRatio = intersection / previous.area;
        const score = Math.min(currentRatio, previousRatio);

        if (currentRatio >= 0.55 && previousRatio >= 0.35 && score > bestScore) {
          bestScore = score;
          bestIndex = previousIndex;
        }
      }

      if (bestIndex >= 0) {
        matches.set(index, bestIndex);
        unmatchedPrevious.delete(bestIndex);
      }
    }

    if (announce) {
      currentRooms.forEach((room, index) => {
        const previousIndex = matches.get(index);
        if (previousIndex === undefined) {
          announceRoom(room);
          return;
        }

        const previous = roomSnapshot[previousIndex];
        if (previous.sizeLabel !== room.sizeLabel) {
          addMessage(`部屋の広さが「${room.sizeLabel}」に変わりました。`, "room");
          triggerRoomEffect(room);
        }
        if (previous.attribute !== room.attribute) {
          addMessage(`${room.sizeLabel}の属性が「${room.attribute}」に変わりました。`, "room");
          triggerRoomEffect(room);
        }
      });

      if (unmatchedPrevious.size > 0 && currentRooms.length < roomSnapshot.length) {
        addMessage("部屋のつながりが変化しました。", "info", true);
      }
    }

    roomSnapshot = currentRooms.map((room) => ({
      ...room,
      tiles: room.tiles.map((tile) => ({ ...tile })),
      tileSet: new Set(room.tileSet),
      bounds: { ...room.bounds },
    }));

    return currentRooms;
  }

  function drawRoomEffects(now) {
    for (const effect of roomEffects) {
      const elapsed = now - effect.startedAt;
      if (elapsed < 0 || elapsed > effect.duration) continue;

      // 高速反転は避け、約1.3秒の中で2回だけ輪郭を強調する。
      const pulseVisible =
        elapsed < 320 ||
        (elapsed >= 650 && elapsed < 970);
      if (!pulseVisible) continue;

      const tileSet = new Set(effect.tiles.map((tile) => roomTileKey(tile.x, tile.y)));
      ctx.fillStyle = GB_COLORS.dark;
      ctx.lineWidth = 1;

      for (const tile of effect.tiles) {
        const px = tile.x * TILE;
        const py = HUD_H + tile.y * TILE;

        if (!tileSet.has(roomTileKey(tile.x, tile.y - 1))) ctx.fillRect(px, py, TILE, 1);
        if (!tileSet.has(roomTileKey(tile.x, tile.y + 1))) ctx.fillRect(px, py + TILE - 1, TILE, 1);
        if (!tileSet.has(roomTileKey(tile.x - 1, tile.y))) ctx.fillRect(px, py, 1, TILE);
        if (!tileSet.has(roomTileKey(tile.x + 1, tile.y))) ctx.fillRect(px + TILE - 1, py, 1, TILE);
      }

      const centerX = Math.floor(((effect.bounds.minX + effect.bounds.maxX + 1) * TILE) / 2);
      const centerY = HUD_H + Math.floor(((effect.bounds.minY + effect.bounds.maxY + 1) * TILE) / 2) - 3;
      if (effect.bounds.maxX - effect.bounds.minX >= 3 && effect.bounds.maxY - effect.bounds.minY >= 1) {
        pixelText("ROOM", centerX, centerY, 1, GB_COLORS.dark, "center");
      }
    }
  }

  function removeMonsterAndTrapAt(x, y) {
    state.monsters = state.monsters.filter((m) => !(m.x === x && m.y === y));
    state.spawners = state.spawners.filter((source) => !(source.x === x && source.y === y));
    state.traps = state.traps.filter((t) => !(t.x === x && t.y === y));
  }

  function removePlacedAt(x, y) {
    if (simulation) return false;

    const monsterBefore = state.monsters.length;
    const spawnerBefore = state.spawners.length;
    const trapBefore = state.traps.length;
    removeMonsterAndTrapAt(x, y);

    let removed =
      state.monsters.length !== monsterBefore ||
      state.spawners.length !== spawnerBefore ||
      state.traps.length !== trapBefore;

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
    analyzeRooms();
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
    const text = "入口から出口への通路が塞がるため、その配置はできません。";
    screenHelp.textContent = text;
    addMessage(text, "warning", true);
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

    if (selectedTool === "room") {
      screenHelp.textContent = "部屋ツールはドラッグして範囲を指定してください。";
      return;
    }

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
      removeMonsterAndTrapAt(x, y);
      state.traps.push({ x, y, type: "spike" });
    } else if (SPAWNER_DEFS[selectedTool]) {
      if (state.tiles[y][x] !== "floor") return;
      const room = roomForTile(x, y);
      if (!room) {
        screenHelp.textContent = "出現アイテムは部屋の中に置いてください。";
        addMessage("出現アイテムは部屋の中でのみ機能します。", "warning", true);
        return;
      }
      removeMonsterAndTrapAt(x, y);
      state.spawners.push({
        id: nextSpawnerId++,
        type: selectedTool,
        x,
        y,
        lastSpawnAt: 0,
      });
      const capacity = ROOM_CAPACITY[room.sizeLabel] || 0;
      screenHelp.textContent = `${SPAWNER_DEFS[selectedTool].name}を設置。部屋容量 ${capacity}。`;
    }

    enforceValidDungeonRoute();
    updateCounts();
    analyzeRooms();
    drawDungeon();
  }

  function roomForTile(x, y, rooms = detectRooms()) {
    const key = roomTileKey(x, y);
    return rooms.find((room) => room.tileSet.has(key)) || null;
  }

  function spawnerById(id) {
    return state.spawners.find((source) => source.id === id) || null;
  }

  function homeRoomForMonster(monster, rooms) {
    const source = spawnerById(monster.sourceId);
    if (source) return roomForTile(source.x, source.y, rooms);
    return roomForTile(monster.x, monster.y, rooms);
  }

  function monsterSizeCost(monster) {
    const def = MONSTER_DEFS[monster.type];
    return MONSTER_SIZE_COST[def?.size] || 1;
  }

  function roomCapacityUsed(room) {
    const sourceIds = new Set(
      state.spawners
        .filter((source) => room.tileSet.has(roomTileKey(source.x, source.y)))
        .map((source) => source.id)
    );

    return state.monsters.reduce((total, monster) => {
      if (monster.sourceId && sourceIds.has(monster.sourceId)) {
        return total + monsterSizeCost(monster);
      }
      if (!monster.sourceId && room.tileSet.has(roomTileKey(monster.x, monster.y))) {
        return total + monsterSizeCost(monster);
      }
      return total;
    }, 0);
  }

  function randomLevel([min, max]) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function spawnCandidates(room, source, occupied) {
    const blockedBySource = new Set(state.spawners.map((item) => roomTileKey(item.x, item.y)));
    return room.tiles
      .filter((tile) => {
        const key = roomTileKey(tile.x, tile.y);
        return (
          !occupied.has(key) &&
          !blockedBySource.has(key) &&
          !samePoint(state.entrance, tile.x, tile.y) &&
          !samePoint(state.stairs, tile.x, tile.y)
        );
      })
      .sort((a, b) =>
        (Math.abs(a.x - source.x) + Math.abs(a.y - source.y)) -
        (Math.abs(b.x - source.x) + Math.abs(b.y - source.y))
      );
  }

  function spawnFromSource(source, now, rooms, occupied) {
    const sourceDef = SPAWNER_DEFS[source.type];
    if (!sourceDef) return false;
    if (source.lastSpawnAt && now - source.lastSpawnAt < sourceDef.intervalMs) return false;

    const room = roomForTile(source.x, source.y, rooms);
    if (!room) return false;

    const monsterDef = MONSTER_DEFS[sourceDef.monsterType];
    if (!monsterDef) return false;

    const activeFromSource = state.monsters.filter((monster) => monster.sourceId === source.id).length;
    const sourceRemaining = sourceDef.activeLimit - activeFromSource;
    const roomCapacity = ROOM_CAPACITY[room.sizeLabel] || 0;
    const capacityRemaining = Math.max(0, roomCapacity - roomCapacityUsed(room));
    const maxByCapacity = Math.floor(capacityRemaining / (MONSTER_SIZE_COST[monsterDef.size] || 1));
    const candidates = spawnCandidates(room, source, occupied);
    const count = Math.min(sourceDef.batchSize, sourceRemaining, maxByCapacity, candidates.length);

    if (count <= 0) return false;

    for (let i = 0; i < count; i++) {
      const tile = candidates[i];
      const monster = {
        id: nextMonsterId++,
        type: sourceDef.monsterType,
        level: randomLevel(monsterDef.levelRange),
        x: tile.x,
        y: tile.y,
        dir: (source.id + i) % 4,
        steps: 0,
        moveClock: 0,
        sourceId: source.id,
      };
      state.monsters.push(monster);
      occupied.add(roomTileKey(tile.x, tile.y));
      discoverMonster(monster.type);
    }

    source.lastSpawnAt = now;
    updateCounts();
    addMessage(`${sourceDef.name}から${monsterDef.name}が${count}体出現しました。`, "info", true);
    return true;
  }

  function processSpawns(now) {
    const rooms = detectRooms();
    const occupied = new Set(state.monsters.map((monster) => roomTileKey(monster.x, monster.y)));
    let spawned = false;
    for (const source of state.spawners) {
      if (spawnFromSource(source, now, rooms, occupied)) spawned = true;
    }
    return spawned;
  }

  function canMoveTo(monster, x, y, occupied, homeRoom) {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
    if (state.tiles[y][x] !== "floor") return false;
    if (state.spawners.some((source) => source.x === x && source.y === y)) return false;

    const def = MONSTER_DEFS[monster.type] || MONSTER_DEFS.slime;
    const key = roomTileKey(x, y);
    if (def.movement.territory === "room_locked" && homeRoom && !homeRoom.tileSet.has(key)) return false;

    return !occupied.has(key) || (monster.x === x && monster.y === y);
  }

  function moveMonster(monster, occupied, rooms) {
    occupied.delete(roomTileKey(monster.x, monster.y));

    const def = MONSTER_DEFS[monster.type] || MONSTER_DEFS.slime;
    monster.moveClock = (monster.moveClock || 0) + 1;
    if (monster.moveClock % (def.movement.moveEvery || 1) !== 0) {
      occupied.add(roomTileKey(monster.x, monster.y));
      return;
    }

    const homeRoom = homeRoomForMonster(monster, rooms);
    const source = spawnerById(monster.sourceId);
    let tryDirs = [monster.dir, (monster.dir + 1) % 4, (monster.dir + 3) % 4, (monster.dir + 2) % 4];

    if (def.movement.territory === "room_preferred" && homeRoom) {
      const currentlyInside = homeRoom.tileSet.has(roomTileKey(monster.x, monster.y));
      if (currentlyInside && monster.moveClock % 4 !== 0) {
        const insideDirs = tryDirs.filter((dir) => {
          const nx = monster.x + DIRS[dir].x;
          const ny = monster.y + DIRS[dir].y;
          return homeRoom.tileSet.has(roomTileKey(nx, ny));
        });
        if (insideDirs.length > 0) tryDirs = insideDirs;
      } else if (!currentlyInside && source) {
        tryDirs.sort((a, b) => {
          const ax = monster.x + DIRS[a].x;
          const ay = monster.y + DIRS[a].y;
          const bx = monster.x + DIRS[b].x;
          const by = monster.y + DIRS[b].y;
          return (Math.abs(ax - source.x) + Math.abs(ay - source.y)) -
            (Math.abs(bx - source.x) + Math.abs(by - source.y));
        });
      }
    }

    for (const dir of tryDirs) {
      const nx = monster.x + DIRS[dir].x;
      const ny = monster.y + DIRS[dir].y;
      if (!canMoveTo(monster, nx, ny, occupied, homeRoom)) continue;
      monster.x = nx;
      monster.y = ny;
      monster.dir = dir;
      monster.steps = (monster.steps || 0) + 1;
      break;
    }

    occupied.add(roomTileKey(monster.x, monster.y));
  }

  function simulateStep(now) {
    const spawned = processSpawns(now);
    const rooms = detectRooms();
    const occupied = new Set(state.monsters.map((monster) => roomTileKey(monster.x, monster.y)));
    [...state.monsters]
      .sort((a, b) => a.id - b.id)
      .forEach((monster) => moveMonster(monster, occupied, rooms));
    return spawned;
  }

  function loop(now) {
    let redraw = false;

    if (mode === "editor" && simulation && now - lastStepAt >= 420) {
      simulateStep(now);
      lastStepAt = now;
      redraw = true;
    }

    if (roomEffects.length > 0) {
      roomEffects = roomEffects.filter((effect) => now - effect.startedAt <= effect.duration);
      redraw = true;
    }

    if (redraw) drawDungeon();
    requestAnimationFrame(loop);
  }

  function saveSlotKey(slot) {
    return `${SAVE_SLOT_PREFIX}${slot}`;
  }

  function isValidDungeonData(data) {
    return Boolean(
      data &&
      (data.version === 2 || data.version === 3) &&
      data.cols === COLS &&
      data.rows === ROWS &&
      Array.isArray(data.tiles) &&
      data.tiles.length === ROWS &&
      data.tiles.every((row) => Array.isArray(row) && row.length === COLS)
    );
  }

  function readSaveSlot(slot) {
    try {
      const raw = localStorage.getItem(saveSlotKey(slot));
      if (!raw) return null;
      const data = JSON.parse(raw);
      return isValidDungeonData(data) ? data : null;
    } catch {
      return null;
    }
  }

  function createSaveData() {
    return {
      version: 3,
      savedAt: new Date().toISOString(),
      cols: COLS,
      rows: ROWS,
      tiles: state.tiles,
      monsters: state.monsters,
      spawners: state.spawners.map((source) => ({ ...source, lastSpawnAt: 0 })),
      traps: state.traps,
      entrance: state.entrance,
      stairs: state.stairs,
      nextMonsterId,
      nextSpawnerId,
      roomCount: detectRooms().length,
    };
  }

  function formatSaveTime(value) {
    if (!value) return "旧セーブデータ";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "保存日時不明";

    return new Intl.DateTimeFormat("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function renderSaveSlots() {
    if (!saveSlotList) return;

    for (let slot = 1; slot <= SAVE_SLOT_COUNT; slot++) {
      const element = saveSlotList.querySelector(`.save-slot[data-slot="${slot}"]`);
      if (!element) continue;

      const data = readSaveSlot(slot);
      const title = element.querySelector(".save-slot-title");
      const meta = element.querySelector(".save-slot-meta");
      const action = element.querySelector('[data-save-action="slot"]');
      const deleteButton = element.querySelector('[data-save-action="delete"]');

      element.classList.toggle("save-slot--filled", Boolean(data));

      if (!data) {
        title.textContent = "空きスロット";
        meta.textContent = "データなし";
        action.textContent = savePanelMode === "save" ? "セーブ" : "空き";
        action.disabled = savePanelMode === "load";
        deleteButton.classList.add("hidden");
        continue;
      }

      const monsters = Array.isArray(data.monsters) ? data.monsters.length : 0;
      const traps = Array.isArray(data.traps) ? data.traps.length : 0;
      const roomText = Number.isInteger(data.roomCount) ? `部屋 ${data.roomCount}` : "部屋 -";

      title.textContent = `1F / ${formatSaveTime(data.savedAt)}`;
      meta.textContent = `${roomText} · 魔物 ${monsters} · 罠 ${traps}`;
      action.textContent = savePanelMode === "save" ? "上書き" : "ロード";
      action.disabled = false;
      deleteButton.classList.remove("hidden");
    }
  }

  function openSavePanel(mode) {
    savePanelMode = mode;
    savePanelTitle.textContent = mode === "save" ? "セーブ" : "ロード";
    savePanel.classList.remove("hidden");
    renderSaveSlots();
    requestAnimationFrame(() => savePanel.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function closeSavePanel() {
    savePanel.classList.add("hidden");
  }

  function saveDungeonToSlot(slot) {
    try {
      const data = createSaveData();
      localStorage.setItem(saveSlotKey(slot), JSON.stringify(data));
      renderSaveSlots();

      const text = `スロット${slot}に1Fをセーブしました。`;
      screenHelp.textContent = text;
      addMessage(text, "info");
    } catch {
      const text = "セーブに失敗しました。ブラウザの保存領域を確認してください。";
      screenHelp.textContent = text;
      addMessage(text, "warning");
    }
  }

  function applyDungeonData(data) {
    if (!isValidDungeonData(data)) throw new Error("invalid dungeon");

    state.tiles = data.tiles.map((row) => [...row]);
    state.monsters = Array.isArray(data.monsters) ? data.monsters.map((monster) => ({ moveClock: 0, ...monster })) : [];
    state.spawners = Array.isArray(data.spawners)
      ? data.spawners.map((source) => ({ ...source, lastSpawnAt: 0 }))
      : [];
    state.traps = Array.isArray(data.traps) ? data.traps.map((trap) => ({ ...trap })) : [];
    state.entrance = data.entrance ? { ...data.entrance } : null;
    state.stairs = data.stairs ? { ...data.stairs } : null;
    nextMonsterId = Number.isInteger(data.nextMonsterId) ? data.nextMonsterId : state.monsters.length + 1;
    nextSpawnerId = Number.isInteger(data.nextSpawnerId) ? data.nextSpawnerId : state.spawners.length + 1;
    state.monsters.forEach((monster) => discoverMonster(monster.type));

    if (!hasEntranceToExitPath()) {
      repairEntranceToExitPath();
    }

    simulation = false;
    updateSimulationButton();
    updateCounts();
    resetView();
    roomEffects = [];
    analyzeRooms({ announce: false });
    drawDungeon();
  }

  function loadDungeonFromSlot(slot) {
    const data = readSaveSlot(slot);
    if (!data) {
      const text = `スロット${slot}にセーブデータがありません。`;
      screenHelp.textContent = text;
      addMessage(text, "warning");
      return;
    }

    try {
      applyDungeonData(data);
      closeSavePanel();

      const text = `スロット${slot}の1Fをロードしました。`;
      screenHelp.textContent = text;
      addMessage(text, "info");
    } catch {
      const text = `スロット${slot}のセーブデータを読み込めませんでした。`;
      screenHelp.textContent = text;
      addMessage(text, "warning");
    }
  }

  function deleteSaveSlot(slot) {
    if (!readSaveSlot(slot)) return;
    if (!window.confirm(`スロット${slot}のセーブデータを削除しますか？`)) return;

    localStorage.removeItem(saveSlotKey(slot));
    renderSaveSlots();

    const text = `スロット${slot}のセーブデータを削除しました。`;
    screenHelp.textContent = text;
    addMessage(text, "warning");
  }

  function migrateLegacySave() {
    if (readSaveSlot(1)) return;

    try {
      const raw = localStorage.getItem(LEGACY_SAVE_KEY);
      if (!raw) return;

      const legacy = JSON.parse(raw);
      if (!isValidDungeonData(legacy)) return;

      const migrated = {
        ...legacy,
        version: 3,
        savedAt: new Date().toISOString(),
        roomCount: null,
      };
      localStorage.setItem(saveSlotKey(1), JSON.stringify(migrated));
    } catch {
      // 旧セーブが壊れている場合は無視する。
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
    if (selectedTool === "room") return;
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
      roomDrag = null;
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

      if (selectedTool === "room" && !simulation) {
        event.preventDefault();
        const tile = placementTileFromTouch(touch);
        if (!tile) return;

        pan = null;
        paintStroke = null;
        placementPreviewTile = null;
        roomDrag = {
          active: true,
          pointerType: "touch",
          startTile: tile,
          currentTile: tile,
        };
        updateRoomDragHelp();
        drawDungeon();
        suppressClickUntil = Date.now() + 700;
        return;
      }

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
      roomDrag = null;
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

    if (roomDrag && roomDrag.active && roomDrag.pointerType === "touch") {
      event.preventDefault();
      const tile = placementTileFromTouch(touch);
      if (tile) {
        roomDrag.currentTile = tile;
        updateRoomDragHelp();
        drawDungeon();
      }
      suppressClickUntil = Date.now() + 700;
      return;
    }

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
    const roomToCommit = roomDrag && roomDrag.active && roomDrag.pointerType === "touch"
      ? { startTile: roomDrag.startTile, currentTile: roomDrag.currentTile }
      : null;
    const didRoomDrag = Boolean(roomToCommit);
    const allowTap = Boolean(pan && pan.allowTap && !didPan && !didPaint && !didRoomDrag);
    const endedTouch = event.changedTouches[0] || null;

    clearLongPressTimer();

    if (event.touches.length < 2) pinch = null;

    if (event.touches.length === 0) {
      pan = null;
      paintStroke = null;
      roomDrag = null;
      placementPreviewTile = null;

      if (didRoomDrag) {
        commitRoomDrag(roomToCommit.startTile, roomToCommit.currentTile);
        suppressClickUntil = Date.now() + 700;
      } else if (didPaint) {
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
    roomDrag = null;
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

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleEditorMenu();
  });

  editorMenu.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  openHistoryButton.addEventListener("click", openHistoryPanel);
  closeHistoryButton.addEventListener("click", closeHistoryPanel);
  openDexButton.addEventListener("click", openDexPanel);
  closeDexButton.addEventListener("click", closeDexPanel);

  historyPanel.addEventListener("click", (event) => {
    if (event.target === historyPanel) closeHistoryPanel();
  });

  dexPanel.addEventListener("click", (event) => {
    if (event.target === dexPanel) closeDexPanel();
  });

  document.addEventListener("click", closeEditorMenu);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!dexPanel.classList.contains("hidden")) {
      closeDexPanel();
      return;
    }
    if (!historyPanel.classList.contains("hidden")) {
      closeHistoryPanel();
      return;
    }
    closeEditorMenu();
  });

  toolButtons.forEach((button) => {
    button.addEventListener("click", () => setTool(button.dataset.tool));
  });

  canvas.addEventListener("mousedown", (event) => {
    if (mode !== "editor" || simulation || selectedTool !== "room" || event.button !== 0) return;

    const tile = canvasToTile(event);
    if (!tile) return;

    event.preventDefault();
    roomDrag = {
      active: true,
      pointerType: "mouse",
      startTile: tile,
      currentTile: tile,
    };
    placementPreviewTile = null;
    updateRoomDragHelp();
    drawDungeon();
    suppressClickUntil = Date.now() + 700;
  });

  canvas.addEventListener("mousemove", (event) => {
    if (!roomDrag || !roomDrag.active || roomDrag.pointerType !== "mouse") return;
    const tile = canvasToTile(event);
    if (!tile) return;

    roomDrag.currentTile = tile;
    updateRoomDragHelp();
    drawDungeon();
    suppressClickUntil = Date.now() + 700;
  });

  window.addEventListener("mouseup", (event) => {
    if (!roomDrag || !roomDrag.active || roomDrag.pointerType !== "mouse" || event.button !== 0) return;

    const roomToCommit = {
      startTile: roomDrag.startTile,
      currentTile: roomDrag.currentTile,
    };
    roomDrag = null;
    commitRoomDrag(roomToCommit.startTile, roomToCommit.currentTile);
    suppressClickUntil = Date.now() + 700;
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
      ? "出現アイテムが起動。部屋容量とサイズに応じてモンスターが発生・移動します。"
      : "徘徊テストを停止しました。";
    addMessage(simulation ? "徘徊テストを開始しました。" : "徘徊テストを停止しました。", "info");
  });

  resetButton.addEventListener("click", () => {
    simulation = false;
    updateSimulationButton();
    makeInitialDungeon();
    resetView();
    analyzeRooms({ announce: false });
    roomEffects = [];
    drawDungeon();
    screenHelp.textContent = "1Fを初期状態に戻しました。";
    addMessage("1Fを初期状態に戻しました。", "warning");
  });

  saveButton.addEventListener("click", () => openSavePanel("save"));
  loadButton.addEventListener("click", () => openSavePanel("load"));
  closeSavePanelButton.addEventListener("click", closeSavePanel);

  saveSlotList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-save-action]");
    if (!button) return;

    const slot = Number(button.dataset.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > SAVE_SLOT_COUNT) return;

    if (button.dataset.saveAction === "delete") {
      deleteSaveSlot(slot);
      return;
    }

    if (savePanelMode === "save") {
      saveDungeonToSlot(slot);
    } else {
      loadDungeonFromSlot(slot);
    }
  });

  zoomResetButton.addEventListener("click", resetView);

  window.addEventListener("resize", () => {
    clampView();
    applyViewTransform();
  });

  makeInitialDungeon();
  migrateLegacySave();
  loadDexDiscovery();
  renderDex();
  renderSaveSlots();
  setTool("floor");
  setMode("start");
  requestAnimationFrame(loop);

  window.LivingWarBattleTheme = Object.freeze({
    width: 160,
    height: 144,
    colors: Object.freeze(GB_COLORS),
  });
})();
