import chromiumPack from '@sparticuz/chromium-min';
import { chromium } from 'playwright-core';
import { addExtra } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import 'puppeteer-extra'; // Ensure peer dep is satisfied for stealth plugin

// Explicitly patch Playwright with Stealth
const extraChromium = addExtra(chromium);
extraChromium.use(stealthPlugin());

const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION;
let cachedExecutablePath = null;

const CHROMIUM_PACK_URL = 'https://github.com/Sparticuz/chromium/releases/download/v126.0.0/chromium-v126.0.0-pack.tar';
const BROWSER_LAUNCH_RETRIES = 3;

/**
 * Enhanced browser manager for local and Vercel environments.
 * - Explicitly patches playwright-core to avoid dependency errors.
 * - Implements executable path caching.
 * - Adds retries for browser launch.
 */
export const getBrowser = async (attempt = 1) => {
    try {
        if (isVercel) {
            if (!cachedExecutablePath) {
                console.log('Fetching Chromium executable path...');
                cachedExecutablePath = await chromiumPack.executablePath(CHROMIUM_PACK_URL);
            }

            return await extraChromium.launch({
                args: [...chromiumPack.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
                defaultViewport: chromiumPack.defaultViewport,
                executablePath: cachedExecutablePath,
                headless: chromiumPack.headless,
            });
        } else {
            // Local Development (full browser)
            return await extraChromium.launch({
                headless: true
            });
        }
    } catch (error) {
        console.error(`Browser Launch Failed (Attempt ${attempt}):`, error.message);
        if (attempt < BROWSER_LAUNCH_RETRIES) {
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`Retrying browser launch in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
            // Reset cached path if it might be the cause
            if (error.message.includes('not found') || error.message.includes('directory')) {
                cachedExecutablePath = null;
            }
            return getBrowser(attempt + 1);
        }
        throw error;
    }
};
