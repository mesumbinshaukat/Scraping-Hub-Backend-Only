import { getBrowser } from '../../utils/browserManager.js';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});

/**
 * Enhanced Dynamic Scraping Phase using Playwright with Stealth
 * Includes manual evasions as backup for the stealth plugin.
 */
export const dynamicPhase = async (url, options = {}) => {
    let browser = null;
    let context = null;
    let page = null;
    const startTime = Date.now();
    const PHASE_TIMEOUT = 50000; // 50 seconds to fit within Vercel's 60s limit

    try {
        logger.info(`Starting dynamic scrape for: ${url}`);

        browser = await getBrowser();

        context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            deviceScaleFactor: 1,
            ...options
        });

        // Add manual evasions as backup
        await context.addInitScript(() => {
            // Delete navigator.webdriver
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

            // Randomize screen resolution slightly
            const originalQuery = window.matchMedia;
            window.matchMedia = (query) => {
                if (query === '(prefers-reduced-motion: reduce)') return { matches: false, addListener: () => { }, removeListener: () => { } };
                return originalQuery(query);
            };

            // Fake some plugins
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });

            // Mock languages
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        });

        page = await context.newPage();

        // Monitor responses for blocks
        page.on('response', response => {
            const status = response.status();
            if (status === 403 || status === 429) {
                logger.warn(`Block detected for ${url}: Status ${status}`);
            }
        });

        // Set an overall timeout for the page navigation and extraction
        const navigationPromise = page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Phase Timeout')), PHASE_TIMEOUT)
        );

        await Promise.race([navigationPromise, timeoutPromise]);

        // Wait for body or specific indicators
        try {
            await page.waitForSelector('body', { timeout: 10000 });
            // Look for CAPTCHA markers
            const bodyHtml = await page.content();
            if (bodyHtml.toLowerCase().includes('captcha') || bodyHtml.toLowerCase().includes('blocked')) {
                logger.warn('Anti-bot detected in page content');
            }
            await page.waitForTimeout(2000); // Allow JS to settle
        } catch (e) {
            logger.warn('Timeout waiting for body or settling, proceeding...');
        }

        // Extract Data
        const data = await page.evaluate(() => {
            const getMeta = (name) => {
                const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
                return el ? el.getAttribute('content') : '';
            };

            const removeNoise = () => {
                const selectors = ['script', 'style', 'nav', 'footer', 'header', 'aside', '.ad', '.advertisement'];
                selectors.forEach(s => document.querySelectorAll(s).forEach(e => e.remove()));
            };
            removeNoise();

            const mainSelectors = ['main', 'article', '#content', '.content', '.post-content', 'body'];
            let content = '';
            for (const sel of mainSelectors) {
                const el = document.querySelector(sel);
                if (el && el.innerText.length > 200) {
                    content = el.innerText;
                    break;
                }
            }

            return {
                title: document.title,
                description: getMeta('description') || getMeta('og:description'),
                image: getMeta('og:image'),
                mainContent: content || document.body.innerText.substring(0, 5000),
                links: Array.from(document.querySelectorAll('a[href^="http"]'))
                    .map(a => a.href)
                    .slice(0, 50)
            };
        });

        if (!data.mainContent || data.mainContent.length < 100) {
            throw new Error('Content too short or empty');
        }

        return {
            ...data,
            mainContent: data.mainContent.substring(0, 200000), // Safe truncation
            links: [...new Set(data.links)],
            method: 'dynamic_phase_stealth',
            duration: Date.now() - startTime
        };

    } catch (error) {
        logger.error(`Dynamic scrape error for ${url}: ${error.message}`);
        throw error;
    } finally {
        if (page) await page.close();
        if (context) await context.close();
        if (browser) await browser.close();
    }
};
