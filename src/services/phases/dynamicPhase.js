import chromium from 'playwright-aws-lambda';
import { UserAgent } from '../../utils/userAgents.js';

export const dynamicScrape = async (url) => {
    let browser = null;
    try {
        // Determine environment and launch appropriate browser
        // On Vercel, use playwright-aws-lambda
        // Locally, we might need a different config or just rely on it finding a local chrome if installed
        
        browser = await chromium.launchChromium({
            headless: true,
            args: [...chromium.getChromiumArgs(true), '--disable-gpu'], // Optimized args
        });

        const context = await browser.newContext({
            userAgent: UserAgent.getRandom(),
            viewport: { width: 1280, height: 720 },
        });

        const page = await context.newPage();

        // 60s timeout matching Vercel function limit, but we should aim for less
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Wait for some content (heuristic)
        try {
            await page.waitForSelector('body', { timeout: 5000 });
        } catch (e) {
            // ignore
        }

        const title = await page.title();
        
        // Extract meta description
        const description = await page.$eval('meta[name="description"]', (el) => el.content).catch(() => '') ||
                            await page.$eval('meta[property="og:description"]', (el) => el.content).catch(() => '');

        // Extract content
        const content = await page.$eval('main, article, body', (el) => el.innerText).catch(() => '');

        // Extract Image
        const image = await page.$eval('meta[property="og:image"]', (el) => el.content).catch(() => '');

        // Extract Links
        const links = await page.$$eval('a', (anchors) => {
            return anchors.slice(0, 50).map(a => a.href).filter(h => h.startsWith('http'));
        });

        return {
            title,
            description,
            content: content.substring(0, 200000), // Increased limit for full content
            image,
            links,
            method: 'dynamic_phase_2'
        };

    } catch (error) {
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};
