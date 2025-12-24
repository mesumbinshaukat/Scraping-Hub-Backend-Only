import axios from 'axios';
import * as cheerio from 'cheerio';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

/**
 * Simple Phase: Extreme Fallback
 * Plain axios request without proxies, cloudsraper, or robots check.
 * Fastest possible fetch as a last resort.
 */
export const simplePhase = async (url) => {
    try {
        const response = await axios.get(url, {
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        const $ = cheerio.load(response.data);

        // Basic extraction
        const title = $('title').text().trim() || 'No Title Found';
        const description = $('meta[name="description"]').attr('content') || '';

        // Clean noise
        $('script, style, nav, footer, header, aside').remove();
        const mainContent = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 50000);

        return {
            title,
            description,
            mainContent: purify.sanitize(mainContent),
            method: 'last_resort_simple',
            success: true
        };
    } catch (error) {
        throw new Error(`Simple fallback failed: ${error.message}`);
    }
};
