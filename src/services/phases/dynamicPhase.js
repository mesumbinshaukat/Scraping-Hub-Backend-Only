import { getBrowser } from '../../utils/browserManager.js';
import winston from 'winston';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});

const window = new JSDOM('').window;
const dompurify = createDOMPurify(window);

export class BlockDetectedError extends Error {
    constructor(message, status = 403) {
        super(message);
        this.name = 'BlockDetectedError';
        this.status = status;
    }
}

/**
 * Enhanced Dynamic Scraping Phase using Playwright with direct Evasions.
 * Optimized for Vercel Hobby (8s timeout).
 */
export const dynamicPhase = async (url, options = {}) => {
    const startTime = Date.now();
    const HOBBY_TIMEOUT = 8000; // 8 seconds for Hobby compatibility
    const MAX_PHASE_RETRIES = 2;

    const runAttempt = async (attempt) => {
        let browser = null;
        let context = null;
        let page = null;

        try {
            browser = await getBrowser();
            context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                viewport: { width: 1280 + Math.floor(Math.random() * 100), height: 720 + Math.floor(Math.random() * 100) },
                deviceScaleFactor: 1,
                extraHTTPHeaders: {
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                }
            });

            // 2025 Manual Stealth Evasions
            await context.addInitScript(() => {
                // 1. Delete webdriver
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

                // 2. Mock hardwareConcurrency
                Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });

                // 3. Mock languages
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

                // 4. Mock plugins
                Object.defineProperty(navigator, 'plugins', {
                    get: () => ({
                        length: 5,
                        item: () => null,
                        namedItem: () => null,
                        refresh: () => { }
                    })
                });

                // 5. Mock Permissions
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );

                // 6. Mock Chrome specialized properties
                window.chrome = {
                    app: { isInstalled: false },
                    runtime: { OnInstalledReason: { INSTALL: 'install' } },
                    loadTimes: () => ({}),
                    csi: () => ({})
                };

                // 7. Add Canvas Fingerprint Noise
                const originalGetContext = HTMLCanvasElement.prototype.getContext;
                HTMLCanvasElement.prototype.getContext = function (type, attributes) {
                    if (type === '2d') {
                        const originalFillText = this.prototype.fillText;
                        this.prototype.fillText = function () {
                            if (Math.random() > 0.99) return;
                            return originalFillText.apply(this, arguments);
                        };
                    }
                    return originalGetContext.apply(this, arguments);
                };
            });

            page = await context.newPage();

            // Block Detection
            let blockDetected = false;
            page.on('response', response => {
                const status = response.status();
                if ([403, 429, 503].includes(status)) {
                    blockDetected = true;
                }
            });

            // Navigation with phase-level timeout
            const remainingTime = HOBBY_TIMEOUT - (Date.now() - startTime);
            if (remainingTime <= 0) throw new Error('Global Phase Timeout');

            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: Math.min(remainingTime, 6000)
            });

            if (blockDetected) {
                throw new BlockDetectedError(`Block detected on ${url}`);
            }

            // Wait for JS settle (short)
            await page.waitForTimeout(1000);

            // Extract and clean
            const data = await page.evaluate(() => {
                const getMeta = (n) => document.querySelector(`meta[name="${n}"], meta[property="${n}"]`)?.getAttribute('content') || '';

                // Remove noise
                ['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe'].forEach(s =>
                    document.querySelectorAll(s).forEach(e => e.remove())
                );

                return {
                    title: document.title,
                    description: getMeta('description') || getMeta('og:description'),
                    image: getMeta('og:image'),
                    html: document.body.innerHTML,
                    innerText: document.body.innerText,
                    links: Array.from(document.querySelectorAll('a[href^="http"]'))
                        .map(a => a.href)
                        .slice(0, 50)
                };
            });

            // Sanitize Content
            const cleanContent = dompurify.sanitize(data.html, { ALLOWED_TAGS: [] });
            const finalContent = (cleanContent || data.innerText).trim().substring(0, 200000);

            if (finalContent.length < 100) {
                throw new Error('Content too short or empty after sanitization');
            }

            return {
                title: data.title,
                description: data.description,
                image: data.image,
                mainContent: finalContent,
                links: [...new Set(data.links)],
                method: 'dynamic_manual_stealth',
                duration: Date.now() - startTime
            };

        } catch (error) {
            if (attempt < MAX_PHASE_RETRIES && (error instanceof BlockDetectedError || error.message.includes('timeout'))) {
                logger.warn(`Retrying dynamic phase for ${url} (Attempt ${attempt + 1})`);
                if (page) await page.close().catch(() => { });
                if (context) await context.close().catch(() => { });
                return runAttempt(attempt + 1);
            }
            throw error;
        } finally {
            if (page) await page.close().catch(() => { });
            if (context) await context.close().catch(() => { });
        }
    };

    try {
        return await runAttempt(1);
    } catch (error) {
        logger.error(`Dynamic phase failed for ${url}: ${error.message}`);
        throw error;
    }
};
