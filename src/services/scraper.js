import { staticPhase } from './phases/staticPhase.js';
import { dynamicPhase } from './phases/dynamicPhase.js';
import { fallbackPhase } from './phases/fallbackPhase.js';
import winston from 'winston';

const logger = winston.createLogger({
    transports: [new winston.transports.Console()],
});

export class ScraperService {
    async scrape(url) {
        let result = null;
        let errors = [];

        // PHASE 1: Static Scraping
        try {
            logger.info(`Starting Phase 1 (Static) for ${url}`);
            result = await staticPhase(url);
            if (result) return { ...result, phase: 'static' };
        } catch (err) {
            logger.warn(`Phase 1 failed for ${url}: ${err.message}`);
            errors.push({ phase: 1, error: err.message });
        }

        // PHASE 2: Dynamic Scraping (Stealth)
        try {
            logger.info(`Starting Phase 2 (Dynamic Stealth) for ${url}`);
            if (process.env.SKIP_DYNAMIC !== 'true') {
                 result = await dynamicPhase(url);
                 if (result) return { ...result, phase: 'dynamic_stealth' };
            } else {
                logger.info('Skipping Phase 2 due to configuration');
            }
        } catch (err) {
            logger.warn(`Phase 2 failed for ${url}: ${err.message}`);
            errors.push({ phase: 2, error: err.message });
        }

        // PHASE 3: Search Fallback
        try {
            logger.info(`Starting Phase 3 (Fallback) for ${url}`);
            result = await fallbackPhase(url);
            if (result) return { ...result, phase: 'fallback' };
        } catch (err) {
            logger.warn(`Phase 3 failed for ${url}: ${err.message}`);
            errors.push({ phase: 3, error: err.message });
        }
        
        throw new Error(`All scraping phases failed. Errors: ${JSON.stringify(errors)}`);
    }
}

export const scraperService = new ScraperService();
