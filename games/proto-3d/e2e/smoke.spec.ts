import { expect, test } from '@playwright/test';

test('페이지가 열리고 캔버스가 계속 그려지며 콘솔 오류가 없어요', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => problems.push(`requestfailed: ${request.url()}`));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`http ${response.status()}: ${response.url()}`);
  });

  await page.goto('./');
  const canvas = page.locator('canvas#stage');
  await expect(canvas).toBeVisible();
  await expect.poll(async () => Number(await canvas.getAttribute('data-frames'))).toBeGreaterThan(10);
  await expect(page.locator('#notice')).toBeHidden();
  expect(problems).toEqual([]);
});
