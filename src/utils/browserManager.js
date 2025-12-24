import chromium from '@sparticuz/chromium-min';
import { chromium as extraChromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

// Register stealth plugin
extraChromium.use(stealthPlugin());

const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION;

/**
 * Unified browser manager for local and Vercel environments.
 * Uses playwright-extra with stealth plugin.
 */
export const getBrowser = async () => {
    try {
        if (isVercel) {
            // Vercel / Lambda environment
            const executablePath = await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v121.0.0/chromium-v121.0.0-pack.tar');

            const browser = await extraChromium.launch({
                args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
                defaultViewport: chromium.defaultViewport,
                executablePath,
                headless: chromium.headless,
            });
            return browser;
        } else {
            // Local Development (full browser)
            const browser = await extraChromium.launch({
                headless: true
            });
            return browser;
        }
    } catch (error) {
        console.error('Browser Launch Failed:', error);
        throw error;
    }
};
