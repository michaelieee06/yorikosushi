# Yoriko Sushi — interactive menu book

An online menu for a fictional sushi bar. The menu is a **3D book**: click the
cover, turn the pages, and tap any dish to watch it lift off the page, fly
forward and settle beside a chat-style panel that names the dish, quotes the
price and offers a Buy button.

No frameworks, no build step, no runtime dependencies. The whole thing is
static files served by a ~40-line Node server.

```
node tools/serve.mjs 5173      # then open http://localhost:5173
```

Or `npm start`. The port is optional (defaults to 5173).

---

## What's on the page

| Spread | Left page | Right page |
|---|---|---|
| 0 (closed) | — | front cover (centred) |
| 1 | welcome endpaper | contents (p.1) |
| 2 | Nigiri price list (p.2) | Nigiri plates (p.3) |
| 3 | Maki & Rolls price list (p.4) | Maki & Rolls plates (p.5) |
| 4 | Specials price list (p.6) | Specials plates (p.7) |
| 5 | "Good to know" notes (p.8) | thank-you board + Close book |

Each category is split across one spread: the list on the left, the plates on
the right. Every dish appears **once** on each kind of page, with no repeats.

## How to use it

- **Open / turn**: click the cover, click a page edge, press `←` / `→`
  (`PageUp` / `PageDown`, `Home` / `End`), drag or flick a page horizontally,
  use the pager arrows and dots, or click a row in the contents page.
- **View a dish**: click any plate *or* any row in a price list. The dish flies
  out to the left; the chat panel stacks its bubbles on the right.
- **Buy**: adds the dish to the order slip (top-right). The slip is a demo —
  nothing is charged, and the cart lives in `localStorage`.
- **Close**: `Esc`, the ✕ in the panel, or click outside.

Phones keep the two-page spread, but taller: plates stack as four horizontal
cards, and the chat panel becomes a bottom sheet so the dish stays visible
above it. Landscape phones use a compact top bar and drop the page notes so the
book fits between the top bar and the pager.

## Book mechanics

The model is deliberately small and explicit, and it behaves the same in
Firefox and Chromium:

- A **sheet** (`.leaf`) is half a book wide, hinged at `left: 50%` with
  `transform-origin: left center`. Sheet 0 is the cover (front: cover art,
  back: welcome endpaper); `js/book.js` builds the other 4. The thank-you
  board is a static page under the last sheet.
- `progress` is a float, `0 … total` (`total = 5`). Each sheet's local
  progress is `p - i` clamped to `0…1`, and the sheet renders
  `perspective(2600px) rotateY(-180deg × local)`.
- **No `preserve-3d` anywhere.** Each sheet has its own perspective, so the
  browser never depth-sorts pages against each other; `z-index` alone decides
  stacking: the turning sheet is `10 + 2n`, turned sheets are `10 + i`, and
  unturned sheets are `10 + 2n - 1 - i`.
- Exactly one face per sheet is painted. JS sets `data-up="front|back"` once
  the sheet passes edge-on (`local > 0.5`), and the back face is pre-mirrored
  with `scaleX(-1)`. A `--shade` variable darkens the sheet while it turns.
- Only the two facing pages are interactive: every other face (and the board,
  when covered) gets `inert`, so a buried page can never take a click or focus.
- `go(n)` retargets mid-turn, so pressing quickly chains turns and a dot jump
  animates as one riffle. Dragging takes over a turn in progress, and a flick
  past 6% of the width commits the turn.
- While the book is closed it shifts `translateX(-25%)`, so the cover sits
  centred.

## Performance notes

The brief asked for something that stays smooth on a mid-low-end phone, so:

- **Only `transform` and `opacity` are animated** — no layout, no paint
  thrash. Page turns are driven by `requestAnimationFrame`.
- **No `backdrop-filter`** and no blur filters on moving elements. The only
  `mix-blend-mode` is the static paper grain, and it is turned off below 768px.
- Dish art is **transparent PNG, 560×560, trimmed and palette-quantised (64
  colours)**; all 13 images total ~189 KB. They are generated from hand-written
  SVG by `tools/render-assets.mjs` (`sharp`), so the repo holds one small file
  per dish. Images for later spreads are prefetched after load.
- `prefers-reduced-motion` shortens every transition to `~120ms`; 4 or fewer
  cores, 4 GB or less of memory, or Save-Data switches `lowPower` on, which shortens the page-turn
  and fly animations. The per-card tilt runs only for a mouse pointer.
- The book keeps `contain: layout style` and animates on the compositor.

Total shipped weight excluding fonts: **~89 KB of uncompressed HTML/CSS/JS
plus art**.

## Layout

```
index.html            markup: cover, book, viewer, chat, slip
styles.css            all styling, organised in numbered sections
js/data.js            menu data, formatting, media-query helpers
js/book.js            the page-turn engine (build, render, go, drag)
js/viewer.js          the fly-forward animation + chat sequence
js/slip.js            order slip: persistence and rendering
js/app.js             wiring: pager, keyboard, sound, book <-> viewer
assets/*.png          generated dish art (transparent)
tools/serve.mjs       static file server
tools/render-assets.mjs  regenerates assets/ from inline SVG
tools/shoot.mjs       Playwright screenshot + overflow/error harness
tools/probe.mjs       Playwright interaction test of the book engine
PROMPT.md             the original design brief
```

### Regenerating the art

```
node tools/render-assets.mjs
```

Each dish is a small SVG (plate, rice, neta) rendered to a transparent PNG.
Edit the SVG in that script and re-run; nothing else needs to change.

### Visual regression / sanity check

One-time setup: `npx playwright install firefox chromium`.

```
node tools/shoot.mjs                                  # firefox + chromium
ENGINES=firefox SIZES=desktop,phone,tablet,landscape,tiny node tools/shoot.mjs
node tools/probe.mjs firefox 390x844                  # [firefox|chromium] WxH
```

With the server running, `shoot.mjs` drives a headless Firefox and Chromium
through the whole flow at every size, writes `{engine}-{size}-N-*.png` to
`tools/shots/`, and fails loudly on console errors or horizontal overflow.

`probe.mjs` tests the book engine with real animations: the pager, keyboard,
dots, drag, double-press chaining, contents jumps, opening the viewer from a
plate and from a list row, closing the book, and tapping the cover. It saves
mid-turn and resting frames to `tools/shots/probe/` and prints
`all checks passed` or the failing checks.

## Checkout hook

`js/viewer.js` calls `this.onBuy(item)` when Buy is pressed. `js/app.js`
currently wires that to the local order slip:

```js
new Viewer({ book, onBuy: (item) => slip.add(item) })
```

To connect a real basket, replace that callback — for example
`onBuy: (item) => cart.post('/api/cart', item)`. Nothing else in the viewer
needs to change, and the slip can be dropped or left as a local preview.

## Notes

- Dish names, prices (IDR) and the address are fictional.
- Colours, type scale and spacing are CSS custom properties at the top of
  `styles.css`.
