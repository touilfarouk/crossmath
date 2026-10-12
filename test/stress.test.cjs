// Reliability + multiplication-frequency regression test.
// Levels 1-4 must ALWAYS include at least one multiplication equation and
// generate quickly, while staying fully valid.
const G = require("../generator.js");

let failures = 0;
let slow = 0;

for (let level = 1; level <= 6; level++) {
  const cfg = G.difficultyForLevel(level);
  for (let i = 0; i < 200; i++) {
    const t0 = Date.now();
    const p = G.generate(cfg);
    const dt = Date.now() - t0;
    if (!p) { failures++; console.log("level " + level + " failed to generate"); continue; }
    if (dt > 50) slow++;

    const res = G.evaluate(p, (r, c) => p.values[r][c]);
    if (res.some((r) => !r.correct)) { failures++; console.log("level " + level + " produced an invalid board"); }

    if (level <= 4 && !p.equations.some((eq) => eq.ops.includes("*"))) {
      failures++;
      console.log("level " + level + " puzzle has no multiplication");
    }
  }
}

// Report how often multiplication shows up (informational).
for (const level of [1, 3, 5]) {
  const cfg = G.difficultyForLevel(level);
  let mult = 0, total = 0, boardsWith = 0;
  for (let i = 0; i < 200; i++) {
    const p = G.generate(cfg);
    let has = 0;
    for (const eq of p.equations) {
      total += eq.ops.length;
      has += eq.ops.filter((o) => o === "*").length;
    }
    mult += has;
    if (has > 0) boardsWith++;
  }
  console.log(
    "level " + level + " (S=" + cfg.S + ", ops " + cfg.ops.join("") + "): * in " + Math.round((mult / total) * 100) +
    "% of operator slots, " + boardsWith + "/200 boards contain multiplication"
  );
}

console.log(failures ? "\n" + failures + " failure(s)." : "\nStress test: 1200 boards, all valid, all levels 1-4 include multiplication.");
console.log("Generations slower than 50ms: " + slow);
process.exit(failures ? 1 : 0);