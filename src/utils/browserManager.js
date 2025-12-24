import chromiumPack from '@sparticuz/chromium-min';
import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

const isVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION);

// Configure Stealth
const stealth = stealthPlugin();
if (isVercel) {
    // Disable problematic evasions for serverless
    stealth.enabledEvasions.delete('chrome.app');
    stealth.enabledEvasions.delete('chrome.runtime');
}
chromium.use(stealth);

let cachedExecutablePath = null;
// Chromium 131 pack for AL2023 compat
const CHROMIUM_PACK_URL = 'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';
const BROWSER_LAUNCH_RETRIES = 3;

const activeBrowsers = new Set();

export const getBrowser = async (attempt = 1) => {
    try {
        let browser;
        if (isVercel) {
            if (!cachedExecutablePath) {
                console.log('Fetching Chromium v131 executable path for Vercel...');
                cachedExecutablePath = await chromiumPack.executablePath(CHROMIUM_PACK_URL);
            }

            browser = await chromium.launch({
                args: [
                    ...chromiumPack.args,
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--single-process'
                ],
                defaultViewport: chromiumPack.defaultViewport,
                executablePath: cachedExecutablePath,
                headless: true, // Explicitly boolean
            });
        } else {
            browser = await chromium.launch({ headless: true });
        }

        activeBrowsers.add(browser);
        browser.on('disconnected', () => activeBrowsers.delete(browser));
        return browser;
    } catch (error) {
        console.error(`Browser Launch Failed (Attempt ${attempt}):`, error.message);

        if (error.message.includes('not found') || error.message.includes('directory')) {
            cachedExecutablePath = null;
        }

        if (attempt < BROWSER_LAUNCH_RETRIES) {
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
            return getBrowser(attempt + 1);
        }
        throw error;
    }
};

export const closeAllBrowsers = async () => {
    const closePromises = Array.from(activeBrowsers).map(b => b.close().catch(() => { }));
    await Promise.all(closePromises);
    activeBrowsers.clear();
};

if (typeof process !== 'undefined') {
    process.on('SIGTERM', async () => {
        await closeAllBrowsers();
        process.exit(0);
    });
}
