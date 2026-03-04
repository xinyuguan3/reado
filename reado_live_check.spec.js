const { test, expect } = require('@playwright/test');

test('check reado.fun live routes and sidebar blog', async ({ page, request }) => {
  const rootResp = await page.goto('https://reado.fun/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  console.log('ROOT_STATUS=' + (rootResp ? rootResp.status() : 'NA'));
  console.log('FINAL_URL=' + page.url());

  const shellResp = await request.get('https://reado.fun/shared/shell.js');
  const shellText = await shellResp.text();
  const hasBlogRoute = shellText.includes('id: "blog"') && shellText.includes('href: "/blog/"');
  console.log('SHELL_STATUS=' + shellResp.status());
  console.log('SHELL_HAS_BLOG_ROUTE=' + hasBlogRoute);

  await page.goto('https://reado.fun/pages/playable-studio.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const blogLinks = page.locator('a.reado-shell-link[href="/blog/"]');
  const blogCount = await blogLinks.count();
  console.log('SIDEBAR_BLOG_LINK_COUNT=' + blogCount);

  expect(rootResp && rootResp.ok()).toBeTruthy();
});
