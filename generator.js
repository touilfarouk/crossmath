/*!
 * Math Crossword - puzzle generator
 * Produces crossword-style grid layouts where every row and column is a
 * multiplication equation, e.g.
 *
 *      1  ×  2  =   2
 *      ×     ×      ×
 *      3  ×  4  =  12
 *      =     =      =
 *      3  ×  8  =  24
 *
 * All equations use multiplication only - the game is built around practising
 * times tables. Bigger boards chain more factors (a × b = c, a × b × c = d...).
 *
 * Works both in the browser (window.MathCrosswordGenerator) and in Node
 * (module.exports) so the generation logic can be unit tested.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MathCrosswordGenerator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ALL_OPS = ["+", "-", "*", "/"];

  /** Human readable operator symbols used on the board. */
  const OP_SYMBOL = { "+": "+", "-": "\u2212", "*": "\u00d7", "/": "\u00f7" };

  /**
   * Apply a single operation. Returns null when the operation is not allowed
   * for a friendly, whole-number puzzle (non integer division, negatives...).
   */
  function apply(a, op, b, minValue, maxValue) {
    let v;
    switch (op) {
      case "+": v = a + b; break;
      case "-": v = a - b; break;
      case "*": v = a * b; break;
      case "/": v = b !== 0 && a % b === 0 ? a / b : null; break;
      default: return null;
    }
    if (v === null) return null;
    if (v < minValue || v > maxValue) return null;
    return v;
  }

  function randInt(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return arr[randInt(arr.length)]; }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /** Build the operator "families" allowed by a configuration. */
  function operatorFamilies(ops) {
    const families = [];
    if (ops.includes("+") || ops.includes("-")) families.push(["+", "-"]);
    if (ops.includes("*") && ops.includes("/")) families.push(["*", "/"]);
    else if (ops.includes("*")) families.push(["*"]);
    else if (ops.includes("/")) families.push(["/"]);
    return families;
  }

  /**
   * Fold a list of operands left to right, choosing a valid operator at every
   * step. Every equation sticks to a single operator family (additive or
   * multiplicative) so the evaluation order is never ambiguous for players.
   * Returns { value, ops } or null when no operator keeps the running
   * total inside the allowed range.
   */
  function foldRandom(operands, ops, minValue, maxValue) {
    const families = operatorFamilies(ops);
    if (!families.length) return null;

    for (let attempt = 0; attempt < 6; attempt++) {
      const family = pick(families);
      let acc = operands[0];
      const chosen = [];
      let good = true;
      for (let i = 1; i < operands.length; i++) {
        const b = operands[i];
        const valid = [];
        for (const op of family) {
          const v = apply(acc, op, b, minValue, maxValue);
          if (v !== null) valid.push({ op, v });
        }
        if (!valid.length) { good = false; break; }
        const c = pick(valid);
        acc = c.v;
        chosen.push(c.op);
      }
      if (good) return { value: acc, ops: chosen };
    }
    return null;
  }

  /** All operator sequences of a given length. */
  function opCombos(ops, len) {
    let combos = [[]];
    for (let i = 0; i < len; i++) {
      const next = [];
      for (const c of combos) for (const op of ops) next.push(c.concat(op));
      combos = next;
    }
    return combos;
  }

  /**
   * One attempt at producing a grid of k x k "number" slots.
   * Rows define the right-most column, columns define the bottom row, and the
   * bottom-right corner is found by searching operators until both agree.
   */
  function attempt(k, ops, maxN, maxRes, maxAttempts) {
    const x = [];
    for (let r = 0; r < k; r++) x.push(new Array(k).fill(0));

    const opsR = [];
    const opsC = [];

    for (let r = 0; r < k - 1; r++) {
      const row = [];
      for (let c = 0; c < k - 1; c++) row.push(1 + randInt(maxN));
      const folded = foldRandom(row, ops, 1, maxRes);
      if (!folded) return null;
      for (let c = 0; c < k - 1; c++) x[r][c] = row[c];
      x[r][k - 1] = folded.value;
      opsR[r] = folded.ops;
    }

    for (let c = 0; c < k - 1; c++) {
      const col = [];
      for (let r = 0; r < k - 1; r++) col.push(x[r][c]);
      const folded = foldRandom(col, ops, 1, maxRes);
      if (!folded) return null;
      x[k - 1][c] = folded.value;
      opsC[c] = folded.ops;
    }

    // Corner search: last row and last column must meet on the same value.
    const rowOperands = x[k - 1].slice(0, k - 1);
    const colOperands = [];
    for (let r = 0; r < k - 1; r++) colOperands.push(x[r][k - 1]);

    // Homogeneous operator combos (each corner equation keeps one family).
    const pool = [];
    for (const f of operatorFamilies(ops)) pool.push(...opCombos(f, k - 2));

    for (let i = 0; i < pool.length; i++) {
      const p1 = foldFixed(rowOperands, pool[i], 1, maxRes);
      if (p1 === null) continue;
      for (let j = 0; j < pool.length; j++) {
        const p2 = foldFixed(colOperands, pool[j], 1, maxRes);
        if (p2 === null || p2 !== p1) continue;
        x[k - 1][k - 1] = p1;
        opsR[k - 1] = pool[i];
        opsC[k - 1] = pool[j];
        return { x, opsR, opsC };
      }
    }
    return null;
  }

  /** Fold with a fixed operator list (null when invalid). */
  function foldFixed(operands, ops, minValue, maxValue) {
    let acc = operands[0];
    for (let i = 1; i < operands.length; i++) {
      acc = apply(acc, ops[i - 1], operands[i], minValue, maxValue);
      if (acc === null) return null;
    }
    return acc;
  }

  const LAYOUT_CACHE = {};

  /** Cell kinds for a board of S x S cells. */
  function buildLayout(S) {
    if (LAYOUT_CACHE[S]) return LAYOUT_CACHE[S];
    const grid = [];
    for (let r = 0; r < S; r++) {
      const row = [];
      for (let c = 0; c < S; c++) {
        const evenR = r % 2 === 0;
        const evenC = c % 2 === 0;
        let type = "block";
        if (evenR && evenC) type = "num";
        else if (evenR && !evenC) type = c === S - 2 ? "eq" : "op";
        else if (!evenR && evenC) type = r === S - 2 ? "eq" : "op";
        row.push(type);
      }
      grid.push(row);
    }
    LAYOUT_CACHE[S] = grid;
    return grid;
  }

  /** Equations (rows and columns) of a board, referencing number/op cells. */
  function buildEquations(S) {
    const k = (S + 1) / 2;
    const eqs = [];
    for (let r = 0; r < k; r++) {
      const numCells = [];
      for (let c = 0; c < k; c++) numCells.push([2 * r, 2 * c]);
      const opCells = [];
      for (let c = 0; c < k - 2; c++) opCells.push([2 * r, 2 * c + 1]);
      eqs.push({ dir: "h", numCells, opCells });
    }
    for (let c = 0; c < k; c++) {
      const numCells = [];
      for (let r = 0; r < k; r++) numCells.push([2 * r, 2 * c]);
      const opCells = [];
      for (let r = 0; r < k - 2; r++) opCells.push([2 * r + 1, 2 * c]);
      eqs.push({ dir: "v", numCells, opCells });
    }
    return eqs;
  }

  /**
   * Generate a full puzzle.
   * @param {object} cfg {S, ops, maxN, maxRes, givens}
   */
  function generate(cfg) {
    const S = cfg.S;
    const ops = cfg.ops && cfg.ops.length ? cfg.ops : ["+", "-"];
    const maxN = cfg.maxN || 9;
    const maxRes = cfg.maxRes || Math.max(18, maxN * 2);
    const k = (S + 1) / 2;

    let solution = null;
    for (let i = 0; i < 4000 && !solution; i++) {
      solution = attempt(k, ops, maxN, maxRes, i);
    }
    if (!solution) return null;

    const { x, opsR, opsC } = solution;
    const layout = buildLayout(S);
    const equations = buildEquations(S);

    // values + operator symbols
    const values = [];
    const opSymbols = [];
    for (let r = 0; r < S; r++) {
      values.push(new Array(S).fill(null));
      opSymbols.push(new Array(S).fill(""));
    }
    for (let r = 0; r < k; r++) {
      for (let c = 0; c < k; c++) values[2 * r][2 * c] = x[r][c];
    }
    equations.forEach((eq, idx) => {
      const opsList = eq.dir === "h" ? opsR[idx] : opsC[idx - k];
      eq.ops = opsList.slice();
      eq.opCells.forEach(([r, c], i) => { opSymbols[r][c] = OP_SYMBOL[opsList[i]]; });
    });

    // pick given (pre-filled, locked) number cells
    const numCells = equations
      .filter((e) => e.dir === "h")
      .reduce((acc, e) => acc.concat(e.numCells), []);

    const givenCells = shuffle(numCells.slice()).slice(0, Math.min(cfg.givens || 0, numCells.length));
    const given = [];
    for (let r = 0; r < S; r++) given.push(new Array(S).fill(false));
    givenCells.forEach(([r, c]) => { given[r][c] = true; });

    const tiles = [];
    let tileId = 0;
    numCells.forEach(([r, c]) => {
      if (!given[r][c]) tiles.push({ id: tileId++, value: values[r][c] });
    });

    return {
      S,
      k,
      ops,
      layout,
      values,
      given,
      opSymbols,
      equations,
      tiles: shuffle(tiles),
      givenCount: givenCells.length,
    };
  }

  /** Difficulty settings for a given level. */
  function difficultyForLevel(level) {
    const lv = Math.max(1, level | 0);
    // The board stays 5 x 5: with multiplication only, the shared bottom-right
    // corner must equal the product of every interior number, so bigger grids
    // are not feasible. Difficulty ramps through bigger times tables and fewer
    // pre-filled squares instead.
    let maxRes, givens;
    if (lv <= 2) { maxRes = 30; givens = 4; }        // products up to ~5 x 6
    else if (lv <= 4) { maxRes = 45; givens = 3; }   // up to ~6 x 7
    else if (lv <= 6) { maxRes = 60; givens = 3; }   // up to ~8 x 7
    else if (lv <= 9) { maxRes = 72; givens = 2; }   // up to 9 x 8
    else { maxRes = 81; givens = 2; }                // the full 1-9 times tables
    return { S: 5, ops: ["*"], maxN: 9, maxRes, givens, level: lv };
  }

  /** Validate a set of placements against the puzzle solution/equations. */
  function evaluate(puzzle, valueAt) {
    const results = [];
    for (const eq of puzzle.equations) {
      const vals = eq.numCells.map((rc) => valueAt(rc[0], rc[1]));
      const complete = vals.every((v) => v !== null && v !== undefined);
      if (!complete) { results.push({ eq, complete: false, correct: false }); continue; }
      const operands = vals.slice(0, vals.length - 1);
      const target = vals[vals.length - 1];
      const acc = foldFixed(operands, eq.ops, -Infinity, Infinity);
      results.push({ eq, complete: true, correct: acc !== null && acc === target });
    }
    return results;
  }

  return {
    generate,
    difficultyForLevel,
    evaluate,
    buildLayout,
    buildEquations,
    OP_SYMBOL,
    ALL_OPS,
  };
});
