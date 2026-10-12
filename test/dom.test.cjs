/**
 * Headless UI test for Math Crossword.
 * Plays a full level 1 through the real DOM (select tiles, fill the board,
 * win modal, next level) and verifies persistence across simulated reloads.
 *
 * Optional: requires jsdom. Runs with a plain `node`/`npm test` only if you
 * install jsdom first (`npm i -D jsdom`). Without it this suite skips and the
 * rest of `npm test` stays green — the game itself has no dependencies.
 */
let JSDOM, VirtualConsole;
try {
  ({ JSDOM, VirtualConsole } = require("jsdom"));
} catch (_) {
  console.log("skip: test/dom.test.cjs needs jsdom (optional) — install it with: npm i -D jsdom");
  process.exit(0);
}
const fs = require("fs");
const path = require("path");

const INDEX = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const canvasStub = new Proxy({}, {
  get: (t, p) => (p in t ? t[p] : () => {}),
  set: (t, p, v) => { t[p] = v; return true; },
});

const memoryStore = new Map();
function beforeEachParse(window) {
  window.HTMLElement.prototype.setPointerCapture = function () {};
  window.HTMLElement.prototype.releasePointerCapture = function () {};
  window.HTMLCanvasElement.prototype.getContext = function () { return canvasStub; };
  try {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k) : null),
        setItem: (k, v) => memoryStore.set(k, String(v)),
        removeItem: (k) => memoryStore.delete(k),
        clear: () => memoryStore.clear(),
      },
    });
  } catch (_) {}
}

let failures = 0;
const assert = (cond, msg) => {
  if (!cond) { failures++; console.log("FAIL: " + msg); } else { console.log("ok: " + msg); }
};

function domOpts() {
  return {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    url: "file://" + path.join(__dirname, "..", "index.html").replace(/\\/g, "/"),
    virtualConsole: new VirtualConsole()
      .on("jsdomError", (e) => { failures++; console.log("jsdomError: " + ((e.detail && e.detail.message) || e.message)); })
      .on("error", (e) => { failures++; console.log("page error: " + e.message); }),
    beforeParse: beforeEachParse,
  };
}

function buildGrid(document) {
  const el = document.getElementById("board");
  const children = el.children;
  const total = children.length;
  const S = Math.round(Math.sqrt(total));
  const grid = [];
  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / S);
    const c = i % S;
    if (!grid[r]) grid[r] = [];
    const cell = children[i];
    if (cell.classList.contains("cell--num")) {
      grid[r][c] = { type: "num", given: cell.classList.contains("given"), val: cell.textContent ? Number(cell.textContent) : null };
    } else if (cell.classList.contains("cell--op")) {
      grid[r][c] = { type: "op", sym: cell.textContent.trim() };
    } else { grid[r][c] = { type: "other" }; }
  }
  return { S, grid };
}

const OP = { "+": (a, b) => a + b, "\u2212": (a, b) => a - b, "\u00d7": (a, b) => a * b, "\u00f7": (a, b) => (b && a % b === 0) ? a / b : null };

function solve(grid, tileVals) {
  const S = grid.length;
  const eqs = [];
  for (let r = 0; r < S; r += 2) {
    const nums = [], ops = [];
    for (let c = 0; c < S; c++) {
      if (grid[r][c].type === "num") nums.push({ r, c });
      else if (grid[r][c].type === "op") ops.push(grid[r][c].sym);
    }
    if (nums.length >= 3) eqs.push({ nums, ops });
  }
  for (let c = 0; c < S; c += 2) {
    const nums = [], ops = [];
    for (let r = 0; r < S; r++) {
      if (grid[r][c].type === "num") nums.push({ r, c });
      else if (grid[r][c].type === "op") ops.push(grid[r][c].sym);
    }
    if (nums.length >= 3) eqs.push({ nums, ops });
  }
  const blanks = [];
  for (let r = 0; r < S; r++) for (let c = 0; c < S; c++) {
    if (grid[r][c].type === "num" && !grid[r][c].given) blanks.push({ r, c });
  }
  const used = new Array(tileVals.length).fill(false);
  const assign = new Map();
  const getVal = (r, c) => assign.has(r + ":" + c) ? assign.get(r + ":" + c) : grid[r][c].val;
  const check = () => {
    for (const eq of eqs) {
      let acc = getVal(eq.nums[0].r, eq.nums[0].c);
      for (let i = 0; i < eq.ops.length; i++) {
        acc = OP[eq.ops[i]](acc, getVal(eq.nums[i + 1].r, eq.nums[i + 1].c));
        if (acc === null) return false;
      }
      if (acc !== getVal(eq.nums[eq.nums.length - 1].r, eq.nums[eq.nums.length - 1].c)) return false;
    }
    return true;
  };
  const bt = (i) => {
    if (i === blanks.length) return check();
    const { r, c } = blanks[i];
    for (let t = 0; t < tileVals.length; t++) {
      if (used[t]) continue;
      used[t] = true;
      assign.set(r + ":" + c, tileVals[t]);
      if (bt(i + 1)) return true;
      assign.delete(r + ":" + c);
      used[t] = false;
    }
    return false;
  };
  if (!bt(0)) return null;
  const sol = {};
  for (const [k, v] of assign) sol[k] = v;
  return sol;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const dom = new JSDOM(INDEX, domOpts());
  const { window } = dom;
  const { document } = window;
  const $ = (id) => document.getElementById(id);
  const trayValues = () => [...$("tray").querySelectorAll(".tile")].map((t) => +t.textContent);
  const filled = () => document.querySelectorAll("#board .cell--num.filled").length;
  const cells = (sel) => document.querySelectorAll(sel).length;
  const tapTile = async (value) => {
    const chip = [...$("tray").querySelectorAll(".tile")].find((t) => +t.textContent === value);
    if (!chip) throw new Error("tile not in tray: " + value);
    chip.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientX: 5, clientY: 5 }));
    chip.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true, clientX: 5, clientY: 5 }));
    await delay(320);
  };
  const clickCell = async (r, c) => {
    const cell = document.querySelector(`#board .cell--num[data-r="${r}"][data-c="${c}"]`);
    if (!cell) throw new Error("no cell " + r + "," + c);
    cell.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await delay(25);
  };

  await delay(150);
  assert(window.MathCrosswordGenerator && cells("#board .cell") === 25, "level 1 board renders (25 cells)");
  assert($("levelVal").textContent === "1", "level = 1");

  const { grid } = buildGrid(document);
  const tileVals = trayValues();
  const sol = solve(grid, tileVals);
  assert(!!sol, "puzzle is solvable");

  // Hint places a number from the tray.
  const beforeHint = trayValues().length;
  $("btnHint").click();
  await delay(80);
  assert(trayValues().length < beforeHint, "Hint places a number");
  $("btnClear").click();
  await delay(60);

  // Solve the whole level through the UI.
  const { grid: g2 } = buildGrid(document);
  const sol2 = solve(g2, trayValues());
  assert(!!sol2, "fresh solution found");
  for (const [k, v] of Object.entries(sol2)) {
    const [r, c] = k.split(":").map(Number);
    await tapTile(v);
    await clickCell(r, c);
  }
  await delay(120);
  assert(filled() === 6, "all 6 blanks filled");
  assert($("winModal").hidden === false, "win modal appears");
  $("winNext").click();
  await delay(120);
  assert($("levelVal").textContent === "2", "level advances to 2");
  assert(JSON.parse(memoryStore.get("math-crossword-progress-v1")).level === 2, "progress saved");
  dom.window.close();

  // Simulated reload at level 5 -> 7x7 board, persisted score.
  memoryStore.set("math-crossword-progress-v1", JSON.stringify({ level: 5, score: 500, sound: true }));
  const dom5 = new JSDOM(INDEX, domOpts());
  await delay(180);
  assert(dom5.window.document.querySelectorAll("#board .cell").length === 49, "reload at level 5 -> 7x7");
  assert(dom5.window.document.getElementById("levelVal").textContent === "5", "level 5 restored");
  assert(dom5.window.document.getElementById("scoreVal").textContent === "500", "score 500 restored");

  // Simulated reload at level 10 -> 9x9 board.
  memoryStore.set("math-crossword-progress-v1", JSON.stringify({ level: 10, score: 0, sound: true }));
  const dom10 = new JSDOM(INDEX, domOpts());
  await delay(180);
  assert(dom10.window.document.querySelectorAll("#board .cell").length === 81, "reload at level 10 -> 9x9");

  dom5.window.close();
  dom10.window.close();

  console.log(failures ? "\n" + failures + " failure(s)." : "\nDOM test: all good.");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.log("TEST CRASH: " + (e && e.stack || e));
  process.exit(1);
});