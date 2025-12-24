import chromiumPack from '@sparticuz/chromium-min';
import { chromium } from 'playwright-core';

const isVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION);

let cachedExecutablePath = null;
const CHROMIUM_PACK_URL = 'https://github.com/Sparticuz/chromium/releases/download/v126.0.0/chromium-v126.0.0-pack.tar';
const BROWSER_LAUNCH_RETRIES = 3;

// Track active browsers for graceful shutdown
const activeBrowsers = new Set();

/**
 * Enhanced browser manager for local and Vercel environments.
 * Uses direct playwright-core to avoid dependency issues on Vercel.
 */
export const getBrowser = async (attempt = 1) => {
    try {
        let browser;
        if (isVercel) {
            if (!cachedExecutablePath) {
                console.log('Fetching Chromium executable path for Vercel...');
                cachedExecutablePath = await chromiumPack.executablePath(CHROMIUM_PACK_URL);
            }

            browser = await chromium.launch({
                args: [...chromiumPack.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
                defaultViewport: chromiumPack.defaultViewport,
                executablePath: cachedExecutablePath,
                headless: chromiumPack.headless,
            });
        } else {
            // Local Development
            browser = await chromium.launch({
                headless: true
            });
        }

        activeBrowsers.add(browser);
        browser.on('disconnected', () => activeBrowsers.delete(browser));

        return browser;
    } catch (error) {
        console.error(`Browser Launch Failed (Attempt ${attempt}):`, error.message);

        // Reset cached path if it might be corrupted or outdated
        if (error.message.includes('not found') || error.message.includes('directory') || error.message.includes('executable')) {
            cachedExecutablePath = null;
        }

        if (attempt < BROWSER_LAUNCH_RETRIES) {
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`Retrying browser launch in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
            return getBrowser(attempt + 1);
        }
        throw error;
    }
};

/**
 * Force close all active browser instances
 */
export const closeAllBrowsers = async () => {
    const closePromises = Array.from(activeBrowsers).map(b => b.close().catch(() => { }));
    await Promise.all(closePromises);
    activeBrowsers.clear();
};

// Handle graceful shutdown
if (typeof process !== 'undefined') {
    process.on('SIGTERM', async () => {
        console.log('SIGTERM received: Closing browsers...');
        await closeAllBrowsers();
        process.exit(0);
    });
}
