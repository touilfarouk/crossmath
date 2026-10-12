# Math Crossword 🧮

A free, no-dependency **multiplication crossword** for practising times tables,
ready to host on **GitHub Pages**. Fill the grid so that **every row and every
column forms a correct multiplication equation** — from `3 × 4 = 12` up to
`9 × 9 = 81`, with longer factor chains on the bigger boards.

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

- Each **row** and each **column** of the grid is a **multiplication equation**.
- Solve the equations and **drag the numbers** from the tray into the empty squares.
- Numbers are shared where rows and columns **cross** — one wrong pick can break two equations.
- Use **Hint** to reveal a correct number, **Check** to highlight mistakes, and **Clear** to start over.
- No pluses or minuses — every equation is a single multiplication working
  **left to right**, like `3 × 4 = 12` (no `+`, `−`, or `÷` anywhere).

### Levels

The board is always 5 × 5; levels tune the times tables and how many squares
are pre-filled.

| Levels | Board  | What you practise                  |
| ------ | ------ | ---------------------------------- |
| 1 – 2  | 5 × 5  | times tables, products up to 30    |
| 3 – 4  | 5 × 5  | products up to 45                  |
| 5 – 6  | 5 × 5  | products up to 60                  |
| 7 – 9  | 5 × 5  | products up to 72                  |
| 10+    | 5 × 5  | the full 1–9 tables (`×` up to 81) |

**Every equation is a multiplication equation** — the whole game is a
times-table trainer, and higher levels hand you fewer pre-filled numbers.

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
    equation correct and a multiplication equation, tray tiles match the blanks),
  - `test/stress.test.cjs` – reliability: 1200 boards, all valid and fast,
  - `test/dom.test.cjs` – optional headless UI playthrough (uses `jsdom`).
    It skips gracefully if you haven't installed jsdom.

## How the puzzles are generated

Each board is a crossword of equations. The generator:

1. fills the interior with random factors from 1 to 9,
2. multiplies each row and column to derive the right-hand results column and
   the bottom results row,
3. resolves the bottom-right corner so it agrees with both its row and its
   column equation (with multiplication only, both sides are simply the product
   of every interior number),
4. locks a few numbers as **givens** and serves the rest back as draggable tiles.

The generator is dependency-free and exports to both browsers and Node, so it
can be unit tested with nothing but Node itself (see **Testing** below).

## License

MIT — use it, remix it, teach math with it.