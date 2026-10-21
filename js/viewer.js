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

    // the launch box: the card's plate if we have one, else the row itself
    const img = anchor.querySelector?.('.card__img') ?? null;
    const from = img ? img.getBoundingClientRect() : anchor.getBoundingClientRect();
    const src = `assets/${item.id}.png`;

    // fill content first (hidden) so measurements are stable
    this.fill(item);

    const to = this.stageRect();

    // place the fly layer exactly over the source
    this.flyImg.src = src;
    this.flyImg.alt = item.name;
    this.setFlyBox(from);

    this.node.hidden = false;
    this.node.dataset.state = 'opening';
    document.body.classList.add('is-viewing');
    anchor.classList.add('is-lifted');

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    if (this.closingEarly) return;

    const reduce = reduceMotion.matches;
    const dur = reduce ? 120 : 560 * D;

    // FLIP: from card rect -> stage rect, with a forward "lift" at the start.
    // `to` is already a top-left box, so compare centres explicitly.
    const tx = (to.x + to.width / 2) - (from.left + from.width / 2);
    const ty = (to.y + to.height / 2) - (from.top + from.height / 2);
    const s = to.size / Math.max(1, Math.min(from.width, from.height));

    const frames = reduce
      ? [
          { transform: 'translate3d(0,0,0) scale(1)', opacity: 1 },
          { transform: `translate3d(${tx}px,${ty}px,0) scale(${s})`, opacity: 1 },
        ]
      : [
          { transform: 'translate3d(0,0,0) scale(1) rotateZ(0deg)', opacity: 1 },
          { transform: 'translate3d(0,-2.4vh,0) scale(1.07) rotateZ(-1.2deg)', opacity: 1, offset: 0.2 },
          { transform: `translate3d(${tx}px,${ty}px,0) scale(${s}) rotateZ(0.5deg)`, opacity: 1, offset: 0.86 },
          { transform: `translate3d(${tx}px,${ty}px,0) scale(${s}) rotateZ(0deg)`, opacity: 1 },
        ];

    const anim = this.fly.animate(frames, {
      duration: dur,
      easing: 'cubic-bezier(.16,.84,.24,1)',
      fill: 'both',
    });

    this.node.dataset.state = 'open';

    // chat lands while the dish is still travelling
    const stagger = reduce ? 20 : 95 * D;
    const lead = reduce ? 0 : 250 * D;
    this.playChat(lead, stagger);

    try { await anim.finished; } catch { /* interrupted */ }
    if (!this.open) return;

    // hand the flying dish over to its resting box, in this exact order
    anim.cancel();
    this.setFlyBox(to);
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

    const card = this.card;
    const img = card?.querySelector('.card__img') ?? null;
    const reduce = reduceMotion.matches || immediate;
    const dur = reduce ? 120 : 420 * D;

    // where the dish currently rests, and where it should land
    const from = this.stageRect();
    const target = img && card && document.contains(card) ? img.getBoundingClientRect() : null;

    if (target) {
      const tx = target.left + target.width / 2 - (from.x + from.width / 2);
      const ty = target.top + target.height / 2 - (from.y + from.height / 2);
      const s = Math.min(target.width, target.height) / from.size;

      const frames = [
        { transform: 'translate3d(0,0,0) scale(1)', opacity: 1 },
        { transform: `translate3d(${tx * 0.15}px,${ty * 0.15}px,0) scale(${1.04})`, opacity: 1, offset: 0.25 },
        { transform: `translate3d(${tx}px,${ty}px,0) scale(${s})`, opacity: 0.9 },
      ];
      try {
        await this.fly.animate(frames, { duration: dur, easing: EASE.inOut, fill: 'forwards' }).finished;
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
