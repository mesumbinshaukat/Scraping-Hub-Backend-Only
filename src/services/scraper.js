import { staticPhase } from './phases/staticPhase.js';
import { dynamicPhase } from './phases/dynamicPhase.js';
import { fallbackPhase } from './phases/fallbackPhase.js';
import { simplePhase } from './phases/simplePhase.js';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});

export class ScraperService {
    async scrape(url) {
        let result = null;
        let errors = [];

        // PHASE 1: Static Scraping (Smart, Proxy, Cloudscraper)
        try {
            logger.info({ message: 'Starting Phase 1 (Static)', url });
            result = await staticPhase(url);
            if (result) return { ...result, phase: 'static' };
        } catch (err) {
            logger.warn({ message: `Phase 1 failed`, url, error: err.message });
            errors.push({ phase: 1, error: err.message });
        }

        // PHASE 2: Dynamic Scraping (Stealth Browser)
        try {
            logger.info({ message: 'Starting Phase 2 (Dynamic Stealth)', url });
            if (process.env.SKIP_DYNAMIC !== 'true') {
                result = await dynamicPhase(url);
                if (result) return { ...result, phase: 'dynamic_stealth' };
            } else {
                logger.info({ message: 'Skipping Phase 2 due to configuration', url });
            }
        } catch (err) {
            logger.warn({ message: `Phase 2 failed`, url, error: err.message });
            errors.push({ phase: 2, error: err.message });
        }

        // PHASE 3: Search Fallback (Find in indices)
        try {
            logger.info({ message: 'Starting Phase 3 (Fallback Search)', url });
            result = await fallbackPhase(url);
            if (result) return { ...result, phase: 'search_fallback' };
        } catch (err) {
            logger.warn({ message: `Phase 3 failed`, url, error: err.message });
            errors.push({ phase: 3, error: err.message });
        }

        // PHASE 4: Last Resort (Simple barebones fetch)
        try {
            logger.info({ message: 'Starting Phase 4 (Last Resort Simple)', url });
            result = await simplePhase(url);
            if (result) return { ...result, phase: 'simple_last_resort' };
        } catch (err) {
            logger.warn({ message: `Phase 4 failed`, url, error: err.message });
            errors.push({ phase: 4, error: err.message });
        }

        const masterError = new Error(`All scraping phases failed for ${url}`);
        masterError.details = errors;
        masterError.status = 500;
        throw masterError;
    }
}

export const scraperService = new ScraperService();
