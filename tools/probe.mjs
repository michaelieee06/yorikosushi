/* Turn-by-turn probe: drives the REAL animations (buttons, drag, dots, keys)
 * and captures mid-turn frames plus every resting spread.
 *   node tools/probe.mjs [firefox|chromium] [WxH]
 */
import { firefox, chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const engineName = process.argv[2] === 'chromium' ? 'chromium' : 'firefox';
const [w, h] = (process.argv[3] || '1280x800').split('x').map(Number);
const tag = `${engineName}-${w}`;
const out = 'tools/shots/probe';
await mkdir(out, { recursive: true });

const browser = await (engineName === 'chromium' ? chromium : firefox).launch();
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errs = [];
page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

const snap = (n) => page.screenshot({ path: `${out}/${tag}-${n}.png` });
const state = () => page.evaluate(() => {
  const b = window.__yoriko.book;
  return { p: +b.progress.toFixed(3), cur: b.current, total: b.total, animating: b.animating };
});
const settle = () => page.waitForFunction(() => !window.__yoriko.book.animating, null, { timeout: 5000 });
const check = (cond, msg) => { if (!cond) errs.push(`FAIL: ${msg}`); };

await snap('0-cover');

// every spread, forwards, with a mid-turn frame
for (let s = 1; s <= 5; s++) {
  await page.click('#nextPage');
  await page.waitForTimeout(380);
  await snap(`${s}-mid`);
  await settle();
  await snap(`${s}-rest`);
  const st = await state();
  check(st.cur === s, `next -> expected spread ${s}, got ${st.cur}`);
}
check(await page.isDisabled('#nextPage'), 'next should be disabled at the end');

// back to the start with the keyboard
for (let s = 4; s >= 0; s--) {
  await page.keyboard.press('ArrowLeft');
  await settle();
  check((await state()).cur === s, `ArrowLeft -> expected ${s}`);
}

// a dot jumps several spreads in one riffle
await page.click('.dot:nth-child(5)');
await page.waitForTimeout(450);
await snap('jump-mid');
await settle();
check((await state()).cur === 4, 'dot 5 -> spread 4');

// drag one page back (from right to left drags forward; left to right goes back)
const box = await page.locator('#bookEl').boundingBox();
await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
await page.mouse.down();
for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + box.width * (0.3 + 0.03 * i), box.y + box.height * 0.5);
await snap('drag-mid');
await page.mouse.up();
await settle();
check((await state()).cur === 3, `drag right -> spread 3, got ${(await state()).cur}`);

// rapid double-press chains two turns
await page.click('#prevPage');
await page.click('#prevPage');
await settle();
check((await state()).cur === 1, `double prev -> spread 1, got ${(await state()).cur}`);

// contents rows jump to their category
await page.click('.face:not([inert]) [data-goto="4"]');
await settle();
check((await state()).cur === 4, 'contents row -> specials');
await snap('specials');

// a specials plate opens the viewer, and a price-list row does too
await page.click('.face:not([inert]) .card[data-id="uni"]');
await page.waitForTimeout(1300);
await snap('viewer-card');
check(await page.evaluate(() => window.__yoriko.viewer.open), 'viewer opens from a plate');
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
await page.click('.face:not([inert]) .menu-row[data-id="ikura"]');
await page.waitForTimeout(1300);
check(await page.evaluate(() => window.__yoriko.viewer.open), 'viewer opens from a list row');
await page.keyboard.press('Escape');
await page.waitForTimeout(700);

// close from the back board
await page.click('.dot:last-child');
await settle();
await page.click('#closeBook');
await settle();
check((await state()).cur === 0, 'close book -> cover');

// tapping the closed cover opens it
await page.click('#bookEl', { position: { x: box.width * 0.75, y: box.height * 0.2 } });
await settle();
check((await state()).cur === 1, 'tap cover -> spread 1');

const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
check(m.sw <= m.cw + 1, `horizontal overflow ${m.sw} > ${m.cw}`);

console.log(errs.length ? errs.join('\n') : `${tag}: all checks passed`);
await browser.close();
