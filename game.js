/* ============================================================
   Math Crossword — game logic & UI
   Depends on generator.js (window.MathCrosswordGenerator)
   ============================================================ */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const G = window.MathCrosswordGenerator;

  const SAVE_KEY = "math-crossword-progress-v1";

  const boardEl = $("board");
  const trayEl = $("tray");
  const trayCountEl = $("trayCount");
  const levelVal = $("levelVal");
  const scoreVal = $("scoreVal");
  const timeVal = $("timeVal");
  const confettiEl = $("confetti");

  const state = {
    level: 1,
    score: 0,
    sound: true,
    puzzle: null,
    tileById: new Map(),
    placement: new Map(), // "r:c" -> tileId
    tileCell: new Map(),  // tileId -> "r:c"
    selectedTileId: null,
    hintsUsed: 0,
    mistakes: 0,
    elapsed: 0,
    timerId: null,
    won: false,
    cursor: null, // {r, c} for keyboard
  };

  const key = (r, c) => r + ":" + c;

  /* ---------------- persistence ---------------- */

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.level) state.level = Math.max(1, +s.level || 1);
      if (s.score) state.score = +s.score || 0;
      if (typeof s.sound === "boolean") state.sound = s.sound;
    } catch (_) { /* ignore */ }
  }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        level: state.level,
        score: state.score,
        sound: state.sound,
      }));
    } catch (_) { /* ignore */ }
  }

  /* ---------------- puzzle setup ---------------- */

  function newPuzzle(level) {
    const cfg = G.difficultyForLevel(level);
    let puzzle = null;
    for (let i = 0; i < 10 && !puzzle; i++) puzzle = G.generate(cfg);
    if (!puzzle) {
      // Last resort: a trivial easy puzzle
      puzzle = G.generate({ S: 5, ops: ["+", "-"], maxN: 5, maxRes: 10, givens: 4 });
    }
    state.puzzle = puzzle;
    state.tileById = new Map(puzzle.tiles.map((t) => [t.id, t]));
    state.placement.clear();
    state.tileCell.clear();
    state.selectedTileId = null;
    state.hintsUsed = 0;
    state.mistakes = 0;
    state.won = false;
    state.cursor = null;
    startTimer();
    renderBoard();
    renderTray();
    updateCounts();
    updateStats();
  }

  function renderBoard() {
    const p = state.puzzle;
    boardEl.style.gridTemplateColumns = `repeat(${p.S}, 1fr)`;
    boardEl.style.setProperty("--cell-font", ((100 / p.S) * 0.5).toFixed(2) + "cqw");
    boardEl.innerHTML = "";

    for (let r = 0; r < p.S; r++) {
      for (let c = 0; c < p.S; c++) {
        const t = p.layout[r][c];
        const cell = document.createElement("div");
        cell.className = "cell cell--" + t;
        if (t === "num") {
          cell.dataset.r = r;
          cell.dataset.c = c;
          cell.setAttribute("role", "gridcell");
          if (p.given[r][c]) {
            cell.classList.add("given");
            cell.textContent = p.values[r][c];
          }
        } else if (t === "op") {
          cell.textContent = p.opSymbols[r][c];
        } else if (t === "eq") {
          cell.textContent = "=";
        }
        boardEl.appendChild(cell);
      }
    }
  }

  function renderTray() {
    const p = state.puzzle;
    const remaining = p.tiles.filter((t) => !state.tileCell.has(t.id));
    trayEl.innerHTML = "";
    trayEl.classList.toggle("empty", remaining.length === 0);

    for (const tile of remaining) {
      const chip = document.createElement("div");
      chip.className = "tile" + (state.selectedTileId === tile.id ? " selected" : "");
      chip.textContent = tile.value;
      chip.dataset.tileId = tile.id;
      trayEl.appendChild(chip);
    }
    trayCountEl.textContent = remaining.length ? remaining.length + " left" : "Done!";
  }

  /* ---------------- cell helpers ---------------- */

  function valueAt(r, c) {
    const p = state.puzzle;
    if (p.given[r][c]) return p.values[r][c];
    const id = state.placement.get(key(r, c));
    return id == null ? null : state.tileById.get(id).value;
  }

  function blankCellKeys(p) {
    const out = [];
    for (let r = 0; r < p.S; r++) {
      for (let c = 0; c < p.S; c++) {
        if (p.layout[r][c] === "num" && !p.given[r][c]) out.push(key(r, c));
      }
    }
    return out;
  }

  function refreshCell(r, c) {
    const p = state.puzzle;
    if (p.layout[r][c] !== "num") return;
    const cell = boardEl.querySelector(`.cell--num[data-r="${r}"][data-c="${c}"]`);
    if (!cell) return;
    const placed = state.placement.has(key(r, c));
    cell.classList.toggle("filled", placed && !p.given[r][c]);
    if (!p.given[r][c]) {
      cell.textContent = placed ? valueAt(r, c) : "";
    }
  }

  function updateCounts() {
    const p = state.puzzle;
    if (!p) return;
    const total = blankCellKeys(p).length;
    const done = state.placement.size;
    trayCountEl.textContent = done < total ? total - done + " left" : "Done!";
  }

  function updateStats() {
    levelVal.textContent = state.level;
    scoreVal.textContent = state.score;
  }

  /* ---------------- moves ---------------- */

  function place(tileId, r, c) {
    const p = state.puzzle;
    if (state.won || p.given[r][c]) return;
    const where = key(r, c);

    // A different tile already sits here: return it to the tray.
    const prev = state.placement.get(where);
    if (prev !== undefined && prev !== tileId) {
      state.tileCell.delete(prev);
      state.placement.delete(where);
    }
    state.placement.set(where, tileId);
    state.tileCell.set(tileId, where);

    if (state.selectedTileId === tileId) state.selectedTileId = null;

    refreshCell(r, c);
    renderTray();
    updateCounts();
    playPlace();
  }

  function removeFromCell(r, c) {
    const where = key(r, c);
    const tileId = state.placement.get(where);
    if (tileId === undefined) return;
    state.placement.delete(where);
    state.tileCell.delete(tileId);
    refreshCell(r, c);
    renderTray();
    updateCounts();
  }

  function pickupFromCell(r, c) {
    if (state.won) return;
    const where = key(r, c);
    const tileId = state.placement.get(where);
    if (tileId === undefined) return;
    state.selectedTileId = tileId;
    removeFromCell(r, c);
    renderTray();
    playPickup();
  }

  function toggleSelect(tileId) {
    if (state.selectedTileId === tileId) state.selectedTileId = null;
    else state.selectedTileId = tileId;
    renderTray();
    playSelect();
  }

  /* ---------------- validation & win ---------------- */

  function allSolved() {
    const p = state.puzzle;
    const results = G.evaluate(p, valueAt);
    const complete = results.every((res) => res.complete && res.correct);
    const allFilled = blankCellKeys(p).every((k) => state.placement.has(k));
    return complete && allFilled;
  }

  function checkAnswers() {
    const p = state.puzzle;
    if (state.won) return;
    const results = G.evaluate(p, valueAt);
    const wrong = results.filter((res) => res.complete && !res.correct);
    const incomplete = results.filter((res) => !res.complete);

    if (wrong.length === 0 && incomplete.length === 0) {
      finishLevel();
      return;
    }

    const wrongCells = new Set();
    for (const res of wrong) {
      for (const [r, c] of res.eq.numCells) wrongCells.add(key(r, c));
    }

    let flashed = 0;
    boardEl.querySelectorAll(".cell--num.filled").forEach((cell) => {
      if (wrongCells.has(key(+cell.dataset.r, +cell.dataset.c))) {
        cell.classList.add("is-wrong");
        flashed++;
      }
    });

    if (flashed) state.mistakes += flashed;
    playError();

    showToast(
      flashed
        ? `${flashed} number${flashed > 1 ? "s are" : " is"} in the wrong spot`
        : "All filled equations check out — keep going!"
    );

    clearTimeout(state._flashTimer);
    state._flashTimer = setTimeout(() => {
      boardEl.querySelectorAll(".is-wrong").forEach((c) => c.classList.remove("is-wrong"));
    }, 650);
  }

  function afterMove() {
    if (state.won) return;
    if (state.placement.size === blankCellKeys(state.puzzle).length && allSolved()) {
      finishLevel();
    }
  }

  function finishLevel() {
    state.won = true;
    stopTimer();
    playWin();

    const points =
      50 +
      10 * state.level +
      Math.max(0, 150 - state.elapsed) +
      (state.hintsUsed === 0 ? 30 : 0) +
      (state.mistakes === 0 ? 20 : 0);
    state.score += points;
    save();

    showWinModal(points);
    updateStats();
    launchConfetti();
  }

  /* ---------------- hint ---------------- */

  function useHint() {
    const p = state.puzzle;
    if (state.won || !p) return;

    const blanks = blankCellKeys(p).filter((k) => !state.placement.has(k));
    if (!blanks.length) { showToast("The board is full — use Check!"); return; }

    const trayValues = new Set(
      p.tiles.filter((t) => !state.tileCell.has(t.id)).map((t) => t.value)
    );

    // Prefer a blank whose correct value is still in the tray.
    let target = blanks.find((k) => {
      const [r, c] = k.split(":").map(Number);
      return trayValues.has(p.values[r][c]);
    });

    if (target === undefined) {
      // Its correct tile is placed somewhere wrong — relocate it.
      target = blanks[0];
      const [tr, tc] = target.split(":").map(Number);
      const v = p.values[tr][tc];
      let movingTile = null;
      for (const [tileId, cellKey] of state.tileCell) {
        if (state.tileById.get(tileId).value === v) { movingTile = tileId; break; }
      }
      if (movingTile !== null) {
        const [mr, mc] = state.tileCell.get(movingTile).split(":").map(Number);
        removeFromCell(mr, mc);
        place(movingTile, tr, tc);
        state.hintsUsed++;
        showToast("Hint: moved a number into place!");
        playHint();
        afterMove();
        return;
      }
      showToast("Nothing to hint right now.");
      return;
    }

    const [r, c] = target.split(":").map(Number);
    const v = p.values[r][c];
    const tile = p.tiles.find((t) => t.value === v && !state.tileCell.has(t.id));
    if (tile) {
      place(tile.id, r, c);
      state.hintsUsed++;
      showToast("Hint used!");
      playHint();
      afterMove();
    }
  }

  /* ---------------- timer ---------------- */

  function startTimer() {
    stopTimer();
    state.elapsed = 0;
    timeVal.textContent = "0:00";
    state.timerId = setInterval(() => {
      state.elapsed++;
      const m = Math.floor(state.elapsed / 60);
      const s = state.elapsed % 60;
      timeVal.textContent = m + ":" + String(s).padStart(2, "0");
    }, 1000);
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  /* ---------------- win modal ---------------- */

  function showWinModal(points) {
    const m = Math.floor(state.elapsed / 60);
    const s = state.elapsed % 60;
    const timeStr = m + ":" + String(s).padStart(2, "0");
    $("winStats").innerHTML = `
      <span class="stat-chip"><b>${points}</b>score</span>
      <span class="stat-chip"><b>${timeStr}</b>time</span>
      <span class="stat-chip"><b>${state.hintsUsed}</b>hints</span>
      <span class="stat-chip"><b>${state.mistakes}</b>mistakes</span>
    `;
    $("winModal").hidden = false;
  }

  /* ---------------- toast ---------------- */

  let toastTimer = null;
  function showToast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  /* ---------------- sound ---------------- */

  let audioCtx = null;
  function ctx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    return audioCtx;
  }
  function tone(freq, dur, type, gain, when) {
    if (!state.sound) return;
    const ac = ctx();
    if (!ac) return;
    try {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type || "sine";
      osc.frequency.value = freq;
      const t0 = ac.currentTime + (when || 0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain || 0.18, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (_) { /* ignore */ }
  }
  function playPlace() { tone(520, 0.09, "triangle", 0.15); }
  function playPickup() { tone(360, 0.07, "triangle", 0.12); }
  function playSelect() { tone(430, 0.06, "square", 0.05); }
  function playHint() { tone(660, 0.12, "sine", 0.14); tone(880, 0.12, "sine", 0.12, 0.08); }
  function playError() { tone(220, 0.16, "sawtooth", 0.12); tone(170, 0.2, "sawtooth", 0.1, 0.05); }
  function playWin() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, "triangle", 0.16, i * 0.09));
  }

  /* ---------------- confetti ---------------- */

  function launchConfetti() {
    const cv = confettiEl;
    const cx = cv.getContext("2d");
    cv.width = window.innerWidth;
    cv.height = window.innerHeight;
    cv.classList.add("on");
    const colors = ["#ffb703", "#7c3aed", "#2563eb", "#00b8d9", "#16a34a", "#e11d48", "#ffd166"];
    const parts = [];
    for (let i = 0; i < 160; i++) {
      parts.push({
        x: Math.random() * cv.width,
        y: -20 - Math.random() * cv.height * 0.4,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        vy: 2.5 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        color: colors[(Math.random() * colors.length) | 0],
      });
    }
    const t0 = performance.now();
    const DUR = 2800;
    (function frame(t) {
      const el = t - t0;
      cx.clearRect(0, 0, cv.width, cv.height);
      for (const p of parts) {
        p.y += p.vy;
        p.rot += p.vr;
        p.x += Math.sin(p.rot + el * 0.004) * 1.4;
        cx.save();
        cx.translate(p.x, p.y);
        cx.rotate(p.rot);
        cx.fillStyle = p.color;
        cx.globalAlpha = el > DUR - 600 ? Math.max(0, (DUR - el) / 600) : 1;
        cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        cx.restore();
      }
      if (el < DUR) requestAnimationFrame(frame);
      else { cv.classList.remove("on"); cx.clearRect(0, 0, cv.width, cv.height); }
    })(performance.now());
  }

  /* ---------------- drag & drop ---------------- */

  const drag = {
    tileId: null,
    startX: 0,
    startY: 0,
    moved: false,
    ghost: null,
    source: null, // tray chip or cell
    lastInteract: 0, // timestamp of last pointer interaction
  };

  function beginDrag(tileId, source, x, y) {
    drag.tileId = tileId;
    drag.source = source;
    drag.startX = x;
    drag.startY = y;
    drag.moved = false;
  }

  function makeGhost(e) {
    const tile = state.tileById.get(drag.tileId);
    const el = document.createElement("div");
    el.className = "tile tile--ghost";
    el.textContent = tile.value;
    document.body.appendChild(el);
    drag.ghost = el;
    moveGhost(e);
    if (drag.source && drag.source.classList) drag.source.classList.add("dragging");
  }

  function moveGhost(e) {
    if (drag.ghost) {
      drag.ghost.style.left = e.clientX + "px";
      drag.ghost.style.top = e.clientY + "px";
    }
    const target = blankCellFromPoint(e.clientX, e.clientY);
    boardEl.querySelectorAll(".cell.droptarget").forEach((c) => c.classList.remove("droptarget"));
    if (target) {
      const cell = boardEl.querySelector(`.cell--num[data-r="${target.r}"][data-c="${target.c}"]`);
      if (cell) cell.classList.add("droptarget");
    }
  }

  function blankCellFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    const cell = el && el.closest ? el.closest(".cell--num") : null;
    if (cell && !cell.classList.contains("given")) {
      return { r: +cell.dataset.r, c: +cell.dataset.c };
    }
    return null;
  }

  function endDrag(e) {
    const wasMoved = drag.moved;
    let drop = null;
    if (wasMoved) drop = blankCellFromPoint(e.clientX, e.clientY);

    if (drag.ghost) drag.ghost.remove();
    drag.ghost = null;
    if (drag.source && drag.source.classList) drag.source.classList.remove("dragging");
    boardEl.querySelectorAll(".cell.droptarget").forEach((c) => c.classList.remove("droptarget"));

    const fromCell = drag.source && drag.source.classList && drag.source.classList.contains("cell");

    if (wasMoved && drop) {
      // Moving a placed tile: take it off its old square first.
      if (fromCell && state.tileCell.has(drag.tileId)) {
        const srcKey = state.tileCell.get(drag.tileId);
        removeFromCell(...srcKey.split(":").map(Number));
      }
      place(drag.tileId, drop.r, drop.c);
    } else if (wasMoved) {
      // Dropped off the board — remove from its cell, back to the tray.
      if (fromCell) {
        const [r, c] = state.tileCell.get(drag.tileId).split(":").map(Number);
        removeFromCell(r, c);
      }
    } else {
      // It was a tap, not a drag.
      if (fromCell) {
        const id = state.placement.get(key(drag.source.dataset.r, drag.source.dataset.c));
        if (id === drag.tileId) pickupFromCell(+drag.source.dataset.r, +drag.source.dataset.c);
      } else {
        toggleSelect(drag.tileId);
      }
    }

    drag.tileId = null;
    drag.source = null;
    drag.moved = false;
    drag.lastInteract = Date.now();
    afterMove();
  }

  function onPointerDown(e) {
    if (state.won) return;
    const tile = e.target.closest(".tile");
    if (!tile) return;
    e.preventDefault();
    tile.setPointerCapture(e.pointerId);
    const tileId = +tile.dataset.tileId;
    beginDrag(tileId, tile, e.clientX, e.clientY);

    const move = (ev) => {
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) > 7) {
        drag.moved = true;
        makeGhost(ev);
      } else if (drag.moved) {
        moveGhost(ev);
      }
    };
    const up = (ev) => {
      tile.removeEventListener("pointermove", move);
      tile.removeEventListener("pointerup", up);
      tile.removeEventListener("pointercancel", cancel);
      endDrag(ev);
    };
    const cancel = (ev) => {
      drag.moved = true;
      endDrag(ev);
    };
    tile.addEventListener("pointermove", move);
    tile.addEventListener("pointerup", up);
    tile.addEventListener("pointercancel", cancel);
  }

  function onCellPointerDown(e) {
    if (state.won) return;
    const cell = e.target.closest(".cell--num");
    if (!cell || cell.classList.contains("given")) return;
    const r = +cell.dataset.r;
    const c = +cell.dataset.c;
    const where = key(r, c);
    const tileId = state.placement.get(where);
    if (tileId === undefined) return;
    e.preventDefault();
    cell.setPointerCapture(e.pointerId);
    beginDrag(tileId, cell, e.clientX, e.clientY);

    const move = (ev) => {
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) > 7) {
        drag.moved = true;
        makeGhost(ev);
      } else if (drag.moved) {
        moveGhost(ev);
      }
    };
    const up = (ev) => {
      cell.removeEventListener("pointermove", move);
      cell.removeEventListener("pointerup", up);
      cell.removeEventListener("pointercancel", cancel);
      endDrag(ev);
    };
    const cancel = (ev) => {
      drag.moved = true;
      endDrag(ev);
    };
    cell.addEventListener("pointermove", move);
    cell.addEventListener("pointerup", up);
    cell.addEventListener("pointercancel", cancel);
  }

  // Click a blank square with a selected tile -> place it there.
  function onCellClick(e) {
    if (state.won) return;
    // Ignore synthetic clicks that follow a pointer drag / tap on the board.
    if (Date.now() - (drag.lastInteract || 0) < 300) return;
    const cell = e.target.closest(".cell--num");
    if (!cell || cell.classList.contains("given")) return;
    const r = +cell.dataset.r;
    const c = +cell.dataset.c;
    const where = key(r, c);

    if (state.selectedTileId !== null) {
      const tileId = state.selectedTileId;
      state.selectedTileId = null;
      if (state.placement.get(where) === tileId) removeFromCell(r, c);
      else {
        place(tileId, r, c);
        afterMove();
      }
      return;
    }
    // No tile selected: tapping a filled square picks the number up.
    if (state.placement.get(where) !== undefined) {
      pickupFromCell(r, c);
    }
  }

  /* ---------------- keyboard ---------------- */

  function gridFocus() {
    if (!state.puzzle) return null;
    const nums = [];
    for (let r = 0; r < state.puzzle.S; r++) {
      for (let c = 0; c < state.puzzle.S; c++) {
        if (state.puzzle.layout[r][c] === "num" && !state.puzzle.given[r][c]) nums.push([r, c]);
      }
    }
    if (!nums.length) return null;
    if (!state.cursor) state.cursor = { r: nums[0][0], c: nums[0][1] };
    return { nums, idx: nums.findIndex(([r, c]) => r === state.cursor.r && c === state.cursor.c) };
  }

  function paintCursor() {
    boardEl.querySelectorAll(".cell.cursor").forEach((c) => c.classList.remove("cursor"));
    if (state.cursor && state.puzzle && !state.won) {
      const cell = boardEl.querySelector(`.cell--num[data-r="${state.cursor.r}"][data-c="${state.cursor.c}"]`);
      if (cell) cell.classList.add("cursor");
    }
  }

  document.addEventListener("keydown", (e) => {
    if (state.won || !state.puzzle) return;
    const gf = gridFocus();
    if (!gf) return;
    let { nums, idx } = gf;
    const S = state.puzzle.S;
    const stepTo = (dr, dc) => {
      if (idx < 0) idx = 0;
      const base = nums[idx];
      let nr = base[0] + dr;
      let nc = base[1] + dc;
      for (let i = 0; i < S * S; i++) {
        if (nr >= 0 && nr < S && nc >= 0 && nc < S &&
            state.puzzle.layout[nr][nc] === "num" && !state.puzzle.given[nr][nc]) {
          state.cursor = { r: nr, c: nc };
          paintCursor();
          return true;
        }
        nr += dr; nc += dc;
      }
      return false;
    };

    switch (e.key) {
      case "ArrowUp": e.preventDefault(); stepTo(-1, 0); break;
      case "ArrowDown": e.preventDefault(); stepTo(1, 0); break;
      case "ArrowLeft": e.preventDefault(); stepTo(0, -1); break;
      case "ArrowRight": e.preventDefault(); stepTo(0, 1); break;
      case "Enter": case " ":
        e.preventDefault();
        if (state.selectedTileId !== null && state.cursor) {
          const tileId = state.selectedTileId;
          state.selectedTileId = null;
          place(tileId, state.cursor.r, state.cursor.c);
          afterMove();
          renderTray();
        }
        break;
      case "Backspace": case "Delete":
        e.preventDefault();
        if (state.cursor) pickupFromCell(state.cursor.r, state.cursor.c);
        break;
      default: return;
    }
    paintCursor();
  });

  /* ---------------- equation hover highlight ---------------- */

  function equationsFor(r, c) {
    return state.puzzle.equations.filter((eq) =>
      eq.numCells.some(([rr, cc]) => rr === r && cc === c)
    );
  }

  function setDim(r, c) {
    const cells = new Set();
    for (const eq of equationsFor(r, c)) {
      for (const [rr, cc] of eq.numCells) cells.add(key(rr, cc));
      for (const [rr, cc] of eq.opCells) cells.add(key(rr, cc));
      // plus the '=' of each equation
      const last = eq.numCells[eq.numCells.length - 1];
      const er = eq.dir === "h" ? last[0] : last[0] - 1;
      const ec = eq.dir === "h" ? last[1] - 1 : last[1];
      if (er >= 0 && ec >= 0) cells.add(key(er, ec));
    }
    boardEl.querySelectorAll(".cell").forEach((cell) => {
      if (cell.dataset.r === undefined) return;
      const k = key(+cell.dataset.r, +cell.dataset.c);
      cell.classList.toggle("dim", !cells.has(k));
    });
  }

  function clearDim() {
    boardEl.querySelectorAll(".cell.dim").forEach((c) => c.classList.remove("dim"));
  }

  boardEl.addEventListener("mouseover", (e) => {
    const cell = e.target.closest(".cell--num");
    if (cell) setDim(+cell.dataset.r, +cell.dataset.c);
  });
  boardEl.addEventListener("mouseout", clearDim);
  boardEl.addEventListener("mouseleave", clearDim);

  /* ---------------- buttons ---------------- */

  $("btnHint").addEventListener("click", useHint);
  $("btnCheck").addEventListener("click", checkAnswers);

  $("btnClear").addEventListener("click", () => {
    if (state.won || !state.puzzle) return;
    const blanks = blankCellKeys(state.puzzle);
    for (const k of blanks) {
      const id = state.placement.get(k);
      if (id !== undefined) { state.placement.delete(k); state.tileCell.delete(id); }
    }
    blanks.forEach((k) => refreshCell(...k.split(":").map(Number)));
    state.selectedTileId = null;
    renderTray();
    updateCounts();
    showToast("Board cleared");
  });

  $("btnNew").addEventListener("click", () => {
    newPuzzle(state.level);
    showToast("New puzzle ready");
  });

  $("btnSound").addEventListener("click", () => {
    state.sound = !state.sound;
    $("btnSound").setAttribute("aria-pressed", String(state.sound));
    $("soundIcon").textContent = state.sound ? "🔊" : "🔇";
    $("soundLabel").textContent = state.sound ? "Sound" : "Muted";
    save();
    if (state.sound) playSelect();
  });

  $("btnHelp").addEventListener("click", () => { $("helpModal").hidden = false; });
  $("helpClose").addEventListener("click", () => { $("helpModal").hidden = true; });
  $("helpGotIt").addEventListener("click", () => { $("helpModal").hidden = true; });

  $("winNext").addEventListener("click", () => {
    $("winModal").hidden = true;
    state.level++;
    updateStats();
    save();
    newPuzzle(state.level);
  });

  $("winReplay").addEventListener("click", () => {
    $("winModal").hidden = true;
    newPuzzle(state.level);
  });

  document.addEventListener("click", (e) => {
    if (e.target.classList && e.target.classList.contains("modal")) {
      e.target.hidden = true;
    }
  });

  /* ---------------- wiring & boot ---------------- */

  boardEl.addEventListener("pointerdown", onCellPointerDown);
  boardEl.addEventListener("click", onCellClick);
  trayEl.addEventListener("pointerdown", onPointerDown);

  window.addEventListener("resize", () => {
    // keep the confetti canvas sized to the viewport
    if (confettiEl.classList.contains("on")) {
      confettiEl.width = window.innerWidth;
      confettiEl.height = window.innerHeight;
    }
  });

  loadSave();
  $("btnSound").setAttribute("aria-pressed", String(state.sound));
  $("soundIcon").textContent = state.sound ? "🔊" : "🔇";
  $("soundLabel").textContent = state.sound ? "Sound" : "Muted";
  updateStats();
  newPuzzle(state.level);
})();