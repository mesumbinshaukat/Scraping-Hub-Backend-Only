import { resourceManager } from '../resources.js';
import axios from 'axios';
import { staticPhase } from './staticPhase.js';

/**
 * Fallback Phase: Search, Domain-Specific, and Archive
 */
export const fallbackPhase = async (url) => {
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        const path = urlObj.pathname;

        // 1. Try URL Search
        let results = await resourceManager.search(url, 'search');

        // 2. If empty, try "site:domain path"
        if (!results || results.length === 0) {
            const query = `site:${domain} ${path.replace(/\//g, ' ')}`.trim();
            console.log(`URL search empty. Trying site-specific search: ${query}`);
            results = await resourceManager.search(query, 'search');
        }

        // 3. Fallback to RSS for domain + "rss" query
        if (!results || results.length === 0) {
            console.log(`Search fallback empty. Trying RSS domain search...`);
            results = await resourceManager.search(domain, 'rss');
        }

        if (results && results.length > 0) {
            const match = results.find(r => r.url === url) || results[0];
            return {
                title: match.title || 'Found via Fallback',
                description: match.snippet || `Content found in ${match.source} for ${url}.`,
                mainContent: match.snippet || match.title,
                links: results.map(r => r.url).filter(l => l !== url),
                method: `fallback_${match.source || 'resource'}_search`,
                duration: 0
            };
        }

        // 4. Phase 5: Wayback Machine Fallback
        return await waybackFallback(url);

    } catch (error) {
        console.error(`Fallback phase error for ${url}:`, error.message);
        return null;
    }
};

const waybackFallback = async (url) => {
    try {
        console.log(`All search fallbacks failed. Checking Wayback Machine for ${url}...`);
        const availabilityUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
        const response = await axios.get(availabilityUrl, { timeout: 5000 });

        const snapshot = response.data?.archived_snapshots?.closest;
        if (snapshot && snapshot.available) {
            console.log(`Wayback snapshot found: ${snapshot.url}`);
            const result = await staticPhase(snapshot.url);
            return {
                ...result,
                method: 'wayback_archive_fallback',
                url: url, // Override wayback URL with original
                metadata: { ...result.metadata, waybackUrl: snapshot.url }
            };
        }
    } catch (e) {
        console.warn(`Wayback fallback failed: ${e.message}`);
    }
    return null;
};
