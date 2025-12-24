import chromiumPack from '@sparticuz/chromium-min';
import { chromium } from 'playwright-core';
import { addExtra } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

// Explicitly patch Playwright with Stealth
const extraChromium = addExtra(chromium);
extraChromium.use(stealthPlugin());

const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION;

/**
 * Unified browser manager for local and Vercel environments.
 * Uses playwright-extra with stealth plugin.
 * Explicitly patches playwright-core to avoid "Playwright is missing" errors on Vercel.
 */
export const getBrowser = async () => {
    try {
        if (isVercel) {
            // Vercel / Lambda environment
            const executablePath = await chromiumPack.executablePath('https://github.com/Sparticuz/chromium/releases/download/v121.0.0/chromium-v121.0.0-pack.tar');

            const browser = await extraChromium.launch({
                args: [...chromiumPack.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
                defaultViewport: chromiumPack.defaultViewport,
                executablePath,
                headless: chromiumPack.headless,
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
