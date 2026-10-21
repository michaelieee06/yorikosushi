/* Yoriko Sushi — menu data & tiny helpers.
   No dependencies. Everything here is static so the site can be opened from disk. */

export const CATS = [
  { jp: '握り', romaji: 'Nigiri', note: 'Two pieces per order. Pressed to order, never ahead.' },
  { jp: '巻き', romaji: 'Maki & Rolls', note: 'Nori from Ise Bay. Rice seasoned with red vinegar.' },
  { jp: 'おまかせ', romaji: 'Specials', note: "Chef's choice, torched and finished at the counter." },
];

/** price is in whole rupiah. */
export const ITEMS = [
  { id: 'hon-maguro', name: 'Hon Maguro', jp: '本鮪', romaji: 'bluefin • akami', price: 68000, blurb: 'Lean bluefin, aged nine days, brushed with nikiri soy. The clean, deep cut.', tags: ['生 Raw', 'Aged 9d'], cat: 0 },
  { id: 'shake', name: 'Shake', jp: '鮭', romaji: 'salmon', price: 42000, blurb: 'Norwegian salmon, hand-sliced to 5 mm, finished with a whisper of yuzu salt.', tags: ['生 Raw', 'Yuzu'], cat: 0 },
  { id: 'hotate', name: 'Hotate', jp: '帆立', romaji: 'hokkaido scallop', price: 52000, blurb: 'Live Hokkaido scallop, scored, salted for ninety seconds, then pressed.', tags: ['生 Raw', 'Seasonal'], cat: 0 },
  { id: 'ebi', name: 'Ebi', jp: '海老', romaji: 'sweet prawn', price: 38000, blurb: 'Tiger prawn blanched in dashi, curled over warm rice with a brush of glaze.', tags: ['Cooked', 'Dashi'], cat: 0 },

  { id: 'tekka-maki', name: 'Tekka Maki', jp: '鉄火巻', romaji: 'tuna roll', price: 36000, blurb: 'Six pieces of bluefin wrapped tight with crisp nori and red vinegar rice.', tags: ['6 pc', 'Classic'], cat: 1 },
  { id: 'dragon-roll', name: 'Dragon Roll', jp: '竜巻', romaji: 'dragon roll', price: 74000, blurb: 'Prawn and cucumber inside, avocado scales draped over, brushed with unagi tare.', tags: ['8 pc', 'House'], cat: 1 },
  { id: 'spicy-tuna', name: 'Spicy Tuna', jp: '辛鮪', romaji: 'spicy tuna', price: 48000, blurb: 'Chopped akami with house chilli oil and togarashi, topped with tempura crisps.', tags: ['6 pc', 'Spicy 🌶'], cat: 1 },
  { id: 'avocado-maki', name: 'Avocado Maki', jp: '酪梨巻', romaji: 'avocado roll', price: 34000, blurb: 'Ripe Hass avocado, cucumber batons and toasted sesame. Quietly the best seller.', tags: ['6 pc', 'Vegetarian'], cat: 1 },

  { id: 'omakase', name: 'Omakase Set', jp: 'おまかせ', romaji: 'chef’s selection', price: 248000, blurb: 'Nine pieces chosen by the counter that morning — plus one the chef will not name.', tags: ['9 pc', 'Signature'], cat: 2 },
  { id: 'uni', name: 'Uni', jp: '雲丹', romaji: 'sea urchin', price: 96000, blurb: 'Bafun uni from Hokkaido, spooned over rice with a single grain of sea salt.', tags: ['生 Raw', 'Limited'], cat: 2 },
  { id: 'ikura', name: 'Ikura', jp: 'いくら', romaji: 'salmon roe', price: 58000, blurb: 'Roe cured in soy and mirin overnight, wrapped in its own nori boat.', tags: ['Cured', 'Nori'], cat: 2 },
  { id: 'aburi', name: 'Torched Aburi', jp: '炙り', romaji: 'seared salmon', price: 54000, blurb: 'Salmon seared with a binchotan torch, finished with ponzu and fried leek.', tags: ['炙 Seared', 'Ponzu'], cat: 2 },
];

export const CURRENCY = 'Rp';
export const fmt = (n) => `${CURRENCY} ${n.toLocaleString('id-ID')}`;

/* ---------- dom ---------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  // keep genuinely empty children out of the flow
  for (const kid of kids.flat()) {
    if (kid == null) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return node;
}

/* ---------- device / preference ---------- */
const nav = navigator;
export const lowPower =
  (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) ||
  (nav.deviceMemory && nav.deviceMemory <= 4) ||
  (nav.connection && nav.connection.saveData === true);

export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
export const media = {
  map: () => window.matchMedia('(max-width: 767px)').matches,
  narrow: () => window.matchMedia('(max-width: 1023px)').matches,
};

export const raf = (fn) => requestAnimationFrame(fn);
export const idle = window.requestIdleCallback
  ? (fn) => requestIdleCallback(fn, { timeout: 1200 })
  : (fn) => setTimeout(fn, 200);

/* ---------- motion curves ---------- */
export const EASE = {
  out: 'cubic-bezier(.16,.84,.24,1)',
  outSoft: 'cubic-bezier(.22,.61,.36,1)',
  spring: 'cubic-bezier(.34,1.56,.64,1)',
  inOut: 'cubic-bezier(.65,.05,.36,1)',
  pageTurn: 'cubic-bezier(.42,.03,.32,1)',
};
export const DUR = lowPower ? 0.62 : 1;

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
