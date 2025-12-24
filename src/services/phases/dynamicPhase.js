import { getBrowser } from '../../utils/browserManager.js';

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;

/**
 * Enhanced Dynamic Scraping Phase using Playwright with Stealth
 * Bypasses 403s, CAPTCHAs (sometimes), and JS-rendering blocks.
 */
export const dynamicPhase = async (url, options = {}) => {
    let browser = null;
    let context = null;
    let page = null;

    try {
        console.log(`Starting dynamic scrape for: ${url}`);

        // Launch Browser - uses unified manager (Vercel compatible)
        browser = await getBrowser();

        context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            deviceScaleFactor: 1,
            ...options // merge other options
        });

        page = await context.newPage();

        // Navigate with timeouts
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for body to be populated
        try {
            await page.waitForSelector('body', { timeout: 5000 });
            // Wait a bit for JS execution
            await page.waitForTimeout(2000);
        } catch (e) {
            console.log('Timeout waiting for selector, proceeding anyway...');
        }

        // Extract Data
        const data = await page.evaluate(() => {
            // Helper to get meta content
            const getMeta = (name) => {
                const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
                return el ? el.getAttribute('content') : '';
            };

            // Main Content Heuristic
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

            // Links
            const links = Array.from(document.querySelectorAll('a[href^="http"]'))
                .map(a => a.href)
                .slice(0, 50);

            return {
                title: document.title,
                description: getMeta('description') || getMeta('og:description'),
                image: getMeta('og:image'),
                mainContent: content || document.body.innerText.substring(0, 5000), // fallback
                links: [...new Set(links)]
            };
        });

        return {
            ...data,
            mainContent: data.mainContent.substring(0, 200000),
            method: 'dynamic_phase_stealth'
        };

    } catch (error) {
        console.error(`Dynamic scrape error: ${error.message}`);
        throw error;
    } finally {
        if (page) await page.close();
        if (context) await context.close();
        if (browser) await browser.close();
    }
};
