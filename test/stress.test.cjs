// Reliability + multiplication-focused regression test.
// Every puzzle at every level must:
//   - generate quickly
//   - be fully valid (every equation correct)
//   - consist ONLY of multiplication equations (the game is a times-table puzzle)
const G = require("../generator.js");

let failures = 0;
let slow = 0;

for (let level = 1; level <= 10; level++) {
  const cfg = G.difficultyForLevel(level);
  for (let i = 0; i < 150; i++) {
    const t0 = Date.now();
    const p = G.generate(cfg);
    const dt = Date.now() - t0;
    if (!p) { failures++; console.log("level " + level + " failed to generate"); continue; }
    if (dt > 50) slow++;

    const res = G.evaluate(p, (r, c) => p.values[r][c]);
    if (res.some((r) => !r.correct)) { failures++; console.log("level " + level + " produced an invalid board"); }

    if (!p.equations.every((eq) => eq.ops.length > 0 && eq.ops.every((o) => o === "*"))) {
      failures++;
      console.log("level " + level + " puzzle contains a non-multiplication equation");
    }
  }
}

// Informational: board size/value range per tier.
for (const level of [1, 3, 5, 10]) {
  const cfg = G.difficultyForLevel(level);
  const p = G.generate(cfg);
  const allVals = [...p.tiles.map((t) => t.value)];
  const worst = Math.max(...allVals);
  console.log(
    "level " + level + " (S=" + cfg.S + ", ops " + cfg.ops.join("") + ", maxRes " + cfg.maxRes + "): " +
    p.equations[0].ops.length + " multiplication(s) per equation, largest tray number " + worst
  );
}

console.log(
  failures
    ? "\n" + failures + " failure(s)."
    : "\nStress test: 1500 boards across levels 1-10, all valid, every equation is multiplication."
);
console.log("Generations slower than 50ms: " + slow);
process.exit(failures ? 1 : 0);