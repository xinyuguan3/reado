const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4310';
const BOOK_ID = process.env.BOOK_ID || '';
const MODULE_SLUG = process.env.MODULE_SLUG || '';
const HEADLESS = String(process.env.HEADLESS || 'false').toLowerCase() === 'true';

if (!BOOK_ID || !MODULE_SLUG) {
  console.error('BOOK_ID and MODULE_SLUG are required.');
  process.exit(2);
}

(async () => {
  const browser = await chromium.launch({ headless: HEADLESS, slowMo: HEADLESS ? 0 : 40 });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const pageErrors = [];
  const consoleErrors = [];
  const httpFailures = [];
  page.on('pageerror', (err) => pageErrors.push(String(err && err.message ? err.message : err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (res) => {
    const status = Number(res.status());
    if (status >= 400) {
      httpFailures.push({
        status,
        url: res.url()
      });
    }
  });

  const result = {
    baseUrl: BASE_URL,
    bookId: BOOK_ID,
    moduleSlug: MODULE_SLUG,
    checks: {},
    pageErrors,
    consoleErrors,
    httpFailures,
    screenshots: []
  };

  try {
    await page.goto(`${BASE_URL}/books/${encodeURIComponent(BOOK_ID)}.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(1200);

    const moduleLinks = await page.locator('a[href^="/experiences/"]').count();
    result.checks.bookPageLoaded = true;
    result.checks.moduleLinks = moduleLinks;
    result.checks.moduleLinksPass = moduleLinks >= 8;
    result.checks.bookTitle = ((await page.locator('h1').first().textContent().catch(() => '')) || '').trim();

    const bookShot = '/tmp/reado-book-pipeline-qa-book.png';
    await page.screenshot({ path: bookShot, fullPage: true });
    result.screenshots.push(bookShot);

    await page.goto(`${BASE_URL}/experiences/${encodeURIComponent(MODULE_SLUG)}.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(1500);

    const quizCards = await page.locator('.quiz').count();
    const taskRows = await page.locator('.task').count();
    const panelExists = await page.locator('.reado-pipeline-panel').count();
    const htmlLength = await page.evaluate(() => document.documentElement.outerHTML.length);

    result.checks.modulePageLoaded = true;
    result.checks.quizCards = quizCards;
    result.checks.taskRows = taskRows;
    result.checks.pipelinePanel = panelExists;
    result.checks.htmlLength = htmlLength;
    result.checks.quizCardsPass = quizCards >= 8;
    result.checks.taskRowsPass = taskRows >= 8;
    result.checks.pipelinePanelPass = panelExists >= 1;
    result.checks.htmlLengthPass = htmlLength > 12000;

    const moduleShot = '/tmp/reado-book-pipeline-qa-module.png';
    await page.screenshot({ path: moduleShot, fullPage: true });
    result.screenshots.push(moduleShot);

    result.checks.noPageErrors = pageErrors.length === 0;
    const ignorablePattern = /favicon|apple-touch-icon|manifest\.json/i;
    const criticalConsoleErrors = consoleErrors.filter((msg) => {
      const text = String(msg || '');
      if (ignorablePattern.test(text)) return false;
      if (/^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/i.test(text)) {
        return false;
      }
      return true;
    });
    const criticalHttpFailures = httpFailures.filter((item) => !ignorablePattern.test(String(item?.url || '')));
    result.checks.noCriticalConsoleErrors = criticalConsoleErrors.length === 0;
    result.checks.noCriticalHttpFailures = criticalHttpFailures.length === 0;

    const pass = Boolean(
      result.checks.moduleLinksPass
      && result.checks.quizCardsPass
      && result.checks.taskRowsPass
      && result.checks.pipelinePanelPass
      && result.checks.htmlLengthPass
      && result.checks.noPageErrors
      && result.checks.noCriticalConsoleErrors
      && result.checks.noCriticalHttpFailures
    );
    result.pass = pass;

    console.log(JSON.stringify(result, null, 2));
    await browser.close();
    process.exit(pass ? 0 : 1);
  } catch (error) {
    result.error = String(error && error.message ? error.message : error);
    console.log(JSON.stringify(result, null, 2));
    await browser.close().catch(() => {});
    process.exit(2);
  }
})();
