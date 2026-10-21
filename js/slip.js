/* Order slip: persisted cart, quantity steppers, totals, demo checkout. */
import { $, fmt, ITEMS } from './data.js';

const KEY = 'yoriko.slip.v1';

export class Slip {
  constructor({ onChange }) {
    this.onChange = onChange;
    this.items = this.load();
    this.node = $('#slip');
    this.list = $('#slipList');
    this.empty = $('#slipEmpty');
    this.total = $('#slipTotal');
    this.checkout = $('#checkout');
    this.scrim = $('#slipScrim');
    this.toggle = $('#slipToggle');
    this.count = $('#slipToggleCount');
    this.stamp = $('#stamp');
    this.byId = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

    this.bind();
    this.render();
  }

  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw
        .map((r) => ({ id: String(r.id), qty: Math.max(1, Math.min(99, Number(r.qty) | 0)) }))
        .filter((r) => this.byId?.[r.id] || ITEMS.some((i) => i.id === r.id));
    } catch { return []; }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.items)); } catch { /* private mode */ }
  }

  sum() {
    return this.items.reduce((n, r) => n + (ITEMS.find((i) => i.id === r.id)?.price || 0) * r.qty, 0);
  }
  qty() { return this.items.reduce((n, r) => n + r.qty, 0); }

  add(id) {
    const found = this.items.find((r) => r.id === id);
    if (found) found.qty = Math.min(99, found.qty + 1);
    else this.items.push({ id, qty: 1 });
    this.save();
    this.render(id);
    return this.byId[id] || ITEMS.find((i) => i.id === id);
  }

  setQty(id, qty) {
    const r = this.items.find((x) => x.id === id);
    if (!r) return;
    if (qty <= 0) this.items = this.items.filter((x) => x.id !== id);
    else r.qty = Math.min(99, qty);
    this.save();
    this.render();
  }

  clear() {
    this.items = [];
    this.save();
    this.render();
  }

  render(bumpId) {
    const n = this.items.length;

    this.list.replaceChildren(...this.items.map((row) => {
      const it = ITEMS.find((i) => i.id === row.id);
      if (!it) return document.createDocumentFragment();
      const li = document.createElement('li');
      li.className = 'slip__item';
      li.dataset.id = row.id;
      li.innerHTML = `
        <img src="assets/${it.id}.png" alt="" width="44" height="44" loading="lazy" decoding="async">
        <div>
          <div class="slip__name">${it.name}</div>
          <div class="slip__jp">${it.jp} · ${fmt(it.price)}</div>
        </div>
        <div class="slip__line">
          <div class="slip__qty">
            <button type="button" data-act="dec" aria-label="One less ${it.name}">−</button>
            <span aria-live="polite">${row.qty}</span>
            <button type="button" data-act="inc" aria-label="One more ${it.name}">+</button>
          </div>
          <span class="slip__sum">${fmt(it.price * row.qty)}</span>
        </div>`;
      if (bumpId && it.id === bumpId) li.style.animation = 'none', void li.offsetWidth;
      return li;
    }));

    this.list.hidden = n === 0;
    this.empty.hidden = n !== 0;
    this.total.textContent = fmt(this.sum());
    this.checkout.disabled = n === 0;

    const q = this.qty();
    this.count.textContent = String(q);
    this.count.dataset.empty = q === 0 ? 'true' : 'false';
    if (q > 0) {
      this.count.classList.remove('bump');
      void this.count.offsetWidth;
      this.count.classList.add('bump');
      setTimeout(() => this.count.classList.remove('bump'), 320);
    }
    this.onChange?.(this);
  }

  bind() {
    this.list.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id = btn.closest('.slip__item').dataset.id;
      const row = this.items.find((r) => r.id === id);
      if (!row) return;
      this.setQty(id, row.qty + (btn.dataset.act === 'inc' ? 1 : -1));
    });

    this.toggle.addEventListener('click', () => this.setOpen(this.node.dataset.open !== 'true'));
    $('#slipClose').addEventListener('click', () => this.setOpen(false));
    this.scrim.addEventListener('click', () => this.setOpen(false));
    this.checkout.addEventListener('click', () => this.confirm());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.node.dataset.open === 'true') this.setOpen(false);
    });
  }

  setOpen(open) {
    this.node.dataset.open = open ? 'true' : 'false';
    this.node.setAttribute('aria-hidden', open ? 'false' : 'true');
    this.toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    this.scrim.hidden = !open;
    if (open) $('#slipClose').focus({ preventScroll: true });
  }

  confirm() {
    if (!this.items.length) return;
    const total = this.sum();
    this.setOpen(false);
    this.stamp.hidden = false;
    const en = this.stamp.querySelector('.stamp__en');
    en.textContent = `Order received · ${fmt(total)}`;
    setTimeout(() => {
      this.stamp.hidden = true;
      this.clear();
      en.textContent = 'Order received';
    }, 2000);
  }
}
