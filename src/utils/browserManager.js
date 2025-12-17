import chromium from '@sparticuz/chromium-min';
import playwright from 'playwright-core';
import { chromium as localChromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

// Playwright-extra wrapper isn't directly compatible with playwright-core in all setups easily,
// but we can use the plugin logic or standard playwright-extra if environment permits.
// For Vercel, we often need 'playwright-core' + '@sparticuz/chromium'.

// Note: stealth plugin is originally for puppeteer, but 'playwright-extra' adapts it.

const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION;

export const getBrowser = async () => {
    try {
        if (isVercel) {
            // Vercel / Lambda environment
            const executablePath = await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v121.0.0/chromium-v121.0.0-pack.tar');

            const browser = await playwright.chromium.launch({
                args: chromium.args,
                defaultViewport: chromium.defaultViewport,
                executablePath,
                headless: chromium.headless,
            });
            return browser;
        } else {
            // Local Development (full browser)
            localChromium.use(stealthPlugin());
            const browser = await localChromium.launch({
                headless: true
            });
            return browser;
        }
    } catch (error) {
        console.error('Browser Launch Failed:', error);
        throw error;
    }
};
