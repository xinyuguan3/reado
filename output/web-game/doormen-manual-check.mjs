import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = '/Users/guanxinyu/Documents/GitHub/reado/output/web-game/doormen-manual';
fs.mkdirSync(outDir, { recursive: true });

const url = 'http://127.0.0.1:4273/book_experiences/doormen/doormen_boundary_shift_01/code.html';
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => {
  consoleErrors.push(String(err));
});

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(outDir, 'menu.png'), fullPage: true });

await page.click('#start-btn');
await page.waitForTimeout(250);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(120);
await page.keyboard.press('Space');
await page.waitForTimeout(120);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(120);
await page.screenshot({ path: path.join(outDir, 'playing.png'), fullPage: true });

await page.keyboard.press('p');
await page.waitForTimeout(140);
const pausedState = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
await page.screenshot({ path: path.join(outDir, 'paused.png'), fullPage: true });

await page.keyboard.press('p');
await page.waitForTimeout(120);
await page.keyboard.press('f');
await page.waitForTimeout(220);
const fullscreenAfterF = await page.evaluate(() => Boolean(document.fullscreenElement));
await page.screenshot({ path: path.join(outDir, 'fullscreen.png'), fullPage: true });

await page.keyboard.press('Escape');
await page.waitForTimeout(220);
const fullscreenAfterEsc = await page.evaluate(() => Boolean(document.fullscreenElement));

await page.keyboard.press('r');
await page.waitForTimeout(180);
const restartedState = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
await page.screenshot({ path: path.join(outDir, 'restarted.png'), fullPage: true });

fs.writeFileSync(path.join(outDir, 'manual-state.json'), JSON.stringify({ pausedState, restartedState, fullscreenAfterF, fullscreenAfterEsc, consoleErrors }, null, 2));

await browser.close();
