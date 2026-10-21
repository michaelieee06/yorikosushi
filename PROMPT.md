# Master Prompt — "Yoriko Sushi" Online Menu Book

> Use this prompt as-is with a coding agent. It is written to produce a **single-page, static, dependency-free** website.

---

## 1. Role & Goal

You are a senior front-end engineer and interaction designer. Build a **production-quality, single-page website** for a fictional sushi restaurant called **Yoriko Sushi** (寄子寿司).

The site is not a normal menu page. It is an **interactive, physical-feeling menu book**:

1. The user sees a closed Japanese-style book lying on a soft surface.
2. They open it; pages turn like real paper with a smooth, weighty animation.
3. Each page shows a small grid of sushi items on washi-paper cards.
4. Clicking any item **launches it forward off the page** into the viewer's face, then it settles on the left side of the screen while a chat-style detail panel slides in on the right.
5. The user presses **Buy** and the item is added to a cart that feels like a tiny paper order slip.

Everything must run at 60 fps on a **mid-to-low-end phone** (e.g. a 4-year-old Android at ~2 GB RAM), so this is as much a performance exercise as a design exercise.

---

## 2. Brand & Art Direction

### 2.1 Name & identity
- Name: **Yoriko Sushi** — Romaji wordmark, with **寄子寿司** in a brush/serif kanji style as a secondary mark.
- Tagline: *"Hand-pressed, every morning."* / 毎朝握り.
- Tone: calm, refined, slightly playful. Not a busy takeaway site.

### 2.2 Visual language — traditional Japanese
- **Palette (use CSS variables):**
  - `--paper` warm washi cream `#f4ece0`
  - `--paper-deep` `#e8dcc8`
  - `--ink` sumi black-brown `#221a17`
  - `--vermilion` 朱 shu red `#c0392b` / accent `#d24b34`
  - `--indigo` 藍 ai `#2b3a55`
  - `--matcha` `#7d8f69`
  - `--gold` `#b08d57` (thin foil-like rules only)
- **Textures (all CSS-generated, zero image downloads for backgrounds):**
  - Washi paper grain via 2–3 layered `repeating-linear-gradient`s + one tiny inline SVG `feTurbulence` noise data-URI at low opacity.
  - Page edge shadow, spine stitching dashed line, and a subtle curl gradient at the gutter.
- **Motifs used sparingly:** seigaiha (wave) pattern on the cover, asanoha on the endpaper, thin gold hairlines, a single red hanko seal stamp on the cover.
- **Typography:**
  - Display/headings: a Japanese-capable serif — `"Shippori Mincho", "Noto Serif JP", "Yu Mincho", "Hiragino Mincho ProN", serif`.
  - Body: `"Inter", system-ui, sans-serif` at slightly increased letter spacing.
  - Load **at most two weights** of one webfont, and only if the budget allows (see §8). Fall back to system Japanese serif gracefully — do **not** block rendering on fonts (`font-display: swap`).
- **Layout discipline:** generous negative space, strict horizontal alignment, thin rules instead of boxes, no drop shadows on text.

---

## 3. Page & Content Specification

### 3.1 Menu data (12 items, 4 per spread = 3 spreads)
Each item object: `{ id, name, jp, romaji, price, currency, blurb, tags[], image, color }`

Suggested categories/pages:
1. **Nigiri** — Hon Maguro (本鮪), Shake (鮭), Hotate (帆立), Ebi (海老)
2. **Maki & Rolls** — Tekka Maki, Dragon Roll, Spicy Tuna, Avocado Maki
3. **Specials** — Omakase Set, Uni (雲丹), Ikura (いくら), Torched Aburi

Prices in **IDR** formatted with thousands separators (e.g. `Rp 48.000`), plus a small secondary USD hint is optional — keep one currency to stay simple.

### 3.2 Pages of the book
- **Cover:** deep indigo cloth with seigaiha wave pattern, gold hairline frame, title, red hanko, and a "Open the menu" affordance.
- **Spread 1–3:** left page = category title in vertical Japanese text + numbered items list (like a real index), right page = the 2×2 visual grid of the same items. *(Alternative: both pages carry 2 items each — pick whichever looks better, but keep 4 items per visible spread.)*
- **Back cover:** thank-you note, address, opening hours, small "order slip" summary if cart has items.

### 3.3 Book mechanism (desktop & mobile)
- Real 3D page turn using CSS `transform-style: preserve-3d`, `perspective` on the stage, and `rotateY` on page leaves.
- Each page is a `.leaf` with `transform-origin: left center` (right-hand leaves). Leaves stack with correct z-index; turned leaves rotate to `-180deg`.
- **Drag/swipe to turn** (pointer events, not just click), with a **live-following** page angle while dragging (clamped, with slight resistance near 0°/180°), then momentum snap to the nearest side on release.
- Shadows: a moving gradient overlay on the turning leaf that darkens toward the gutter as it lifts — this is what sells the paper feel.
- Arrow buttons (`‹ ›`) and keyboard `ArrowLeft` / `ArrowRight` / `Esc` / `Enter` support.
- Page indicator: small dot column or `01 / 04` in the gutter.
- **Reduced motion:** if `prefers-reduced-motion: reduce`, page turns become a short 180 ms cross-fade; no 3D.

---

## 4. The Item Popup (Hero Interaction)

This is the signature moment. Design it precisely.

### 4.1 Concept
- **No modal background color, no blur backdrop, no dimming overlay.** The book stays visible but recedes.
- The tapped item's **transparent PNG** lifts out of its card and **flies forward** — scale up, translate toward the camera, slight `rotateZ` overshoot — landing on the **left** of the viewport.
- Simultaneously, a **chat panel on the right** enters with staggered messages.

### 4.2 Fly-forward animation (must use FLIP)
1. On click, measure the card image's bounding rect (`getBoundingClientRect`).
2. Render the full-size item PNG in a fixed-position layer at the card's rect (same size), then animate `transform: translate() scale()` to its final left-side rect. Animate only `transform` and `opacity` (GPU-composited) — **never** `top/left/width/height`.
3. Sequence:
   - `t=0` — card's own image fades to 0 opacity (the "extracted" look).
   - `0–80 ms` — item eases forward with a small lift: scale 1.0 → 1.06, translateY −12 px.
   - `80–560 ms` — travel to the left slot with `cubic-bezier(.16,.84,.24,1)` (~480 ms).
   - `540–780 ms` — settle overshoot (scale 1.06 → 1.0) with a soft spring.
   - In parallel, a **warm radial glow** (CSS radial-gradient, transparent edges — so still "no background") grows behind the item so it doesn't float on empty space.
   - Ambient: 6–10 tiny floating "steam"/leaf particles (CSS animated, ~200 ms, optional on low-end).
4. Closing reverses it: item flies back to the original card rect (the card may have turned pages — if so, fade out toward its remembered position instead), and the card image fades back in.

### 4.3 Right-side chat panel
- A vertical stack of messages that appear one after another (~90 ms stagger) with a soft rise + fade + slight scale-up 0.96→1.
- Structure (top → bottom):
  1. **Header bubble** — `Yoriko Sushi` avatar (a tiny CSS-drawn seal), name, "just now" / いらっしゃいませ.
  2. **Main bubble (received)** — the item's Japanese name large, romaji underneath, 2-line blurb, and tag chips (e.g. 生, 炙り, vegan).
  3. **Price bubble (received)** — `Rp …` large, with a smaller struck-through or "per piece"/"per set" note.
  4. **Buy button (sent/reply style)** — full-width pill aligned right, vermilion, with a subtle press ripple; label **"Buy — Rp 48.000"**. On buy it morphs to a checkmark + "Added to your slip" for 1.2 s, then returns to "Buy again" state (or stays "in slip" with a quantity stepper — your call, but keep it one tap).
  5. **Close chip** — small "×" or "Back to the book" text button, top-right of the panel; also `Esc` and click-outside-to-close.
- Chat bubble styling: washi-toned bubbles, asymmetric corner radii (the real chat look), tail on the first bubble only, thin 1 px hairline borders, no heavy shadows.
- Typing indicator (3 dots) for ~300 ms before the header bubble lands, for life.

### 4.4 Responsive behavior of the popup
- **≥ 1024 px:** item left ≈ 45% width, panel right ≈ 38% width with gutter spacing; item final rect is roughly `min(42vw, 520px)` square, vertically centered.
- **768–1023 px:** item 48% / panel 46%, tighter gaps, smaller typography via `clamp()`.
- **< 768 px (phones):** the item **stays high on the screen** (~40% height, centered horizontally) and the **chat panel becomes a bottom sheet** occupying the lower ~55% with a drag handle. Max 3 chat bubbles visible; internal scroll if needed. The fly-forward still happens (upwards + toward the camera), not a generic fade.
- **Landscape phones (height < 480 px):** reduce item size, keep the two-column layout with compact typography.
- Use `dvh` for heights, respect `env(safe-area-inset-*)`.

---

## 5. Cart / Order Slip

- A floating, collapsible **"slip"** (paper order ticket) anchored bottom-right (bottom bar on mobile) showing count + total.
- Adding an item slides a tiny row into the slip with a 3D flip-in; quantity +/−; remove.
- Empty state: "Your slip is empty — turn a page."
- Persist to `localStorage`.
- **Checkout** is simulated: a final slip summary with a "Confirm order" button → success animation using an ink-brush stamp (a `clip-path`/`mask` scale-in) reading 承知 (understood). No backend required; if one is available, describe the endpoint contract instead.
- Prices computed in integer smallest-unit (or cents) to avoid float drift.

---

## 6. Interaction & Micro-detail Checklist

- [ ] Cursor: `pointer` on interactive elements; hover state lifts a card by 2 px and shows a thin red corner bracket.
- [ ] Card hover lifts/tilts with a max 1.5° pointer-tracking tilt (desktop only, disabled on touch).
- [ ] Sound is **off by default**; if included, a single tiny page-turn click behind a mute toggle, ≤ 15 KB.
- [ ] Focus-visible ring on all controls (2 px vermilion, 2 px offset).
- [ ] Full keyboard flow: open book → navigate pages → Enter on card → Tab through bubbles → Buy → Esc closes.
- [ ] `aria-live="polite"` announces "Added Hon Maguro to your slip".
- [ ] Screen-reader friendly: the popup is a `role="dialog"` `aria-modal="true"` with focus trap and labelled title.
- [ ] No layout shift on load (reserve space, use `aspect-ratio`).
- [ ] No horizontal scroll at any width from 320 px up.

---

## 7. Responsiveness

Breakpoints: **320 / 390 / 480 / 768 / 1024 / 1280 / 1536+**.
- Fluid type and spacing via `clamp()` rather than dozens of breakpoints.
- The book scales with `min(92vw, 1100px, calc(100dvh - 180px) * 1.6)` style math so it always fits without cropping.
- Book collapse: on phones, page-turn angles reduce (`rotateY` still works), the gutter shadow softens, and the two-page spread becomes the full viewport width with slightly smaller type — do **not** shrink below legibility.
- Test in: iPhone SE (375×667), iPhone 14 (390×844), Pixel 7 (412×915), iPad (768×1024), 1440×900 laptop, 1920×1080.

---

## 8. Performance Budget (hard requirements)

This is the second half of the brief and is **non-negotiable**.

| Metric | Target |
|---|---|
| Initial JS (gzip) | **< 25 KB** total, ideally no framework (vanilla TS/JS) |
| Initial CSS (gzip) | **< 20 KB** |
| Images for first paint | **0** item PNGs; lazy-load on first page open |
| Largest Contentful Paint (mobile, Fast 3G) | **< 2.0 s** |
| Total Blocking Time | **< 150 ms** |
| CLS | **< 0.02** |
| Lighthouse mobile perf | **≥ 90** |
| Item PNG each | ≤ 80 KB, max 900 px, WebP + PNG fallback via `<picture>` |
| Fonts | ≤ 1 family, ≤ 2 weights, subset, `swap`, preloaded only if LCP-critical |

Implementation rules:
- **No React/Next/Vue/Tailwind runtime.** Vanilla JS + CSS. Build step optional (Vite) but output must be static files.
- Animate **only** `transform` and `opacity`. No JS-driven per-frame layout reads. Batch reads then writes (no layout thrashing). Use `requestAnimationFrame` and pointer-event throttling.
- Use `will-change` **only** on elements mid-animation, and remove it after (`transitionend`) so the compositor layer count stays low.
- Single `IntersectionObserver`/lazy list for item images; `loading="lazy"` + `decoding="async"`.
- Detect low-end devices (`navigator.hardwareConcurrency <= 4` or `deviceMemory <= 2`) → reduced particle count, shorter durations, grain overlay disabled, `backdrop-filter` never used on low-end.
- **`backdrop-filter` is banned** (including on iOS) — it is the #1 cause of mobile jank here, and the design already forbids a dimmed backdrop.
- Preload no more than 4 images; preload the next spread's images during idle (`requestIdleCallback`).
- Cache-busting hashed filenames; serve with long-lived caching headers (document it).
- Respect `prefers-reduced-motion`, `prefers-contrast`, and OS dark mode is **optional** — if implemented, use a "night ink" palette (indigo-black paper) rather than generic gray.

---

## 9. Assets

Because the popup depends on **background-less PNGs**, specify them explicitly:
- Each item: one **transparent PNG/WebP**, plate not included, item centered, ≥ 8% even padding, consistent top-down 3/4 lighting, soft contact shadow baked at ~10% opacity (or dropped entirely if it reads as a halo — prefer none, and add shadow in CSS with `filter: drop-shadow()`).
- Provide a **fallback**: if an asset fails to load, show a CSS-drawn abstract sushi (rice oval + topping capsule via `border-radius` + gradients) so nothing ever breaks or shifts.
- Use `aspect-ratio` containers + `width/height` attributes to prevent layout shift.
- Design tokens in `:root` so the whole palette can be re-skinned quickly.

---

## 10. Deliverables

- `index.html`
- `styles/` (tokens, base, book, popup, cart, responsive)
- `js/` (data, book engine, popup/FLIP, cart, a11y)
- `assets/` (item images + favicon)
- `README.md` with: how to run, performance budget results, browser support matrix, and a note on where to plug a real checkout endpoint.
- Working at 320 px → 1920 px, keyboard accessible, reduced-motion compliant.
- Produce it in **phases** if the work is large: (1) shell + tokens + book, (2) popup/FLIP, (3) cart, (4) polish/a11y, (5) perf audit with real Lighthouse numbers.

---

## 11. Acceptance Criteria (Definition of Done)

1. Book opens, turns smoothly by click, drag, keyboard, on desktop and by swipe on mobile.
2. Clicking any of the 12 items triggers the fly-forward with no dimmed background and no visible jank.
3. Popup shows item on the left and staggered chat bubbles on the right (phone: bottom sheet) with name, Japanese name, price, Buy.
4. Buy adds to the slip with correct totals, persists after refresh, and is reversible.
5. Lighthouse mobile ≥ 90, TBT < 150 ms, no horizontal overflow at 320 px.
6. Every animation degrades to a short fade under `prefers-reduced-motion`.
7. No 3rd-party JS; all images lazy; no console errors.
