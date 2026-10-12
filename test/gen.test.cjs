const G = require("../generator.js");

function eqString(p, eq) {
  const v = (r, c) => p.values[r][c];
  const sym = (r, c) => p.opSymbols[r][c];
  let s = "" + v(...eq.numCells[0]);
  for (let i = 1; i < eq.numCells.length; i++) {
    s += " " + sym(...eq.opCells[i - 1]) + " " + v(...eq.numCells[i]);
  }
  return s + "  [" + eq.dir + "]";
}

let failures = 0;

for (let level = 1; level <= 30; level++) {
  const cfg = G.difficultyForLevel(level);
  const p = G.generate(cfg);
  if (!p) { console.log("LEVEL " + level + " FAILED to generate"); failures++; continue; }

  // Every equation must be correct against the solution.
  const incorrect = G.evaluate(p, (r, c) => p.values[r][c]).filter((res) => !res.correct);
  if (incorrect.length) {
    failures++;
    console.log("LEVEL " + level + " incorrect equations: " + incorrect.map((r) => eqString(p, r.eq)).join("; "));
  }

  // Tray tiles must be exactly the blank cells' values (multiset).
  const blanks = [];
  const k = p.k;
  for (let r = 0; r < k; r++) for (let c = 0; c < k; c++) {
    if (!p.given[2 * r][2 * c]) blanks.push(p.values[2 * r][2 * c]);
  }
  const a = blanks.slice().sort((x, y) => x - y).join(",");
  const b = p.tiles.map((t) => t.value).sort((x, y) => x - y).join(",");
  if (a !== b) { failures++; console.log("LEVEL " + level + " tray/blank multiset mismatch"); }

  // All number cells filled with sensible values.
  for (let r = 0; r < p.S; r++) for (let c = 0; c < p.S; c++) {
    if (p.layout[r][c] === "num" && (p.values[r][c] === null || p.values[r][c] < 1)) {
      failures++;
      console.log("LEVEL " + level + " bad cell value at " + r + "," + c);
    }
  }

  // Operator cells must all carry a symbol.
  for (let r = 0; r < p.S; r++) for (let c = 0; c < p.S; c++) {
    if (p.layout[r][c] === "op" && !p.opSymbols[r][c]) {
      failures++;
      console.log("LEVEL " + level + " op cell missing symbol at " + r + "," + c);
    }
  }

  // Levels 1-4 promise at least one multiplication equation.
  if (level <= 4 && !p.equations.some((eq) => eq.ops.includes("*"))) {
    failures++;
    console.log("LEVEL " + level + " has no multiplication equation");
  }
}

// Human-checkable sample boards.
for (const lvl of [1, 5, 10]) {
  const p = G.generate(G.difficultyForLevel(lvl));
  console.log("\nSample board, level " + lvl + " (S=" + p.S + ", ops " + p.ops.join("") + "):");
  for (let r = 0; r < p.S; r++) {
    let line = "";
    for (let c = 0; c < p.S; c++) {
      const t = p.layout[r][c];
      if (t === "num") line += String(p.values[r][c]).padStart(3) + (p.given[r][c] ? "\u25cf" : " ");
      else if (t === "op") line += " " + p.opSymbols[r][c] + " ";
      else if (t === "eq") line += " = ";
      else line += " . ";
    }
    console.log(line);
  }
  console.log("tiles:", p.tiles.map((t) => t.value).join(" "));
}

if (failures) {
  console.log("\n" + failures + " failure(s).");
  process.exit(1);
}
console.log("\nGenerator: all 30 levels validated OK.");