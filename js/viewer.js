/* Item viewer: the dish flies forward off the page (FLIP), chat panel follows. */
import { $, fmt, EASE, reduceMotion, media, lowPower, ITEMS } from './data.js';

const D = lowPower ? 0.86 : 1;            // global speed factor

export class Viewer {
  constructor({ book, onBuy }) {
    this.book = book;
    this.onBuy = onBuy;
    this.node = $('#viewer');
    this.fly = $('#fly');
    this.flyImg = $('#flyImg');
    this.chat = $('#chat');
    this.stage = $('.viewer__stage');
    this.item = null;
    this.card = null;
    this.cards = [];
    this.open = false;
    this.lastFocus = null;
    this.timers = [];

    this.els = {
      jp: $('#viewerJp'), romaji: $('#viewerRomaji'), title: $('#viewerTitle'),
      blurb: $('#viewerBlurb'), tags: $('#viewerTags'), price: $('#viewerPrice'),
      unit: $('#viewerUnit'), buy: $('#buy'), close: $('#viewerClose'),
    };
    this.msgs = Array.from(this.node.querySelectorAll('.msg'));
    this.bind();
  }

  bind() {
    this.els.close.addEventListener('click', () => this.close());
    this.els.buy.addEventListener('click', (e) => this.buy(e));

    this.node.addEventListener('click', (e) => {
      // only clicks on empty space close (bubbles are inert but shouldn't close)
      if (e.target.closest('.chat, .fly')) return;
      this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
      if (e.key === 'Tab') this.trap(e);
    });

    // if the viewport becomes a phone layout mid-view, re-seat the dish
    window.addEventListener('resize', () => { if (this.open) this.seat(true); });
  }

  trap(e) {
    const f = this.node.querySelectorAll('button:not([disabled])');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- target rectangles ---------- */
  /** the resting box of the dish, in viewport centre coordinates */
  stageRect() {
    const r = this.stage.getBoundingClientRect();
    const size = Math.min(r.width, r.height) * 0.92;
    return {
      x: r.left + r.width / 2 - size / 2,
      y: r.top + r.height / 2 - size / 2,
      width: size,
      height: size,
      size,
    };
  }

  chatRect() {
    return this.chat.getBoundingClientRect();
  }

  /* ---------- open ---------- */
  async openItem(item, anchor) {
    if (this.open) await this.close(true);
    this.open = true;
    this.item = item;
    this.card = anchor;
    this.lastFocus = document.activeElement;

    // Unhide first so stage measurements and layout are accurate
    this.node.hidden = false;
    this.node.dataset.state = 'opening';
    this.fill(item);

    // the launch box: the card's plate if we have one, else a neat square from the menu row
    const img = anchor.querySelector?.('.card__img') ?? null;
    let from;
    if (img) {
      from = img.getBoundingClientRect();
    } else {
      const r = anchor.getBoundingClientRect();
      const s = Math.min(r.height * 1.6, 52);
      from = {
        left: r.left + 20,
        top: r.top + r.height / 2 - s / 2,
        width: s,
        height: s,
      };
    }
    const src = `assets/${item.id}.png`;

    const to = this.stageRect();

    // place the fly layer exactly over the source
    this.flyImg.src = src;
    this.flyImg.alt = item.name;
    this.setFlyBox(from);

    document.body.classList.add('is-viewing');
    anchor.classList.add('is-lifted');

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    if (this.closingEarly) return;

    const reduce = reduceMotion.matches;
    const dur = reduce ? 120 : 660 * D;

    // FLIP: from card rect -> stage rect, with a physical arched flight
    const cxFrom = from.left + from.width / 2;
    const cyFrom = from.top + from.height / 2;
    const cxTo = to.x + to.width / 2;
    const cyTo = to.y + to.height / 2;
    const s = to.size / Math.max(1, Math.min(from.width, from.height));

    const startX = from.left;
    const startY = from.top;
    const endX = cxTo - from.width / 2;
    const endY = cyTo - from.height / 2;
    const dx = endX - startX;
    const dy = endY - startY;

    const frames = reduce
      ? [
          { transform: `translate3d(${startX}px,${startY}px,0) scale(1)`, opacity: 1 },
          { transform: `translate3d(${endX}px,${endY}px,0) scale(${s})`, opacity: 1 },
        ]
      : [
          {
            transform: `translate3d(${startX}px,${startY}px,0) scale(1) rotate(0deg)`,
            filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.3))',
            opacity: 1,
            offset: 0,
          },
          {
            transform: `translate3d(${startX + dx * 0.08}px, ${startY + dy * 0.08 - 32}px, 0) scale(1.16) rotate(-3.5deg)`,
            filter: 'drop-shadow(0 20px 32px rgba(0,0,0,0.5))',
            opacity: 1,
            offset: 0.18,
          },
          {
            transform: `translate3d(${startX + dx * 0.48}px, ${startY + dy * 0.44 - 18}px, 0) scale(${1 + (s - 1) * 0.65}) rotate(2deg)`,
            filter: 'drop-shadow(0 28px 45px rgba(0,0,0,0.6))',
            opacity: 1,
            offset: 0.52,
          },
          {
            transform: `translate3d(${startX + dx * 0.88}px, ${startY + dy * 0.88 - 3}px, 0) scale(${s * 1.04}) rotate(-0.8deg)`,
            filter: 'drop-shadow(0 22px 35px rgba(0,0,0,0.5))',
            opacity: 1,
            offset: 0.82,
          },
          {
            transform: `translate3d(${startX + dx * 0.98}px, ${startY + dy * 0.99}px, 0) scale(${s * 1.01}) rotate(0.2deg)`,
            filter: 'drop-shadow(0 18px 28px rgba(0,0,0,0.45))',
            opacity: 1,
            offset: 0.94,
          },
          {
            transform: `translate3d(${endX}px,${endY}px,0) scale(${s}) rotate(0deg)`,
            filter: 'drop-shadow(0 16px 26px rgba(0,0,0,0.4))',
            opacity: 1,
            offset: 1,
          },
        ];

    const anim = this.fly.animate(frames, {
      duration: dur,
      easing: 'cubic-bezier(.22,.61,.36,1)',
      fill: 'both',
    });

    this.node.dataset.state = 'open';

    // chat lands while the dish is still travelling
    const stagger = reduce ? 20 : 90 * D;
    const lead = reduce ? 0 : 220 * D;
    this.playChat(lead, stagger);

    try { await anim.finished; } catch { /* interrupted */ }
    if (!this.open) return;

    // hand the flying dish over to its resting box, in this exact order
    anim.cancel();
    this.setFlyBox(to);
    if (!reduce) this.fly.classList.add('is-floating');
  }

  seat(resize = false) {
    const to = this.stageRect();
    this.setFlyBox(to);
  }

  setFlyBox(rect) {
    const w = rect.width ?? (rect.right - rect.left);
    const h = rect.height ?? (rect.bottom - rect.top);
    const x = rect.x ?? rect.left;
    const y = rect.y ?? rect.top;
    this.fly.style.width = `${w}px`;
    this.fly.style.height = `${h}px`;
    this.fly.style.transform = `translate3d(${x}px,${y}px,0)`;
  }

  fill(item) {
    const e = this.els;
    e.jp.textContent = item.jp;
    e.romaji.textContent = item.romaji;
    e.title.textContent = item.name;
    e.blurb.textContent = item.blurb;
    e.tags.replaceChildren(...item.tags.map((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      return li;
    }));
    e.price.textContent = fmt(item.price);
    e.unit.textContent = item.cat === 0 ? '· two pieces' : '· per set';
    e.buy.dataset.state = '';
    e.buy.disabled = false;
    e.buy.setAttribute('aria-label', `Buy ${item.name}, ${fmt(item.price)}`);
    e.buy.innerHTML = `<span class="buy__label">Buy — ${fmt(item.price)}</span><span class="buy__ripple" aria-hidden="true"></span>`;

    const specPortion = $('#specPortion');
    if (specPortion) {
      specPortion.textContent = item.cat === 0 ? '2 Pieces · 握り' : (item.tags[0] || '1 Set · 御品');
    }
    const specRice = $('#specRice');
    if (specRice) {
      specRice.textContent = item.cat === 1 ? 'Ise Bay Nori · 海苔' : 'Akazu Red Vinegar · 赤酢';
    }
  }

  playChat(lead, stagger) {
    this.msgs.forEach((m) => m.classList.remove('is-in'));
    this.msgs.forEach((m, i) => {
      const t = setTimeout(() => {
        m.classList.add('is-in');
        // the typing bubble hands over to the first real message
        if (m.classList.contains('msg--typing')) {
          setTimeout(() => m.classList.add('is-done'), 320);
        }
      }, lead + i * stagger);
      this.timers.push(t);
    });
    const focusAt = lead + stagger * 2;
    this.timers.push(setTimeout(() => this.els.title.focus({ preventScroll: true }), focusAt));
  }

  clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  /* ---------- buy ---------- */
  buy(e) {
    if (!this.item) return;
    const btn = this.els.buy;
    const r = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'buy__ripple rippling';
    const size = Math.max(r.width, r.height);
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${(e.clientX || r.left + r.width / 2) - r.left - size / 2}px;top:${(e.clientY || r.top + r.height / 2) - r.top - size / 2}px`;
    btn.append(ripple);
    setTimeout(() => ripple.remove(), 650);

    this.onBuy?.(this.item);

    btn.dataset.state = 'added';
    btn.innerHTML = `<span class="buy__label"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6.5"/></svg>Added to your slip</span>`;
    clearTimeout(this.buyTimer);
    this.buyTimer = setTimeout(() => {
      if (!this.open) return;
      this.fill(this.item);
      btn.dataset.state = '';
      btn.innerHTML = `<span class="buy__label">Buy again — ${fmt(this.item.price)}</span><span class="buy__ripple" aria-hidden="true"></span>`;
    }, 1500);
  }

  /* ---------- close ---------- */
  async close(immediate = false) {
    if (!this.open) return;
    this.open = false;
    this.closingEarly = true;
    this.clearTimers();
    clearTimeout(this.buyTimer);
    this.node.dataset.state = 'closing';
    this.fly.classList.remove('is-floating');

    const card = this.card;
    const img = card?.querySelector('.card__img') ?? null;
    const reduce = reduceMotion.matches || immediate;
    const dur = reduce ? 120 : 460 * D;

    // where the dish currently rests, and where it should land
    const from = this.stageRect();
    const target = img && card && document.contains(card) ? img.getBoundingClientRect() : null;

    if (target) {
      const cxEnd = target.left + target.width / 2;
      const cyEnd = target.top + target.height / 2;
      const s = Math.min(target.width, target.height) / from.size;

      const startX = from.x;
      const startY = from.y;
      const endX = cxEnd - from.width / 2;
      const endY = cyEnd - from.height / 2;
      const dx = endX - startX;
      const dy = endY - startY;

      const frames = reduce
        ? [
            { transform: `translate3d(${startX}px,${startY}px,0) scale(1)`, opacity: 1 },
            { transform: `translate3d(${endX}px,${endY}px,0) scale(${s})`, opacity: 0.9 },
          ]
        : [
            {
              transform: `translate3d(${startX}px,${startY}px,0) scale(1) rotate(0deg)`,
              filter: 'drop-shadow(0 16px 26px rgba(0,0,0,0.4))',
              opacity: 1,
            },
            {
              transform: `translate3d(${startX + dx * 0.15}px,${startY + dy * 0.15 - 14}px,0) scale(1.05) rotate(2deg)`,
              filter: 'drop-shadow(0 24px 36px rgba(0,0,0,0.5))',
              opacity: 1,
              offset: 0.22,
            },
            {
              transform: `translate3d(${startX + dx * 0.62}px,${startY + dy * 0.6 - 8}px,0) scale(${s * 1.1}) rotate(-1.5deg)`,
              filter: 'drop-shadow(0 18px 26px rgba(0,0,0,0.4))',
              opacity: 0.98,
              offset: 0.65,
            },
            {
              transform: `translate3d(${endX}px,${endY}px,0) scale(${s}) rotate(0deg)`,
              filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.3))',
              opacity: 0.9,
            },
          ];
      try {
        await this.fly.animate(frames, { duration: dur, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' }).finished;
      } catch { /* noop */ }
    } else {
      await this.fly.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur, fill: 'forwards' }).finished;
    }

    this.fly.style.visibility = 'hidden';
    if (card) card.classList.remove('is-lifted');
    this.node.hidden = true;
    this.node.dataset.state = '';
    document.body.classList.remove('is-viewing');
    this.msgs.forEach((m) => m.classList.remove('is-in'));
    this.fly.getAnimations().forEach((a) => a.cancel());
    this.fly.style.visibility = '';
    this.closingEarly = false;
    this.item = null;
    this.card = null;
    this.lastFocus?.focus?.({ preventScroll: true });
  }
}
