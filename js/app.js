/* Yoriko Sushi — app wiring. Vanilla ES modules, no dependencies. */
import { $, $$, lowPower, reduceMotion, idle, CATS, ITEMS } from './data.js';
import { Book } from './book.js';
import { Viewer } from './viewer.js';
import { Slip } from './slip.js';

const bookEl = $('#bookEl');
const leaves = $('#leaves');
const toastEl = $('#toast');
const dotsEl = $('#dots');
const prevBtn = $('#prevPage');
const nextBtn = $('#nextPage');
let toastTimer = 0;

function toast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2200);
}

/* ---- slip ---- */
const slip = new Slip({});

/* ---- viewer + book ---- */
let viewer;
const book = new Book({
  root: bookEl,
  leaves,
  // called from the constructor too, so it gets the instance passed in
  onChange: (i, total, bk) => syncChrome(i, total, bk),
  onPick: (item, card) => viewer?.openItem(item, card),
});

viewer = new Viewer({
  book,
  onBuy: (item) => {
    slip.add(item.id);
    toast(`${item.name} added — ${slip.qty()} in your slip`);
  },
});

/* ---- chrome: arrows, dots, hint ---- */
function buildDots(total, bk) {
  dotsEl.replaceChildren(...Array.from({ length: total + 1 }, (_, i) => {
    const b = document.createElement('button');
    b.className = 'dot';
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', bk.labels[i] ?? `Spread ${i}`);
    b.addEventListener('click', () => bk.go(i));
    return b;
  }));
}

function syncChrome(current, total, bk) {
  if (dotsEl.children.length !== total + 1) buildDots(total, bk);
  $$('.dot', dotsEl).forEach((d, i) => d.setAttribute('aria-selected', i === current ? 'true' : 'false'));
  prevBtn.disabled = current <= 0;
  nextBtn.disabled = current >= total;

  // the hint only makes sense on spreads that carry dishes
  $('#hint').classList.toggle('is-off', !bk.hasDishes(current));
}

prevBtn.addEventListener('click', () => book.prev());
nextBtn.addEventListener('click', () => book.next());

$('#openBook').addEventListener('click', (e) => {
  e.stopPropagation();
  book.open();
  e.currentTarget.blur();
  idle(prefetchImages);
});
$('#closeBook').addEventListener('click', (e) => {
  e.stopPropagation();
  book.close();
  e.currentTarget.blur();
});

document.addEventListener('keydown', (e) => {
  if (viewer.open || slip.node.dataset.open === 'true') return;
  if (e.target.closest('input, textarea')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); book.next(); }
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); book.prev(); }
  if (e.key === 'Home') { e.preventDefault(); book.go(0); }
  if (e.key === 'End') { e.preventDefault(); book.go(book.total); }
});

/* ---- idle prefetch of the later spreads' images ---- */
let prefetched = false;
function prefetchImages() {
  if (prefetched) return;
  prefetched = true;
  for (const it of ITEMS.slice(4)) {
    const img = new Image();
    img.decoding = 'async';
    img.src = `assets/${it.id}.png`;
  }
}

/* ---- sound (opt-in, synthesised with WebAudio: zero KB of audio files) ---- */
const soundBtn = $('#sound');
let audio;
let muted = true;
soundBtn?.addEventListener('click', (e) => {
  muted = !muted;
  soundBtn.setAttribute('aria-pressed', String(!muted));
  if (!muted && !audio) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audio = new Ctx();
  }
  audio?.resume?.();
  if (!muted) paper();
  e.currentTarget.blur();
});

/** a very short filtered-noise "page" sound (~16 KB of silence) */
function paper() {
  if (!audio || muted) return;
  const ctx = audio;
  const dur = 0.16;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.4) * 0.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 1900;
  filt.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.value = 0.14;
  src.connect(filt).connect(g).connect(ctx.destination);
  src.start();
}
prevBtn.addEventListener('pointerup', paper);
nextBtn.addEventListener('pointerup', paper);
$('#openBook').addEventListener('pointerup', paper);

/* ---- a11y: keep the book inert while the viewer is open ---- */
const bookRegion = $('#book');
const mo = new MutationObserver(() => {
  const viewing = document.body.classList.contains('is-viewing');
  bookRegion.setAttribute('aria-hidden', viewing ? 'true' : 'false');
  if (viewing) bookRegion.setAttribute('inert', '');
  else bookRegion.removeAttribute('inert');
});
mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });

/* ---- debug hooks (harmless in prod, handy in the console) ---- */
window.__yoriko = { book, viewer, slip, items: ITEMS, cats: CATS, lowPower, reduceMotion: reduceMotion.matches };
