/**
 * Yoriko Sushi — generative item art.
 *
 * Every dish is drawn once as a transparent SVG (illustrated, ink-and-wash style)
 * and rasterised into a PNG with `sharp`, so the popup can fly a true
 * background-less PNG forward, exactly as the brief requires.
 *
 * Run: node tools/render-assets.mjs
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets');
const SIZE = 900;

const C = {
  rice: '#fcf8f0', riceShade: '#e4d9c4', riceDeep: '#cdbea2',
  nori: '#1f2a26', noriDot: '#3d4d46',
  tuna: '#c0362c', tunaDark: '#8e241c', tunaLight: '#e06450', tunaMarb: '#f0a99a',
  salmon: '#e8734c', salmonDark: '#c0552f', salmonLight: '#f7b294', salmonStripe: '#fbe2d2',
  uni: '#d9822f', uniLight: '#f0aa5c', uniDark: '#a9540f',
  ikura: '#dd5f2a', ikuraLight: '#f6a05e', ikuraDark: '#b84a1c',
  ebi: '#e2803f', ebiDark: '#c06428', ebiLight: '#f6b380',
  scallop: '#f8f2e6', scallopEdge: '#ddd0ba',
  avo: '#8b9a5d', avoLight: '#c2cb96', cucumber: '#7fa76a', cucumberLight: '#b4cd9a',
  tamago: '#f2d57a', tamagoShade: '#dfb94f',
  ink: '#221a17', white: '#ffffff', gold: '#b08d57',
};
const r = (n) => Math.round(n * 100) / 100;

/* ---------------- primitives ---------------- */

/** Front-facing block of rice. Dome on top, flat-ish body, pressed grains. */
function rice(cx, cy, w, h, rot = 0) {
  const x = w / 2;
  let grains = '';
  const seeds = [
    [-0.7, 0.05, -30], [-0.34, 0.05, 6], [0.06, 0.0, -8], [0.46, 0.05, 28], [0.78, 0.05, 12],
    [-0.6, 0.62, 24], [-0.2, 0.72, -10], [0.24, 0.6, 16], [0.6, 0.66, -22],
  ];
  for (const [gx, gy, gr] of seeds) {
    grains += `<ellipse cx="${r(gx * x * 0.78)}" cy="${r(gy * h * 0.5)}" rx="${r(w * 0.085)}" ry="${r(h * 0.05)}" fill="${C.rice}" stroke="${C.riceShade}" stroke-width="2.4" transform="rotate(${gr} ${r(gx * x * 0.78)} ${r(gy * h * 0.5)})"/>`;
  }
  // rounded-rect body + flat-ish top, clamped inside a 1.7h tall box
  const top = -h * 1.7;
  const body = `M${-x} ${top} Q ${-x} ${h * 0.98} ${-x * 0.72} ${h * 1.02} L ${x * 0.72} ${h * 1.02} Q ${x} ${h * 0.98} ${x} ${top} Z`;
  const cap = `M${-x} ${top + h * 0.02} Q ${-x} ${top - h * 0.16} ${-x * 0.5} ${top - h * 0.2} Q 0 ${top - h * 0.26} ${x * 0.5} ${top - h * 0.2} Q ${x} ${top - h * 0.16} ${x} ${top + h * 0.02} Z`;
  return `<g transform="translate(${cx} ${cy}) rotate(${rot})">
    <path d="${body}" fill="${C.riceDeep}" transform="translate(0 ${r(h * 0.1)})"/>
    <path d="${body}" fill="${C.rice}" stroke="${C.riceShade}" stroke-width="3"/>
    <path d="${cap}" fill="${C.rice}" stroke="${C.riceShade}" stroke-width="3"/>
    <path d="${cap}" fill="url(#riceGrad)"/>
    ${grains}
    <path d="M${-x * 0.8} ${h * 0.55} Q 0 ${h * 0.92} ${x * 0.8} ${h * 0.55}" fill="none" stroke="${C.riceDeep}" stroke-width="4" opacity=".4" stroke-linecap="round"/>
  </g>`;
}

function noriBand(cx, cy, w, h, rot = 0) {
  let dots = '';
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 2; col++) {
      dots += `<rect x="${r(-w / 2 + 14 + col * (w - 44))}" y="${r(-h / 2 + 16 + row * ((h - 32) / 4.5))}" width="${r(w - 42)}" height="4" rx="2" fill="${C.noriDot}" opacity=".55"/>`;
    }
  }
  return `<g transform="translate(${cx} ${cy}) rotate(${rot})">
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${r(w * 0.18)}" fill="${C.nori}"/>
    ${dots}
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${r(w * 0.18)}" fill="url(#noriGrad)"/>
  </g>`;
}

/** Thick slab of fish: top face + a darker side for thickness. */
function fishSlab(cx, cy, w, h, rot, top, side, opts = {}) {
  const shape = (dy) =>
    `M${-w} ${-h * 0.2 + dy} Q ${-w * 0.82} ${-h * 1.05 + dy} 0 ${-h * 1.12 + dy} Q ${w * 0.82} ${-h * 1.05 + dy} ${w} ${-h * 0.2 + dy} Q ${w * 0.8} ${h * 1.0 + dy} 0 ${h * 1.05 + dy} Q ${-w * 0.8} ${h * 1.0 + dy} ${-w} ${-h * 0.2 + dy} Z`;
  const thick = opts.thick ?? h * 0.42;
  let extra = '';
  if (opts.stripes) {
    for (let i = -3; i <= 3; i++) {
      const gx = (i / 3.2) * w * 0.8;
      extra += `<path d="M${r(gx)} ${r(-h * 0.9)} Q ${r(gx + w * 0.14)} ${r(-h * 0.05)} ${r(gx)} ${r(h * 0.86)}" fill="none" stroke="${C.salmonStripe}" stroke-width="${r(Math.abs(i) === 3 ? 8 : 11)}" stroke-linecap="round" opacity=".8"/>`;
    }
  }
  if (opts.marble) {
    extra += `<path d="M${r(-w * 0.66)} ${r(-h * 0.05)} Q 0 ${r(-h * 1.0)} ${r(w * 0.64)} ${r(h * 0.0)}" fill="none" stroke="${C.tunaLight}" stroke-width="${r(h * 0.2)}" opacity=".5" stroke-linecap="round"/>
      <path d="M${r(-w * 0.5)} ${r(h * 0.42)} Q 0 ${r(-h * 0.2)} ${r(w * 0.5)} ${r(h * 0.36)}" fill="none" stroke="${C.tunaMarb}" stroke-width="3" opacity=".55"/>
      <path d="M${r(-w * 0.4)} ${r(-h * 0.55)} Q 0 ${r(-h * 0.95)} ${r(w * 0.44)} ${r(-h * 0.48)}" fill="none" stroke="${C.white}" stroke-width="3" opacity=".3" stroke-linecap="round"/>`;
  }
  return `<g transform="translate(${cx} ${cy}) rotate(${rot})">
    <path d="${shape(thick)}" fill="${side}" stroke="${side}" stroke-width="2"/>
    <path d="${shape(0)}" fill="${top}" stroke="${side}" stroke-width="3.5"/>
    ${extra}
  </g>`;
}

const gloss = (x, y, w, rot = 0) =>
  `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${r(w * 0.3)}" fill="${C.white}" opacity=".38" transform="rotate(${rot} ${x} ${y})"/>`;

const sesame = (x, y, color = C.ink, s = 3.4) =>
  `<ellipse cx="${x}" cy="${y}" rx="${s}" ry="${r(s * 0.62)}" fill="${color}" opacity=".8" transform="rotate(${r(x * 1.3)} ${x} ${y})"/>`;

const scallion = (x, y, rot = 0, s = 1) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
    <rect x="-12" y="-6" width="24" height="12" rx="6" fill="${C.cucumber}"/>
    <rect x="-7" y="-6" width="14" height="12" rx="6" fill="${C.cucumberLight}"/>
  </g>`;

/** A maki roll seen at a slight top-down angle. */
function maki(x, y, rad, filling, rot = 0) {
  const inner = rad * 0.7;
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
    <ellipse cx="0" cy="${r(rad * 0.1)}" rx="${rad}" ry="${rad}" fill="#121a17" opacity=".35"/>
    <circle cx="0" cy="0" r="${rad}" fill="${C.nori}"/>
    <circle cx="0" cy="0" r="${r(rad * 0.9)}" fill="${C.rice}" stroke="${C.riceShade}" stroke-width="3"/>
    ${Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return `<ellipse cx="${r(Math.cos(a) * rad * 0.79)}" cy="${r(Math.sin(a) * rad * 0.79)}" rx="${r(rad * 0.11)}" ry="${r(rad * 0.06)}" fill="${C.white}" stroke="${C.riceShade}" stroke-width="1.5" transform="rotate(${r(a * 57.3)} ${r(Math.cos(a) * rad * 0.79)} ${r(Math.sin(a) * rad * 0.79)})" opacity=".9"/>`;
    }).join('')}
    ${filling(inner)}
  </g>`;
}

const fillTuna = (i) => `<circle cx="0" cy="0" r="${r(i * 0.42)}" fill="${C.tuna}"/><circle cx="${r(-i * 0.14)}" cy="${r(-i * 0.14)}" r="${r(i * 0.14)}" fill="${C.tunaLight}" opacity=".75"/>`;
const fillAvo = (i) => `
  <ellipse cx="${r(-i * 0.28)}" cy="${r(-i * 0.12)}" rx="${r(i * 0.42)}" ry="${r(i * 0.3)}" fill="${C.cucumber}" transform="rotate(-20 ${r(-i * 0.28)} ${r(-i * 0.12)})"/>
  <ellipse cx="${r(-i * 0.28)}" cy="${r(-i * 0.12)}" rx="${r(i * 0.24)}" ry="${r(i * 0.15)}" fill="${C.cucumberLight}" transform="rotate(-20 ${r(-i * 0.28)} ${r(-i * 0.12)})"/>
  <ellipse cx="${r(i * 0.34)}" cy="${r(i * 0.22)}" rx="${r(i * 0.42)}" ry="${r(i * 0.26)}" fill="${C.avo}" transform="rotate(24 ${r(i * 0.34)} ${r(i * 0.22)})"/>
  <ellipse cx="${r(i * 0.3)}" cy="${r(i * 0.18)}" rx="${r(i * 0.22)}" ry="${r(i * 0.12)}" fill="${C.avoLight}" transform="rotate(24 ${r(i * 0.3)} ${r(i * 0.18)})"/>`;
const fillSalmon = (i) => `<circle cx="0" cy="0" r="${r(i * 0.44)}" fill="${C.salmon}"/><circle cx="${r(-i * 0.12)}" cy="${r(-i * 0.14)}" r="${r(i * 0.16)}" fill="${C.salmonLight}" opacity=".8"/>`;

function ikuraPile(cx, cy, scale) {
  const pts = [[-56, -10], [-20, -34], [22, -30], [58, -8], [42, 24], [4, 30], [-38, 26], [-62, 8], [6, 0]];
  return `<g transform="translate(${cx} ${cy}) scale(${scale})">${pts.map(([x, y]) =>
    `<circle cx="${x}" cy="${y}" r="24" fill="${C.ikura}" stroke="${C.ikuraDark}" stroke-width="2.5"/>
     <circle cx="${x - 7}" cy="${y - 8}" r="7.5" fill="${C.ikuraLight}"/>`).join('')}</g>`;
}

/* ---------------- dishes ---------------- */

/* Layout (all coordinates relative to a 900x900 canvas centre):
   rice body spans y ~148..304, its top surface is at y = 148,
   fish slabs sit on that surface, nori wraps the middle.            */
const RICE_Y = 254;   // centre of the rice body
const RICE_W = 390;
const RICE_H = 52;
const TOP_Y = 148;    // y of the rice top surface
const BAND_Y = 232;

const base = () => `${rice(0, RICE_Y, RICE_W, RICE_H)}${noriBand(0, BAND_Y, 66, 186)}`;

const dishes = {
  'hon-maguro': () => `${base()}
    ${fishSlab(-2, TOP_Y, 196, 62, 3, C.tuna, C.tunaDark, { marble: true })}
    ${gloss(-92, TOP_Y - 26, 26, -12)}${sesame(-160, TOP_Y + 22)}${sesame(152, TOP_Y + 30, C.gold, 4)}`,

  shake: () => `${base()}
    ${fishSlab(-2, TOP_Y, 198, 60, -3, C.salmon, C.salmonDark, { stripes: true })}
    ${sesame(122, TOP_Y + 26)}${sesame(-170, TOP_Y + 32, C.gold, 4)}`,

  hotate: () => `${base()}
    <g transform="translate(0 ${TOP_Y + 2})">
      <ellipse cx="0" cy="22" rx="178" ry="54" fill="${C.scallopEdge}"/>
      <ellipse cx="0" cy="6" rx="178" ry="54" fill="${C.scallop}"/>
      <ellipse cx="0" cy="6" rx="146" ry="40" fill="none" stroke="${C.scallopEdge}" stroke-width="2.5" opacity=".9"/>
      <path d="M-118 -16 Q 0 -50 118 -16" fill="none" stroke="${C.white}" stroke-width="11" stroke-linecap="round" opacity=".85"/>
    </g>
    ${scallion(-130, TOP_Y - 10, 14)}${scallion(124, 4, -12)}${scallion(22, -32, 4)}`,

  ebi: () => `${base()}
    <g transform="translate(0 ${TOP_Y + 4}) rotate(-4)">
      <path d="M-200 30 Q -206 -46 -90 -66 Q 46 -88 158 -30 Q 190 -14 178 22 Q 92 66 -40 60 Q -160 54 -200 30Z"
        fill="${C.ebiDark}"/>
      <path d="M-200 16 Q -206 -60 -90 -80 Q 46 -102 158 -44 Q 190 -28 178 8 Q 92 52 -40 46 Q -160 40 -200 16Z"
        fill="${C.ebi}" stroke="${C.ebiDark}" stroke-width="3"/>
      <path d="M-168 -8 Q -112 -58 -16 -70" fill="none" stroke="${C.ebiLight}" stroke-width="18" stroke-linecap="round" opacity=".75"/>
      <path d="M-130 30 Q -26 18 118 -18" fill="none" stroke="#a94c1b" stroke-width="3.5" opacity=".4" stroke-dasharray="12 14"/>
      <path d="M150 -60 L 224 -92 L 208 -30 Z" fill="${C.ebiLight}" stroke="${C.ebiDark}" stroke-width="2.5"/>
      <path d="M186 -46 L 250 -70" stroke="#a94c1b" stroke-width="4.5" stroke-linecap="round"/>
    </g>`,

  'tekka-maki': () => `${maki(-104, 250, 95, fillTuna, -5)}
    ${maki(30, 224, 95, fillTuna, 4)}
    ${maki(160, 258, 95, fillTuna, -2)}
    ${sesame(-222, 108, C.gold, 4)}${sesame(226, 118, C.gold, 4)}`,

  'dragon-roll': () => {
    const rows = [[-136, 214], [0, 226], [136, 214], [-74, 352], [66, 354]];
    return `${rows.map(([x, y], i) => `<g transform="translate(${x} ${y})">
      <circle cx="0" cy="0" r="70" fill="${C.nori}"/>
      <circle cx="0" cy="0" r="62" fill="${C.rice}" stroke="${C.riceShade}" stroke-width="3"/>
      <ellipse cx="0" cy="-6" rx="74" ry="36" fill="${C.avo}" stroke="${C.avo}" stroke-width="2"/>
      <ellipse cx="0" cy="-10" rx="60" ry="25" fill="${C.avoLight}"/>
      <path d="M-46 -12 Q 0 -24 46 -12" fill="none" stroke="${C.avo}" stroke-width="2" opacity=".7"/>
      ${i === 1 ? `<circle cx="0" cy="14" r="17" fill="${C.salmon}"/><circle cx="-4" cy="10" r="8" fill="${C.salmonLight}"/>` : ''}
      ${scallion(0, 16, i * 26, 0.9)}
    </g>`).join('')}${sesame(220, 104, C.gold, 4)}${sesame(-226, 100, C.gold, 4)}`;
  },

  'spicy-tuna': () => {
    const spicy = (i) => `<circle cx="0" cy="0" r="${r(i * 0.55)}" fill="#d9542f"/><circle cx="${r(-i * 0.16)}" cy="${r(-i * 0.16)}" r="${r(i * 0.2)}" fill="#ec8a63"/><circle cx="0" cy="0" r="${r(i * 0.16)}" fill="#f6c3a4" opacity=".8"/>`;
    return `${maki(-100, 256, 93, spicy, -5)}
      ${maki(34, 230, 93, spicy, 6)}
      ${maki(164, 262, 93, spicy, -2)}
      ${fishSlab(178, 118, 80, 24, 16, C.salmon, C.salmonDark)}
      ${sesame(-46, 344, C.white, 3.4)}${sesame(86, 352, C.white, 3.4)}`;
  },

  'avocado-maki': () => `${maki(-100, 254, 97, fillAvo, -6)}
    ${maki(32, 226, 97, fillAvo, 5)}
    ${maki(162, 256, 97, fillAvo, -2)}
    ${sesame(-226, 112, C.gold, 4)}${sesame(222, 118, C.gold, 4)}`,

  omakase: () => `
    <g transform="translate(0 26)">
      ${[[-196, 240, -6], [0, 226, 2], [196, 240, 7]].map(([x, y, rot], k) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(.62)">
        ${rice(0, RICE_Y - 100, RICE_W, RICE_H)}
        ${noriBand(0, BAND_Y - 100, 66, 186)}
        ${k === 0 ? fishSlab(-2, TOP_Y - 100, 196, 62, 3, C.tuna, C.tunaDark, { marble: true })
          : k === 1 ? `<ellipse cx="0" cy="${TOP_Y - 104}" rx="180" ry="50" fill="${C.uniDark}"/><ellipse cx="0" cy="${TOP_Y - 112}" rx="176" ry="46" fill="${C.uni}"/><ellipse cx="0" cy="${TOP_Y - 112}" rx="146" ry="32" fill="${C.uniLight}" opacity=".7"/>`
          : fishSlab(-2, TOP_Y - 100, 198, 60, -3, C.salmon, C.salmonDark, { stripes: true })}
      </g>`).join('')}
    </g>
    ${ikuraPile(236, 96, 0.8)}
    ${sesame(-244, 84, C.gold, 4)}`,

  uni: () => `${base()}
    <g transform="translate(0 ${TOP_Y + 4})">
      <ellipse cx="0" cy="18" rx="184" ry="52" fill="${C.uniDark}"/>
      <ellipse cx="0" cy="2" rx="184" ry="52" fill="${C.uni}"/>
      <ellipse cx="0" cy="0" rx="150" ry="36" fill="${C.uniLight}" opacity=".7"/>
      ${[[-96, -6], [-36, -18], [34, -20], [98, -4], [-56, 20], [10, 22], [70, 20]].map(([x, y]) =>
        `<ellipse cx="${x}" cy="${y}" rx="30" ry="16" fill="#cf7326" stroke="${C.uniDark}" stroke-width="2.5"/>`).join('')}
      <path d="M-140 -24 Q 0 -50 140 -24" fill="none" stroke="${C.white}" stroke-width="9" opacity=".35" stroke-linecap="round"/>
    </g>`,

  ikura: () => `${base()}
    <g transform="translate(0 ${TOP_Y + 2})">
      <ellipse cx="0" cy="22" rx="178" ry="50" fill="${C.nori}"/>
      <ellipse cx="0" cy="10" rx="172" ry="46" fill="#101715"/>
    </g>
    ${ikuraPile(0, TOP_Y - 26, 1.18)}`,

  aburi: () => `${base()}
    ${fishSlab(-2, TOP_Y, 198, 60, -4, C.salmon, C.salmonDark, { stripes: true })}
    <path d="M-170 ${TOP_Y + 46} Q 0 ${TOP_Y + 10} 170 ${TOP_Y + 50}" fill="none" stroke="${C.ink}" stroke-width="3" opacity=".4" stroke-linecap="round"/>
    <path d="M-140 ${TOP_Y + 80} Q 0 ${TOP_Y + 48} 142 ${TOP_Y + 78}" fill="none" stroke="${C.ink}" stroke-width="2.5" opacity=".28" stroke-linecap="round"/>
    <g opacity=".5">
      <path d="M-64 -28 q 24 -38 0 -74" fill="none" stroke="${C.white}" stroke-width="8" stroke-linecap="round"/>
      <path d="M14 -44 q 24 -38 0 -66" fill="none" stroke="${C.white}" stroke-width="7" stroke-linecap="round"/>
      <path d="M86 -22 q 20 -30 0 -56" fill="none" stroke="${C.white}" stroke-width="6" stroke-linecap="round"/>
    </g>
    ${scallion(-142, TOP_Y - 10, 20)}${scallion(132, 2, -16)}`,

  tamago: () => `${base()}
    <g transform="translate(0 ${TOP_Y + 4}) rotate(-3)">
      <rect x="-166" y="-18" width="332" height="70" rx="24" fill="${C.tamagoShade}"/>
      <rect x="-166" y="-30" width="332" height="70" rx="24" fill="${C.tamago}" stroke="${C.tamagoShade}" stroke-width="2.5"/>
      <path d="M-132 -8 Q 0 -30 132 -8" fill="none" stroke="${C.white}" stroke-width="8" opacity=".6" stroke-linecap="round"/>
      <path d="M-110 22 Q 0 6 112 22" fill="none" stroke="${C.tamagoShade}" stroke-width="3.5" opacity=".8"/>
    </g>
    ${sesame(-130, TOP_Y - 14, C.ink, 3.4)}${sesame(124, TOP_Y - 20, C.ink, 3.4)}`,
};

/* ---------------- render ---------------- */

function doc(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <defs>
    <radialGradient id="riceGrad" cx="42%" cy="18%" r="82%">
      <stop offset="0" stop-color="${C.white}" stop-opacity=".9"/>
      <stop offset=".7" stop-color="${C.white}" stop-opacity="0"/>
      <stop offset="1" stop-color="${C.riceShade}" stop-opacity=".55"/>
    </radialGradient>
    <linearGradient id="noriGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.white}" stop-opacity=".08"/>
      <stop offset=".5" stop-color="${C.white}" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".2"/>
    </linearGradient>
  </defs>
  <g transform="translate(${SIZE / 2} ${SIZE / 2})">${inner}</g>
</svg>`;
}

await mkdir(outDir, { recursive: true });
let total = 0;
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
// shipped size: the dish is drawn at most ~420 CSS px wide, so 640 is crisp
// on a 1.5x phone and keeps the whole set light
const OUT = 560;
const PAD = Math.round(OUT * 0.06);
for (const [id, draw] of Object.entries(dishes)) {
  // the drawings are not centred on the canvas: trim to the artwork, then
  // fit it back into the square with an even margin so every dish fills its plate
  const trimmed = await sharp(Buffer.from(doc(draw()))).trim({ threshold: 1 }).toBuffer();
  const png = await sharp(trimmed)
    .resize(OUT - 2 * PAD, OUT - 2 * PAD, { fit: 'contain', background: CLEAR })
    .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: CLEAR })
    .png({ compressionLevel: 9, palette: true, colours: 64, quality: 88, effort: 10, dither: 0.4 })
    .toBuffer();
  await writeFile(join(outDir, `${id}.png`), png);
  total += png.length;
  console.log(`${id.padEnd(14)} ${(png.length / 1024).toFixed(1)} KB`);
}
console.log(`total ${(total / 1024).toFixed(1)} KB`);
