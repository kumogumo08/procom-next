// Run manually with: node scripts/capture-procom.mjs
// Visits the local top page once per device. Never reuses a Chrome profile.
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, devices, expect } from '@playwright/test';

const target = new URL('http://localhost:3000/top');
const output = new URL('../test-results/screenshots/', import.meta.url);
const analyticsHosts = ['google-analytics.com', 'googletagmanager.com', 'analytics.google.com'];
const productionHosts = ['procom.jp', 'procom-next.onrender.com'];
const matchesHost = (host, domains) => domains.some((domain) => host === domain || host.endsWith(`.${domain}`));

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
console.log(`Dedicated Playwright Chromium started: ${browser.version()}`);

try {
  for (const device of [
    { name: 'pc', options: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
    { name: 'mobile', options: devices['Pixel 5'] },
  ]) {
    const context = await browser.newContext({
      ...device.options,
      locale: 'ja-JP',
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    try {
      const blocked = { updates: 0, analytics: 0, production: 0, navigation: 0 };
      const pageErrors = [];
      const failedLocalResponses = [];
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        let reason;
        if (matchesHost(url.hostname, analyticsHosts)) reason = 'analytics';
        else if (!['GET', 'HEAD'].includes(request.method())) reason = 'updates';
        else if (matchesHost(url.hostname, productionHosts)) reason = 'production';
        else if (request.isNavigationRequest() && (
          url.origin !== target.origin || !['/', '/top'].includes(url.pathname) || url.search
        )) reason = 'navigation';
        if (reason) {
          blocked[reason] += 1;
          await route.abort('blockedbyclient');
          return;
        }
        await route.continue();
      });

      const page = await context.newPage();
      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('response', (response) => {
        if (new URL(response.url()).origin === target.origin && response.status() >= 400) {
          failedLocalResponses.push({ path: new URL(response.url()).pathname, status: response.status() });
        }
      });

      // Exactly one navigation per device, with no reloads or application clicks.
      const response = await page.goto(target.href, { waitUntil: 'load', timeout: 60000 });
      if (!response?.ok() || page.url() !== new URL('/top', target).href) {
        throw new Error(`${device.name}: unexpected top page response (${response?.status()})`);
      }
      await page.locator('main').waitFor({ state: 'visible' });
      await expect(page.getByRole('heading', { level: 1, name: /^活動を見つけてもらえる\s*1ページに。$/ })).toBeVisible();
      await expect(page.getByText('Codex動作テスト', { exact: true })).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      const layout = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
        const heading = [...document.querySelectorAll('h1')].find((element) => element.getBoundingClientRect().width > 0);
        const headingStyle = getComputedStyle(heading);
        const headingBounds = heading.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(heading);
        const headingLines = [...range.getClientRects()].filter((rect) => rect.width > 0);
        const visibleElements = [...document.querySelectorAll('body *')].filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
        });
        const describe = (element) => ({
          tag: element.tagName.toLowerCase(),
          text: element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80),
        });
        const overflow = visibleElements.filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left < -1 || rect.right > width + 1;
        });
        const clippedText = visibleElements.filter((element) => {
          if (![...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) return false;
          const style = getComputedStyle(element);
          return (['hidden', 'clip'].includes(style.overflowX) && element.scrollWidth > element.clientWidth + 1)
            || (['hidden', 'clip'].includes(style.overflowY) && element.scrollHeight > element.clientHeight + 1);
        });
        return {
          viewport: { width: innerWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio },
          documentWidth,
          horizontalScroll: documentWidth > width + 1,
          headline: {
            text: heading.textContent,
            lines: heading.innerText.split('\n').filter(Boolean),
            wordBreak: headingStyle.wordBreak,
            fontSize: headingStyle.fontSize,
            lineCount: new Set(headingLines.map((rect) => Math.round(rect.top))).size,
            textWithinBounds: headingLines.every((rect) => rect.left >= Math.max(0, headingBounds.left) - 1
              && rect.right <= Math.min(width, headingBounds.right) + 1),
          },
          overflowCandidates: overflow.slice(0, 10).map(describe),
          clippedTextCandidates: clippedText.slice(0, 10).map(describe),
          brokenImages: visibleElements.filter((element) => element instanceof HTMLImageElement && element.complete && !element.naturalWidth).map(describe),
        };
      });
      if (pageErrors.length || failedLocalResponses.length) {
        throw new Error(JSON.stringify({ device: device.name, pageErrors, failedLocalResponses }));
      }
      expect(layout.horizontalScroll).toBe(false);
      expect(layout.headline.textWithinBounds).toBe(true);
      expect(layout.headline.lineCount).toBe(device.name === 'mobile' ? 2 : 1);
      if (device.name === 'mobile') {
        expect(layout.headline.lines).toEqual(['活動を見つけてもらえる', '1ページに。']);
      }

      const path = fileURLToPath(new URL(`${device.name}.png`, output));
      // One full-page screenshot per device; no second capture or scrolling.
      await page.screenshot({ path, fullPage: true, animations: 'disabled', timeout: 30000 });
      console.log(JSON.stringify({ device: device.name, url: page.url(), path, layout, blocked }, null, 2));
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
