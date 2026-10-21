/* Book engine — paper sheets hinged on the spine; click, drag or key to turn.
 *
 * Every sheet is half a book wide and hinged on its own left edge (the spine).
 * Its FRONT face is a right-hand page; once the sheet has turned -180deg its
 * BACK face lies on the left. So spread n = back of sheet n-1 | front of sheet n:
 *
 *   spread 0   (closed)            | cover
 *   spread 1   welcome endpaper    | contents
 *   spread 2   nigiri list         | nigiri plates
 *   spread 3   maki list           | maki plates
 *   spread 4   specials list       | specials plates
 *   spread 5   good-to-know notes  | thank-you (static back board)
 *
 * Rendering is engine-proof by construction: each sheet is its OWN 3D context
 * (`perspective()` lives in its transform), so sheets never depth-sort against
 * each other and plain z-index decides the order — identical in Firefox,
 * Chromium and WebKit. Inside a sheet, `backface-visibility: hidden` picks the
 * face, so the mirrored side can never bleed through.
 */
import { $, $$, el, fmt, ITEMS, CATS, reduceMotion } from './data.js';

const TURN_MS = reduceMotion.matches ? 170 : 820;
const PERSPECTIVE = 2600;
const EPS = 0.0005;

export class Book {
  constructor({ root, leaves, onPick, onChange }) {
    this.root = root;
    this.holder = leaves;
    this.onPick = onPick;
    this.onChange = onChange;

    this.cards = new Map();
    this.progress = 0;
    this.current = 0;
    this.target = 0;
    this.tweening = false;
    this.dragging = false;
    this.justDragged = false;
    this.raf = 0;
    this.waiters = [];
    this.lastReported = -1;
    this.interactiveFor = -1;

    this.board = $('#bookBoard', root);
    this.shadow = $('.book__shadow', root);
    this.build();
    this.sheets = $$(':scope > .leaf', this.holder);
    this.faces = this.sheets.map((s) => ({
      front: s.querySelector(':scope > .face--front'),
      back: s.querySelector(':scope > .face--back'),
    }));
    this.labels = ['Cover', 'Contents', ...CATS.map((c) => c.romaji), 'Thank you'];

    this.wireClicks();
    this.bind();
    this.render();
  }

  /** number of turns: one per sheet (the cover included) */
  get total() { return this.sheets.length; }
  get animating() { return this.tweening || this.dragging; }
  /** where the book is heading — lets quick repeated presses chain turns */
  get heading() { return this.tweening ? this.target : this.current; }
  /** spreads that carry dishes (used by the hint) */
  hasDishes(spread) { return spread >= 2 && spread < 2 + CATS.length; }

  /* ------------------------------------------------------------------ build */
  build() {
    const byCat = (i) => ITEMS.filter((it) => it.cat === i);
    // page numbers run 1..8 from the contents page on
    const fronts = [this.contentsPage(1), ...CATS.map((_, i) => this.platesPage(i, byCat(i), 3 + 2 * i))];
    const backs = [...CATS.map((_, i) => this.listPage(i, byCat(i), 2 + 2 * i)), this.notesPage(2 + 2 * CATS.length)];

    const frag = document.createDocumentFragment();
    fronts.forEach((front, k) => {
      frag.append(el('div', { class: 'leaf', 'data-sheet': String(k + 1) },
        el('article', { class: 'face face--front leaf__page leaf__page--right' }, ...front),
        el('article', { class: 'face face--back leaf__page leaf__page--left' }, ...backs[k])
      ));
    });
    this.holder.append(frag);
  }

  pageHead(no, title, jp, note) {
    return el('header', { class: 'page-head' },
      el('div', { class: 'page-head__row' },
        el('span', { class: 'page-head__no', text: pad(no), 'aria-hidden': 'true' }),
        el('h2', { class: 'page-head__title' },
          title,
          jp ? el('span', { class: 'page-head__jp', lang: 'ja', text: jp }) : null
        )
      ),
      note ? el('p', { class: 'page-head__note', text: note }) : null,
      el('div', { class: 'page-head__rule' })
    );
  }

  pageFoot(left, no) {
    return el('footer', { class: 'page-foot' },
      el('span', { text: left }),
      el('span', { text: `Yoriko · ${pad(no)}` })
    );
  }

  /** right page of spread 1 — each row jumps to its category */
  contentsPage(no) {
    return [
      this.pageHead(no, 'Contents', '献立', 'Three courses, pressed to order.'),
      el('ul', { class: 'menu-list menu-list--contents', 'aria-label': 'Contents' },
        ...CATS.map((cat, i) => el('li', {},
          el('button', { class: 'menu-row', type: 'button', 'data-goto': String(2 + i) },
            el('span', { class: 'menu-row__no', text: pad(i + 1) }),
            el('span', { class: 'menu-row__name-wrap' },
              el('span', { class: 'menu-row__name', text: cat.romaji }),
              el('span', { class: 'menu-row__jp', lang: 'ja', text: cat.jp })
            ),
            el('span', { class: 'menu-row__price', text: `p. ${2 + 2 * i}` })
          )
        ))
      ),
      el('p', { class: 'page-tip', text: 'Turn with the arrows, a swipe, or a tap on the page edge.' }),
      this.pageFoot('御献立', no),
    ];
  }

  /** left page — the category as a printed price list */
  listPage(catIndex, items, no) {
    const cat = CATS[catIndex];
    return [
      this.pageHead(no, cat.romaji, cat.jp, cat.note),
      el('ul', { class: 'menu-list', 'aria-label': `${cat.romaji} — names and prices` },
        ...items.map((it, i) => el('li', {},
          el('button', { class: 'menu-row', type: 'button', 'data-id': it.id, 'aria-label': `${it.name}, ${fmt(it.price)}` },
            el('span', { class: 'menu-row__no', text: pad(i + 1) }),
            el('span', { class: 'menu-row__name-wrap' },
              el('span', { class: 'menu-row__name', text: it.name }),
              el('span', { class: 'menu-row__jp', lang: 'ja', text: it.jp })
            ),
            el('span', { class: 'menu-row__price', text: fmt(it.price) })
          )
        ))
      ),
      this.pageFoot(`${cat.romaji} · ${items.length} items`, no),
    ];
  }

  /** right page — the dish plates, each of which lifts off the page */
  platesPage(catIndex, items, no) {
    const cat = CATS[catIndex];
    return [
      this.pageHead(no, cat.romaji, cat.jp, 'Tap a dish to lift it off the page.'),
      el('div', { class: 'grid', role: 'group', 'aria-label': `${cat.romaji} dishes` },
        ...items.map((it) => this.makeCard(it))
      ),
      this.pageFoot(cat.romaji, no),
    ];
  }

  /** left page of the last spread */
  notesPage(no) {
    const notes = [
      ['Pieces', 'Nigiri are served as two pieces; rolls and specials per set.'],
      ['Allergies', 'Soy, sesame, shellfish and fish are used throughout. Tell us and we adapt.'],
      ['Rice', 'Koshihikari, seasoned with aged red vinegar. Gluten-free tamari on request.'],
      ['Prices', 'In rupiah, including tax. No service charge.'],
    ];
    return [
      this.pageHead(no, 'Good to know', '御案内', null),
      el('dl', { class: 'notes' },
        ...notes.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })])
      ),
      this.pageFoot('御案内', no),
    ];
  }

  makeCard(it) {
    const card = el('button', {
      class: 'card', type: 'button',
      'aria-label': `${it.name}, ${it.jp}, ${fmt(it.price)}`,
      'data-id': it.id,
    },
      el('span', { class: 'card__bracket', 'aria-hidden': 'true' }),
      el('span', { class: 'card__img-wrap' },
        el('img', {
          class: 'card__img', src: `assets/${it.id}.png`, alt: '',
          width: '560', height: '560', decoding: 'async', draggable: 'false',
        })
      ),
      el('span', { class: 'card__body' },
        el('span', { class: 'card__name', text: it.name }),
        el('span', { class: 'card__price', text: fmt(it.price) })
      )
    );
    this.cards.set(it.id, card);
    return card;
  }

  /* ----------------------------------------------------------------- clicks */
  wireClicks() {
    this.root.addEventListener('click', (e) => {
      if (this.justDragged || this.animating) return;
      const t = e.target;

      const goto = t.closest('[data-goto]');
      if (goto) { this.go(Number(goto.dataset.goto)); return; }

      const pick = t.closest('.card, .menu-row');
      if (pick?.dataset.id) {
        const item = ITEMS.find((i) => i.id === pick.dataset.id);
        if (item) this.onPick?.(item, pick);
        return;
      }
      if (t.closest('button, a')) return;

      // the closed cover opens on any tap; an open book turns from its edges
      if (this.current === 0) { this.next(); return; }
      const r = this.root.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      if (x > 0.86) this.next();
      else if (x < 0.14) this.prev();
    });

    // a gentle tilt under the mouse — cards only, never while turning
    this.root.addEventListener('pointermove', (e) => {
      const card = e.target.closest?.('.card');
      if (!card || e.pointerType !== 'mouse' || reduceMotion.matches || this.animating) return;
      const r = card.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(700px) rotateY(${dx * 3}deg) rotateX(${-dy * 3}deg) translateY(-2px)`;
    });
    this.root.addEventListener('pointerout', (e) => {
      const card = e.target.closest?.('.card');
      if (card && !card.contains(e.relatedTarget)) card.style.transform = '';
    });
  }

  /* ----------------------------------------------------------------- render */
  render() {
    const n = this.total;
    const p = this.progress;
    const base = Math.floor(clamp(p, 0, n));

    this.sheets.forEach((sheet, i) => {
      const local = clamp(p - i);
      const turned = local > 1 - EPS;
      const turning = local > EPS && !turned;

      sheet.style.transform = `perspective(${PERSPECTIVE}px) rotateY(${(-180 * local).toFixed(3)}deg)`;
      // swap faces when the sheet is edge-on, so the swap itself is invisible
      sheet.dataset.up = local > 0.5 ? 'back' : 'front';
      sheet.style.setProperty('--shade', turning ? (Math.sin(Math.PI * local) * 0.5).toFixed(3) : '0');
      // the sheet in flight is on top; turned sheets stack upward (latest on
      // top); unturned sheets stack downward (nearest on top)
      sheet.style.zIndex = String(turning ? 10 + 2 * n : turned ? 10 + i : 10 + 2 * n - 1 - i);
      // only the sheets that can be seen are painted: the two facing pages
      // plus whatever a turn is about to reveal
      sheet.style.visibility = i >= base - 1 && i <= base + 1 ? '' : 'hidden';
    });

    // closed, only the cover (the right half) is there — slide it to centre
    const open = clamp(p);
    this.root.style.transform = open < 1 ? `translateX(${(-25 * (1 - open)).toFixed(3)}%)` : '';
    if (this.shadow) this.shadow.style.transform = `scaleX(${(1 + open).toFixed(4)})`;
    this.root.dataset.open = String(p > EPS);

    this.current = Math.round(clamp(p, 0, n));
    if (Math.abs(p - this.current) < EPS) this.syncInteractive(this.current);

    const report = this.heading;
    if (report !== this.lastReported) {
      this.lastReported = report;
      this.onChange?.(report, n, this);
    }
  }

  /** only the two facing pages can be focused or clicked */
  syncInteractive(spread) {
    if (spread === this.interactiveFor) return;
    this.interactiveFor = spread;
    const left = spread > 0 ? this.faces[spread - 1].back : null;
    const right = spread < this.total ? this.faces[spread].front : this.board;
    this.faces.forEach(({ front, back }) => {
      front.inert = front !== right;
      back.inert = back !== left;
    });
    if (this.board) this.board.inert = this.board !== right;
  }

  /* ------------------------------------------------------------------ turns */
  /** animate to a spread; calling again mid-turn simply retargets */
  go(target) {
    const to = clamp(Math.round(target), 0, this.total);
    const from = this.progress;
    const dist = Math.abs(to - from);
    cancelAnimationFrame(this.raf);
    this.target = to;

    if (dist < EPS) {
      this.tweening = false;
      this.progress = to;
      this.render();
      this.flush();
      return Promise.resolve();
    }

    this.tweening = true;
    // one full turn = TURN_MS; short snaps are quicker, long jumps don't drag on
    const ms = TURN_MS * (dist <= 1 ? 0.35 + 0.65 * dist : 1 + 0.3 * (dist - 1));
    const t0 = performance.now();
    const promise = new Promise((resolve) => this.waiters.push(resolve));

    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      this.progress = from + (to - from) * easeInOut(t);
      if (t < 1) {
        this.render();
        this.raf = requestAnimationFrame(step);
      } else {
        this.progress = to;
        this.tweening = false;
        this.render();
        this.flush();
      }
    };
    this.raf = requestAnimationFrame(step);
    return promise;
  }

  flush() {
    const w = this.waiters;
    this.waiters = [];
    w.forEach((r) => r());
  }

  next() { return this.go(this.heading + 1); }
  prev() { return this.go(this.heading - 1); }
  open() { return this.go(1); }
  close() { return this.go(0); }
  cardFor(id) { return this.cards.get(id) || null; }

  /* ------------------------------------------------------------------- drag */
  bind() {
    const host = this.root;
    let drag = null;

    host.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { x0: e.clientX, y0: e.clientY, base: 0, active: false, id: e.pointerId, w: host.clientWidth };
    });

    host.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      if (!drag.active) {
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
        // take over from wherever the book is, even mid-turn
        cancelAnimationFrame(this.raf);
        this.tweening = false;
        drag.active = true;
        drag.base = this.progress;
        drag.x0 = e.clientX;
        this.dragging = true;
        this.justDragged = true;
        host.classList.add('is-dragging');
        try { host.setPointerCapture(drag.id); } catch { /* not capturable */ }
        return;
      }
      // dragging one page width = one full turn
      const n = this.total;
      let p = drag.base - dx / Math.max(120, drag.w * 0.5);
      if (p < 0) p *= 0.25;
      if (p > n) p = n + (p - n) * 0.25;
      this.progress = p;
      this.target = clamp(Math.round(p), 0, n);
      this.render();
    });

    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      if (!d.active) return;
      host.classList.remove('is-dragging');
      try { host.releasePointerCapture(d.id); } catch { /* already released */ }
      this.dragging = false;
      // a deliberate flick commits to the next page in that direction
      const dist = e.clientX - d.x0;
      let target = Math.round(this.progress);
      if (Math.abs(dist) > d.w * 0.06) {
        target = dist < 0 ? Math.ceil(this.progress - 0.08) : Math.floor(this.progress + 0.08);
      }
      this.go(target);
      setTimeout(() => { this.justDragged = false; }, 160);
    };
    host.addEventListener('pointerup', end);
    host.addEventListener('pointercancel', end);
  }
}

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const pad = (n) => String(n).padStart(2, '0');
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
