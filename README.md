# Math Crossword 🧮

A free, no-dependency math puzzle game that you can host on **GitHub Pages**.
Fill the crossword-style grid with numbers so that **every row and every
column forms a correct equation** — just like the classic Math Crossword.

> Drag numbers from the tray onto the board (or tap a number, then tap a square).

![Gameplay](https://img.shields.io/badge/play-in%20browser-blue) ![No deps](https://img.shields.io/badge/deps-none-brightgreen) ![License](https://img.shields.io/badge/license-MIT-lightgrey)

## Play it

Open [`index.html`](./index.html) in any modern browser — no server or build
step needed. It also works great on phones and tablets (touch drag supported).

## Install as an app (PWA)

This game is a full-screen **Progressive Web App**:

- **Installable** — on your phone or desktop, pick *Add to Home screen* /
  *Install app* from the browser menu. It then opens **full screen** (no
  browser chrome) with a **theme-colored status bar**, just like a native app.
- **Works offline** — once loaded, the game keeps working with no connection;
  a service worker caches everything it needs (`sw.js`).
- The app details (name, colors, icons, full-screen mode) live in
  [`manifest.webmanifest`](./manifest.webmanifest). No build step.

> Installability needs HTTPS — GitHub Pages already provides that.

## How to play

- Each **row** and each **column** of the grid is an arithmetic equation.
- Solve the equations and **drag the numbers** from the tray into the empty squares.
- Numbers are shared where rows and columns **cross** — one wrong pick can break two equations.
- Use **Hint** to reveal a correct number, **Check** to highlight mistakes, and **Clear** to start over.
- Operators work **left to right** (e.g. `4 × 3 + 2 = 14`), and every equation uses
  only one operator family (`+ −` or `× ÷`) so the order is never ambiguous.

### Levels

| Levels | Board  | Operators          |
| ------ | ------ | ------------------ |
| 1 – 4  | 5 × 5  | `+  −  ×`          |
| 5 – 9  | 7 × 7  | `+  −  ×`          |
| 10+    | 9 × 9  | `+  −  ×  ÷`       |

Multiplication `×` is part of the game from Level 1 — every early puzzle is
guaranteed to include at least one `×` equation (up to `9 × 9 = 81`-style
times tables). Division `÷` joins in on the 9 × 9 boards (Level 10+).

Progress (level, score, mute setting) is stored in `localStorage`.

## Hosting on GitHub Pages

1. The repo is live at `github.com/touilfarouk/crossmath` — this game is the
   `main` branch, ready to serve.
2. On GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose:
   - Source: **Deploy from a branch**
   - Branch: **`main`** · folder: **`/ (root)`**
4. Click **Save**. Your game is live in about a minute at:
   `https://touilfarouk.github.io/crossmath/`

> Re-pushing updates the site automatically — just `git push`.

## Project structure

```
index.html      – page shell, modals, toolbar
styles.css      – all styling (board, cells, tiles, responsive)
generator.js    – puzzle generator (works in Node too – unit tested)
game.js         – game logic & UI (drag & drop, check, hints, timer, win flow)
test/           – validation suites (plain Node, no install needed)
package.json    – just scripts; no dependencies
```

## Testing

The project has **zero dependencies** — no `npm install`, no `node_modules`.

- `npm test` runs every suite with plain Node:
  - `test/gen.test.cjs` – validates 30 levels of generated puzzles (every
    equation correct, tray tiles match the blanks, levels 1–4 always include `×`),
  - `test/stress.test.cjs` – reliability: 1200 boards, all valid and fast,
  - `test/dom.test.cjs` – optional headless UI playthrough (uses `jsdom`).
    It skips gracefully if you haven't installed jsdom.

## How the puzzles are generated

Each board is a crossword of equations. The generator:

1. picks `k × k` random numbers and operators for the interior of the grid,
2. derives the right-most column and bottom row from the rows and columns,
3. searches operators so the bottom-right corner agrees with both its row and
   its column equation,
4. locks a few numbers as **givens** and serves the rest back as draggable tiles.

The generator is dependency-free and exports to both browsers and Node, so it
can be unit tested with nothing but Node itself (see **Testing** below).

## License

MIT — use it, remix it, teach math with it.