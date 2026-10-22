/**
 * Screenshot driver: node tools/shoot.mjs
 * Captures the key states at every breakpoint, in Firefox and Chromium,
 * into tools/shots/. ENGINES=firefox SIZES=phone narrows the run.
 */
import { chromium, firefox } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = process.env.URL || 'http://localhost:5173';
const out = 'tools/shots';
await mkdir(out, { recursive: true });

const sizes = (process.env.SIZES || 'desktop,phone,tablet').split(',');
const engines = (process.env.ENGINES || 'firefox,chromium').split(',');
const VIEW = {
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  phone: { width: 390, height: 844 },
  small: { width: 375, height: 667 },
  tiny: { width: 320, height: 640 },
  landscape: { width: 844, height: 390 },
};

const errors = [];

for (const engineName of engines) {
  const browser = await (engineName === 'chromium' ? chromium : firefox).launch();
  for (const size of sizes) {
    const vp = VIEW[size];
    const name = `${engineName}-${size}`;
    // Firefox has no touch emulation in Playwright
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: engineName === 'chromium' && vp.width < 900 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`); });
    const settle = () => page.waitForFunction(() => !window.__yoriko.book.animating, null, { timeout: 5000 });

    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${name}-1-cover.png` });

    await page.click('#openBook');
    await settle();
    await page.screenshot({ path: `${out}/${name}-2-contents.png` });
    await page.click('#nextPage');
    await settle();
    await page.screenshot({ path: `${out}/${name}-3-nigiri.png` });

    // only the two facing pages are interactive (the rest are inert)
    await page.click('.face:not([inert]) .card');
    await page.waitForTimeout(380);
    await page.screenshot({ path: `${out}/${name}-4-flying.png` });
    await page.waitForTimeout(1100);
    await page.screenshot({ path: `${out}/${name}-5-item.png` });

    await page.click('#buy', { force: true });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${name}-6-bought.png` });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    for (const n of ['maki', 'specials', 'end']) {
      await page.click('#nextPage');
      await settle();
      await page.screenshot({ path: `${out}/${name}-7-${n}.png` });
    }

    await page.click('#slipToggle');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${name}-8-slip.png` });

    const metrics = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
    if (metrics.scrollW > metrics.clientW + 1) errors.push(`[${name}] HORIZONTAL OVERFLOW ${metrics.scrollW} > ${metrics.clientW}`);

    await ctx.close();
    console.log(`done ${name}`);
  }
  await browser.close();
}

console.log(errors.length ? `\nISSUES:\n${errors.join('\n')}` : '\nno console errors, no overflow');
