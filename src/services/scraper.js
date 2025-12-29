import { staticPhase } from './phases/staticPhase.js';
import { dynamicPhase } from './phases/dynamicPhase.js';
import { fallbackPhase } from './phases/fallbackPhase.js';
import { simplePhase } from './phases/simplePhase.js';
import axios from 'axios';
import winston from 'winston';
import validator from 'validator';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});

export class ScraperService {
    async scrape(url) {
        if (!validator.isURL(url)) {
            const err = new Error('Invalid URL');
            err.status = 400;
            throw err;
        }

        const startTime = Date.now();
        const GLOBAL_TIMEOUT = 9000; // 9s for Vercel Hobby

        return Promise.race([
            this._executePhases(url),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Global scraping timeout')), GLOBAL_TIMEOUT)
            )
        ]);
    }

    async _executePhases(url) {
        let result = null;
        let errors = [];

        // PHASE 0: Quick HEAD Validation
        try {
            logger.info({ message: 'Starting Phase 0 (HEAD validation)', url });
            const head = await axios.head(url, { timeout: 2000, validateStatus: false });
            const contentType = head.headers['content-type'] || '';
            if (head.status >= 400 && head.status !== 405) { // 405 might mean HEAD not allowed
                logger.warn({ message: 'Phase 0 HEAD failed, status:', status: head.status, url });
            } else if (contentType && !contentType.includes('text/html')) {
                logger.info({ message: 'Phase 0: Non-HTML content detected, returning metadata', contentType, url });
                return {
                    url,
                    title: url.split('/').pop() || url,
                    content: `Non-HTML content: ${contentType}`,
                    metadata: { contentType, status: head.status },
                    phase: 'metadata_only'
                };
            }
        } catch (err) {
            logger.warn({ message: 'Phase 0 HEAD failed', error: err.message, url });
        }

        // PHASE 1: Static Scraping
        try {
            logger.info({ message: 'Starting Phase 1 (Static)', url });
            result = await staticPhase(url);
            if (result && this._isValidContent(result)) return { ...result, phase: 'static' };
        } catch (err) {
            logger.warn({ message: `Phase 1 failed`, url, error: err.message });
            errors.push({ phase: 1, error: err.message });
        }

        // PHASE 2: Dynamic JS Rendering (JSDOM/Happy-DOM)
        try {
            logger.info({ message: 'Starting Phase 2 (Dynamic JS)', url });
            result = await dynamicPhase(url);
            if (result && this._isValidContent(result)) return { ...result, phase: 'dynamic_js' };
        } catch (err) {
            logger.warn({ message: `Phase 2 failed`, url, error: err.message });
            errors.push({ phase: 2, error: err.message });
        }

        // PHASE 3: Search Fallback
        try {
            logger.info({ message: 'Starting Phase 3 (Fallback Search)', url });
            result = await fallbackPhase(url);
            if (result) return { ...result, phase: 'search_fallback' };
        } catch (err) {
            logger.warn({ message: `Phase 3 failed`, url, error: err.message });
            errors.push({ phase: 3, error: err.message });
        }

        // PHASE 4: Last Resort Simple
        try {
            logger.info({ message: 'Starting Phase 4 (Last Resort)', url });
            result = await simplePhase(url);
            if (result) return { ...result, phase: 'simple_last_resort' };
        } catch (err) {
            logger.warn({ message: `Phase 4 failed`, url, error: err.message });
            errors.push({ phase: 4, error: err.message });
        }

        // PHASE 5: Archive Fallback (Placeholder/Actually implement if needed)
        // For now, let's treat it as a final attempt

        const masterError = new Error(`All scraping phases failed for ${url}`);
        masterError.details = errors;
        masterError.status = 500;
        throw masterError;
    }

    _isValidContent(result) {
        return result && result.mainContent && result.mainContent.trim().length > 100;
    }
}

export const scraperService = new ScraperService();
