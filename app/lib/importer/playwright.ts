type PlaywrightModule = typeof import('playwright');
type PlaywrightBrowser = Awaited<ReturnType<PlaywrightModule['chromium']['launch']>>;
type PlaywrightContext = Awaited<ReturnType<PlaywrightBrowser['newContext']>>;

let playwrightModule: PlaywrightModule | null = null;
let importError: Error | null = null;

const loadPlaywright = async (): Promise<PlaywrightModule | null> => {
  if (playwrightModule || importError) {
    return playwrightModule;
  }
  try {
    playwrightModule = await import('playwright');
  } catch (error) {
    importError = error instanceof Error ? error : new Error('Unknown Playwright import error');
  }
  return playwrightModule;
};

const PLAYWRIGHT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

const PLAYWRIGHT_NAV_HEADERS = {
  'Accept-Language': 'en-US,en;q=0.9',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'sec-ch-ua': '"Not A;Brand";v="8", "Chromium";v="123", "Google Chrome";v="123"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
};

const BLOCKED_PATTERNS = [/Access Denied/i, /temporarily blocked/i, /Request unsuccessful/i];

export const renderWithPlaywright = async (
  url: string,
  timeoutMs = 30000
): Promise<{ html: string; source: 'playwright' } | null> => {
  const mod = await loadPlaywright();
  if (!mod?.chromium) {
    if (importError) {
      console.warn('Playwright unavailable:', importError.message);
    }
    return null;
  }

  let browser: PlaywrightBrowser | null = null;
  let context: PlaywrightContext | null = null;
  try {
    browser = await mod.chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });
    context = await browser.newContext({
      userAgent: PLAYWRIGHT_USER_AGENT,
      locale: 'en-US',
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2,
      permissions: ['geolocation'],
    });
    const page = await context.newPage();
    await page.addInitScript(`
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      window.chrome = window.chrome || {};
      window.chrome.runtime = window.chrome.runtime || {};
      Object.defineProperty(navigator, 'plugins', {
        get() {
          return [1, 2, 3, 4, 5];
        },
      });
      Object.defineProperty(navigator, 'languages', {
        get() {
          return ['en-US', 'en'];
        },
      });
    `);
    await page.setExtraHTTPHeaders(PLAYWRIGHT_NAV_HEADERS);

    try {
      const target = new URL(url);
      try {
        await page.goto(target.origin, { waitUntil: 'domcontentloaded', timeout: Math.min(timeoutMs, 5000) });
        await page.waitForTimeout(750);
      } catch (warmupError) {
        console.warn('Playwright warmup warning', warmupError);
      }
    } catch {
      // Ignore invalid URL warmup
    }

    let html: string | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await page.goto(url, {
          waitUntil: attempt === 0 ? 'domcontentloaded' : 'networkidle',
          timeout: timeoutMs,
        });
      } catch (navError) {
        console.warn('Playwright navigation warning', navError);
      }
      html = await page.content();
      if (!html) continue;
      const looksBlocked = BLOCKED_PATTERNS.some((pattern) => pattern.test(html ?? ''));
      if (!looksBlocked) {
        break;
      }
      await page.waitForTimeout(1500);
    }

    await page.close();
    await context.close();
    context = null;

    if (!html || !html.trim()) {
      return null;
    }

    return { html, source: 'playwright' };
  } catch (error) {
    console.warn('Playwright rendering failed', error);
    return null;
  } finally {
    await context?.close().catch(() => undefined);
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
};
